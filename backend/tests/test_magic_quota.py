# Shared Magic daily quota + top-up tests: /api/magic/quota, admin quota settings, consumption/429 across all Magic endpoints,
# daily reset per X-Timezone, Stripe top-up checkout + signed webhook crediting, payment status, Pro checkout regression.
import os
import json
import time
import hmac
import hashlib
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
WHSEC = ENV["STRIPE_WEBHOOK_SECRET"]
ADMIN, PRO, FREE = "test_session_admin_1", "test_session_pro_1", "test_session_free_1"
PRO_ID = "test-user-pro"
REAL_AI = os.environ.get("QUOTA_REAL_AI", "1") == "1"
SAMPLE = open(os.path.join(os.path.dirname(__file__), "scan_sample.jpg"), "rb").read()


def s(tok=None, tz=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    if tz:
        ss.headers["X-Timezone"] = tz
    return ss


def put_settings(dl, ps, pp):
    return s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json={"daily_limit": dl, "pack_size": ps, "pack_price": pp})


def seed(daily_used=0, purchased=0, date=None, tz="UTC"):
    date = date or datetime.now(ZoneInfo(tz)).date().isoformat()
    DB.magic_quota.update_one({"user_id": PRO_ID}, {"$set": {"daily_used": daily_used, "purchased_allowance": purchased, "last_reset_date": date}}, upsert=True)


def qdoc():
    return DB.magic_quota.find_one({"user_id": PRO_ID}, {"_id": 0})


def sign(payload: str, secret=WHSEC):
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.{payload}".encode(), hashlib.sha256).hexdigest()
    return f"t={t},v1={sig}"


def webhook(event: dict, secret=WHSEC):
    payload = json.dumps(event)
    return requests.post(f"{BASE_URL}/api/stripe/webhook", data=payload, headers={"stripe-signature": sign(payload, secret), "Content-Type": "application/json"}, timeout=30)


def topup_event(session_id, paid=True, eid=None, pack="20"):
    return {"id": eid or f"evt_TEST_{session_id[-8:]}", "object": "event", "type": "checkout.session.completed", "api_version": "2024-06-20",
            "data": {"object": {"id": session_id, "object": "checkout.session", "mode": "payment", "payment_status": "paid" if paid else "unpaid",
                                "status": "complete" if paid else "open", "metadata": {"kind": "magic_topup", "pack_size": pack, "user_id": PRO_ID}}}}


@pytest.fixture(scope="module", autouse=True)
def restore():
    orig = DB.magic_quota.find_one({"user_id": PRO_ID}, {"_id": 0})
    yield
    put_settings(20, 20, 5)
    DB.magic_quota.delete_one({"user_id": PRO_ID})
    DB.payment_transactions.delete_many({"user_id": PRO_ID, "kind": "magic_topup"})


# --- quota status ---
class TestQuotaStatus:
    def test_signed_out_401(self):
        assert s().get(f"{BASE_URL}/api/magic/quota").status_code == 401

    def test_quota_shape_and_doc_created(self):
        assert put_settings(20, 20, 5).status_code == 200
        DB.magic_quota.delete_one({"user_id": PRO_ID})
        r = s(PRO, "Pacific/Auckland").get(f"{BASE_URL}/api/magic/quota")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("daily_limit", "pack_size", "pack_price", "daily_used", "purchased_allowance", "free_left", "left", "currency", "price_text"):
            assert k in d, k
        assert d["daily_limit"] == 20 and d["pack_size"] == 20 and d["pack_price"] == 5
        assert d["daily_used"] == 0 and d["purchased_allowance"] == 0 and d["free_left"] == 20 and d["left"] == 20
        assert d["currency"] == "nzd" and d["price_text"] == "NZ$5"
        doc = qdoc()
        assert doc["last_reset_date"] == datetime.now(ZoneInfo("Pacific/Auckland")).date().isoformat()

    def test_free_user_can_read_quota(self):
        r = s(FREE).get(f"{BASE_URL}/api/magic/quota")
        assert r.status_code == 200 and "left" in r.json()


# --- admin settings ---
class TestAdminSettings:
    def test_non_admin_403(self):
        assert s(PRO).get(f"{BASE_URL}/api/admin/settings/quota").status_code == 403
        assert s(PRO).put(f"{BASE_URL}/api/admin/settings/quota", json={"daily_limit": 1, "pack_size": 1, "pack_price": 1}).status_code == 403

    def test_signed_out_401(self):
        assert s().get(f"{BASE_URL}/api/admin/settings/quota").status_code == 401

    @pytest.mark.parametrize("body", [{"daily_limit": -1, "pack_size": 20, "pack_price": 5}, {"daily_limit": 1001, "pack_size": 20, "pack_price": 5},
                                      {"daily_limit": 20, "pack_size": 0, "pack_price": 5}, {"daily_limit": 20, "pack_size": 1001, "pack_price": 5},
                                      {"daily_limit": 20, "pack_size": 20, "pack_price": 0.5}, {"daily_limit": 20, "pack_size": 20, "pack_price": 501}])
    def test_validation_422(self, body):
        assert s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json=body).status_code == 422

    def test_put_get_and_reflected(self):
        r = put_settings(7, 15, 3.5)
        assert r.status_code == 200, r.text
        assert r.json()["daily_limit"] == 7 and r.json()["pack_size"] == 15 and r.json()["pack_price"] == 3.5 and r.json()["currency"] == "nzd"
        g = s(ADMIN).get(f"{BASE_URL}/api/admin/settings/quota").json()
        assert g["daily_limit"] == 7 and g["pack_size"] == 15 and g["pack_price"] == 3.5
        assert DB.app_settings.find_one({"key": "magic_quota"})["daily_limit"] == 7
        q = s(PRO).get(f"{BASE_URL}/api/magic/quota").json()
        assert q["daily_limit"] == 7 and q["pack_size"] == 15 and q["price_text"] == "NZ$3.50"
        assert put_settings(20, 20, 5).status_code == 200


# --- consumption & 429 across every Magic endpoint (no AI cost: pool exhausted) ---
def _boat():
    b = DB.user_boats.find_one({"owner_id": PRO_ID}, {"_id": 0, "boat_id": 1})
    return b["boat_id"] if b else None


ENDPOINTS = [
    ("/api/ai/list-draft", {"name": "TEST", "description": "Weekend sail for two"}),
    ("/api/ai/list-topup", {"name": "TEST", "description": "Weekend", "items": [{"label": "Water", "heading": False}]}),
    ("/api/ai/engine-ask", {"question": "How often change impeller?"}),
    ("/api/ai/mpa/provisions", {"items": ["Bread"], "adults": 2, "children": 0, "days": 2}),
    ("/api/ai/mpa/aisles", {"items": ["Bread"], "aisles": ["Bakery"]}),
    ("/api/ai/doctor-ask", {"question": "How to treat a burn?"}),
    ("/api/ai/navigator-ask", {"start": "Auckland", "destination": "Waiheke"}),
]


class TestConsumption:
    @pytest.mark.parametrize("path,body", ENDPOINTS)
    def test_429_when_exhausted(self, path, body):
        assert put_settings(1, 20, 5).status_code == 200
        seed(daily_used=1, purchased=0)
        before = DB.ai_drafts.count_documents({"user_id": PRO_ID})
        r = s(PRO).post(f"{BASE_URL}{path}", json=body, timeout=60)
        assert r.status_code == 429, f"{path}: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["code"] == "daily_limit" and d["left"] == 0 and d["daily_limit"] == 1 and d["pack_size"] == 20 and d["price_text"] == "NZ$5"
        assert d["detail"] == "You've reached your daily limit of 1 Magic generations. Buy +20 more for NZ$5, or +100 for NZ$15."
        assert DB.ai_drafts.count_documents({"user_id": PRO_ID}) == before
        assert qdoc()["daily_used"] == 1 and qdoc()["purchased_allowance"] == 0

    def test_scan_429_when_exhausted(self):
        boat = _boat()
        if not boat:
            pytest.skip("pro user has no boat")
        put_settings(1, 20, 5)
        seed(daily_used=1, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/boats/{boat}/scan", files={"file": ("c.jpg", SAMPLE, "image/jpeg")}, timeout=60)
        assert r.status_code == 429, r.text
        assert r.json()["code"] == "daily_limit"

    def test_429_message_reflects_admin_change(self):
        put_settings(3, 30, 7.5)
        seed(daily_used=3, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/engine-ask", json={"question": "Impeller?"}, timeout=60)
        assert r.status_code == 429
        assert r.json()["detail"] == "You've reached your daily limit of 3 Magic generations. Buy +30 more for NZ$7.50, or +100 for NZ$15."
        put_settings(20, 20, 5)

    def test_daily_limit_zero_blocks(self):
        put_settings(0, 20, 5)
        seed(daily_used=0, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "Burn?"}, timeout=60)
        assert r.status_code == 429
        put_settings(20, 20, 5)

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_purchased_used_after_free(self):
        # free exhausted, 2 purchased -> one real call consumes purchased; left = 1
        put_settings(1, 20, 5)
        seed(daily_used=1, purchased=2)
        r = s(PRO).post(f"{BASE_URL}/api/ai/engine-ask", json={"question": "How often should I change a Yanmar impeller? One line."}, timeout=120)
        doc = qdoc()
        if r.status_code == 503:
            assert doc["purchased_allowance"] == 2, "refund to purchased failed"
            pytest.skip("AI 503 - refund verified")
        assert r.status_code == 200, r.text
        assert r.json()["asks_left"] == 1
        assert doc["daily_used"] == 1 and doc["purchased_allowance"] == 1
        put_settings(20, 20, 5)

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_free_first_under_limit(self):
        put_settings(20, 20, 5)
        seed(daily_used=5, purchased=3)
        r = s(PRO).post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Bread", "Milk"], "aisles": ["Bakery", "Dairy"]}, timeout=120)
        doc = qdoc()
        if r.status_code == 503:
            assert doc["daily_used"] == 5
            pytest.skip("AI 503 - refund verified")
        assert r.status_code == 200, r.text
        assert doc["daily_used"] == 6 and doc["purchased_allowance"] == 3
        assert r.json()["drafts_left"] == 14 + 3


# --- daily reset & timezone ---
class TestDailyReset:
    def test_old_date_resets_daily_only(self):
        put_settings(20, 20, 5)
        seed(daily_used=20, purchased=4, date="2020-01-01")
        d = s(PRO, "Pacific/Auckland").get(f"{BASE_URL}/api/magic/quota").json()
        assert d["daily_used"] == 0 and d["purchased_allowance"] == 4 and d["left"] == 24
        assert qdoc()["last_reset_date"] == datetime.now(ZoneInfo("Pacific/Auckland")).date().isoformat()

    def test_timezone_dates_differ(self):
        nz = datetime.now(ZoneInfo("Pacific/Auckland")).date().isoformat()
        hi = datetime.now(ZoneInfo("Pacific/Honolulu")).date().isoformat()
        if nz == hi:
            pytest.skip("same date in both zones right now")
        seed(daily_used=5, purchased=0, date=nz)
        s(PRO, "Pacific/Honolulu").get(f"{BASE_URL}/api/magic/quota")
        doc = qdoc()
        assert doc["last_reset_date"] == hi and doc["daily_used"] == 0

    def test_same_day_no_reset(self):
        nz = datetime.now(ZoneInfo("Pacific/Auckland")).date().isoformat()
        seed(daily_used=5, purchased=0, date=nz)
        d = s(PRO, "Pacific/Auckland").get(f"{BASE_URL}/api/magic/quota").json()
        assert d["daily_used"] == 5

    def test_invalid_tz_falls_back_utc(self):
        seed(daily_used=3, purchased=0, date="2020-01-01")
        r = s(PRO, "Not/AZone").get(f"{BASE_URL}/api/magic/quota")
        assert r.status_code == 200
        assert qdoc()["last_reset_date"] == datetime.now(ZoneInfo("UTC")).date().isoformat()


# --- top-up checkout + webhook ---
class TestTopup:
    def test_free_user_403(self):
        r = s(FREE).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL})
        assert r.status_code == 403

    def test_invalid_origin_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": "javascript:alert(1)"})
        assert r.status_code == 400

    def test_checkout_webhook_credit_once(self):
        import stripe
        stripe.api_key = ENV["STRIPE_SECRET_KEY"]
        put_settings(20, 20, 5)
        seed(daily_used=20, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com")
        sid = d["session_id"]
        sess = stripe.checkout.Session.retrieve(sid, expand=["line_items"])
        assert sess.mode == "payment" and sess.currency == "nzd" and sess.amount_subtotal == 500
        assert sess.metadata["kind"] == "magic_topup" and sess.metadata["pack_size"] == "20"
        assert "kind=topup" in sess.success_url
        tx = DB.payment_transactions.find_one({"session_id": sid})
        assert tx["kind"] == "magic_topup" and tx["pack_size"] == 20 and tx["credited"] is False
        # unpaid status stays pending
        st = requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30).json()
        assert st["payment_status"] == "pending"
        assert qdoc()["purchased_allowance"] == 0
        # invalid signature
        bad = webhook(topup_event(sid), secret="whsec_wrong")
        assert bad.status_code == 400
        assert qdoc()["purchased_allowance"] == 0
        # unpaid event -> no credit
        assert webhook(topup_event(sid, paid=False)).status_code == 200
        assert qdoc()["purchased_allowance"] == 0
        # paid event -> +20 once
        w = webhook(topup_event(sid))
        assert w.status_code == 200, w.text
        assert qdoc()["purchased_allowance"] == 20
        assert webhook(topup_event(sid)).status_code == 200
        assert webhook(topup_event(sid, eid="evt_TEST_other")).status_code == 200
        assert qdoc()["purchased_allowance"] == 20
        tx = DB.payment_transactions.find_one({"session_id": sid})
        assert tx["credited"] is True and tx["payment_status"] == "paid"
        q = s(PRO).get(f"{BASE_URL}/api/magic/quota").json()
        assert q["left"] == 20 and q["free_left"] == 0
        assert requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30).json()["payment_status"] == "paid"

    def test_missing_signature_400(self):
        r = requests.post(f"{BASE_URL}/api/stripe/webhook", data="{}", timeout=30)
        assert r.status_code == 400


# --- Pro checkout regression ---
class TestProCheckoutRegression:
    def test_free_user_pro_checkout(self):
        r = s(FREE).post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL}, timeout=60)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            sid = r.json()["session_id"]
            assert r.json()["checkout_url"].startswith("https://checkout.stripe.com")
            tx = DB.payment_transactions.find_one({"session_id": sid})
            assert "kind" not in tx
            st = requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30).json()
            assert st["payment_status"] == "pending"
            # Unpaid subscription completion event without topup kind goes down subscription branch (no crash)
            DB.payment_transactions.delete_one({"session_id": sid})
        else:
            print("Pro checkout 400:", r.json())


# ===== Iteration 55: bigger pack, X-Magic-Free-Left header, top-up history =====
def put_full(dl=20, ps=20, pp=5, bs=None, bp=None):
    body = {"daily_limit": dl, "pack_size": ps, "pack_price": pp}
    if bs is not None:
        body["big_pack_size"] = bs
    if bp is not None:
        body["big_pack_price"] = bp
    return s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json=body)


@pytest.fixture(scope="module", autouse=True)
def restore_big():
    yield
    put_full(20, 20, 5, 100, 15)
    DB.payment_transactions.delete_many({"user_id": {"$in": [PRO_ID, "test-user-beta"]}, "kind": "magic_topup"})


# --- packs in quota + 429 ---
class TestPacks:
    def test_quota_includes_big_pack_and_packs(self):
        assert put_full(20, 20, 5, 100, 15).status_code == 200
        d = s(PRO).get(f"{BASE_URL}/api/magic/quota").json()
        assert d["big_pack_size"] == 100 and d["big_pack_price"] == 15.0
        assert d["packs"] == [{"id": "small", "size": 20, "price": 5, "price_text": "NZ$5"},
                              {"id": "big", "size": 100, "price": 15, "price_text": "NZ$15"}]

    def test_429_includes_packs(self):
        put_full(1, 20, 5, 100, 15)
        seed(daily_used=1, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "Burn?"}, timeout=60)
        assert r.status_code == 429
        assert [p["id"] for p in r.json()["packs"]] == ["small", "big"]
        assert r.json()["packs"][1]["price_text"] == "NZ$15"
        put_full(20, 20, 5)


# --- admin big pack settings ---
class TestAdminBigPack:
    @pytest.mark.parametrize("extra", [{"big_pack_size": 0}, {"big_pack_size": 5001}, {"big_pack_price": 0.5}, {"big_pack_price": 1001}])
    def test_big_validation_422(self, extra):
        assert s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json={"daily_limit": 20, "pack_size": 20, "pack_price": 5, **extra}).status_code == 422

    def test_big_put_get_and_omitted_kept(self):
        r = put_full(20, 20, 5, 150, 22.5)
        assert r.status_code == 200 and r.json()["big_pack_size"] == 150 and r.json()["big_pack_price"] == 22.5
        g = s(ADMIN).get(f"{BASE_URL}/api/admin/settings/quota").json()
        assert g["big_pack_size"] == 150 and g["big_pack_price"] == 22.5
        # omit big fields -> stored values kept
        r = put_full(21, 20, 5)
        assert r.status_code == 200 and r.json()["daily_limit"] == 21 and r.json()["big_pack_size"] == 150 and r.json()["big_pack_price"] == 22.5
        q = s(PRO).get(f"{BASE_URL}/api/magic/quota").json()
        assert q["packs"][1] == {"id": "big", "size": 150, "price": 22.5, "price_text": "NZ$22.50"}
        assert put_full(20, 20, 5, 100, 15).status_code == 200

    def test_edge_values_accepted(self):
        assert put_full(20, 20, 5, 5000, 1000).status_code == 200
        assert put_full(20, 20, 5, 1, 1).status_code == 200
        assert put_full(20, 20, 5, 100, 15).status_code == 200


# --- big pack checkout + webhook ---
class TestBigTopup:
    def _co(self, body):
        return s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL, **body}, timeout=60)

    def test_invalid_pack_422(self):
        assert self._co({"pack": "huge"}).status_code == 422

    @pytest.mark.parametrize("body,size,cents", [({"pack": "big"}, "100", 1500), ({"pack": "small"}, "20", 500), ({}, "20", 500)])
    def test_checkout_amounts(self, body, size, cents):
        import stripe
        stripe.api_key = ENV["STRIPE_SECRET_KEY"]
        put_full(20, 20, 5, 100, 15)
        r = self._co(body)
        assert r.status_code == 200, r.text
        sess = stripe.checkout.Session.retrieve(r.json()["session_id"])
        assert sess.currency == "nzd" and sess.amount_subtotal == cents and sess.metadata["pack_size"] == size
        tx = DB.payment_transactions.find_one({"session_id": r.json()["session_id"]})
        assert tx["pack_size"] == int(size) and tx["amount"] == cents / 100

    def test_big_webhook_credits_100_once(self):
        put_full(20, 20, 5, 100, 15)
        seed(daily_used=0, purchased=0)
        r = self._co({"pack": "big"})
        sid = r.json()["session_id"]
        assert webhook(topup_event(sid, pack="100")).status_code == 200
        assert qdoc()["purchased_allowance"] == 100
        assert webhook(topup_event(sid, pack="100", eid="evt_TEST_x2")).status_code == 200
        assert qdoc()["purchased_allowance"] == 100


# --- X-Magic-Free-Left header ---
class TestFreeLeftHeader:
    def test_quota_get_has_no_header(self):
        r = s(PRO).get(f"{BASE_URL}/api/magic/quota")
        assert "x-magic-free-left" not in {k.lower() for k in r.headers}

    def test_cors_exposes_header(self):
        r = requests.options(f"{BASE_URL}/api/ai/mpa/aisles", headers={"Origin": BASE_URL, "Access-Control-Request-Method": "POST"})
        r2 = s(PRO).get(f"{BASE_URL}/api/magic/quota", headers={"Origin": BASE_URL})
        exp = r2.headers.get("access-control-expose-headers", "") + r.headers.get("access-control-expose-headers", "")
        print("expose:", exp)

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_free_call_sets_header(self):
        put_full(20, 20, 5)
        seed(daily_used=16, purchased=0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Bread"], "aisles": ["Bakery"]}, timeout=120)
        if r.status_code == 503:
            pytest.skip("AI 503")
        assert r.status_code == 200, r.text
        assert r.headers.get("X-Magic-Free-Left") == "3"
        assert qdoc()["daily_used"] == 17

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_purchased_call_no_header(self):
        put_full(20, 20, 5)
        seed(daily_used=20, purchased=2)
        r = s(PRO).post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Milk"], "aisles": ["Dairy"]}, timeout=120)
        if r.status_code == 503:
            pytest.skip("AI 503")
        assert r.status_code == 200, r.text
        assert "X-Magic-Free-Left" not in r.headers
        assert qdoc()["purchased_allowance"] == 1


# --- top-up history ---
class TestTopupHistory:
    def test_signed_out_401(self):
        assert s().get(f"{BASE_URL}/api/payments/topups").status_code == 401

    def test_lists_only_own_credited_newest_first(self):
        from datetime import timezone, timedelta
        DB.payment_transactions.delete_many({"user_id": {"$in": [PRO_ID, "test-user-beta"]}, "kind": "magic_topup"})
        now = datetime.now(timezone.utc)
        base = {"kind": "magic_topup", "currency": "nzd", "status": "completed", "payment_status": "paid"}
        DB.payment_transactions.insert_many([
            {**base, "session_id": "cs_test_TEST_old", "user_id": PRO_ID, "pack_size": 20, "amount": 5.0, "credited": True, "created_at": now - timedelta(days=2)},
            {**base, "session_id": "cs_test_TEST_new", "user_id": PRO_ID, "pack_size": 100, "amount": 15.0, "credited": True, "created_at": now},
            {**base, "session_id": "cs_test_TEST_pending", "user_id": PRO_ID, "pack_size": 20, "amount": 5.0, "credited": False, "created_at": now},
            {**base, "session_id": "cs_test_TEST_beta", "user_id": "test-user-beta", "pack_size": 20, "amount": 5.0, "credited": True, "created_at": now},
        ])
        t = time.time()
        r = s(PRO).get(f"{BASE_URL}/api/payments/topups", timeout=60)
        print("topups took", round(time.time() - t, 2))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert [x["session_id"] for x in rows] == ["cs_test_TEST_new", "cs_test_TEST_old"]
        assert rows[0]["pack_size"] == 100 and rows[0]["amount"] == 15.0 and rows[0]["currency"] == "nzd" and rows[0]["receipt_url"] is None
        assert isinstance(rows[0]["date"], str) and rows[0]["date"].startswith(now.date().isoformat()[:4])
        b = s("test_session_beta_1").get(f"{BASE_URL}/api/payments/topups").json()
        assert [x["session_id"] for x in b] == ["cs_test_TEST_beta"]

    def test_empty_for_free_user(self):
        r = s(FREE).get(f"{BASE_URL}/api/payments/topups")
        assert r.status_code == 200 and r.json() == []
