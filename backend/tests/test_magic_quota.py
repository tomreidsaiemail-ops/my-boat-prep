# Magic running-total quota (iteration 135): /api/magic/quota shape (50 free once, packs of 50 for NZ$10), consumption order
# (free then purchased), 429 when exhausted, X-Magic-Free-Left header, top-up checkout (small only, big 422),
# credit_topup via signed webhook (adds on top, 'of' = balance after top-up), admin quota settings, migration state.
import os
import json
import time
import hmac
import hashlib
import uuid
from datetime import datetime, timezone

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
CREATED_SIDS = []


def s(tok=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    return ss


def put_settings(ft, ps, pp):
    return s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json={"free_total": ft, "pack_size": ps, "pack_price": pp}, timeout=30)


def seed(free_used=0, purchased=0, fill=None):
    upd = {"$set": {"free_used": free_used, "purchased_allowance": purchased}}
    if fill is None:
        upd["$unset"] = {"fill": ""}
    else:
        upd["$set"]["fill"] = fill
    DB.magic_quota.update_one({"user_id": PRO_ID}, upd, upsert=True)


def qdoc():
    return DB.magic_quota.find_one({"user_id": PRO_ID}, {"_id": 0})


def quota(tok=PRO):
    r = s(tok).get(f"{BASE_URL}/api/magic/quota", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def webhook(event: dict, secret=WHSEC):
    payload = json.dumps(event)
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.{payload}".encode(), hashlib.sha256).hexdigest()
    return requests.post(f"{BASE_URL}/api/stripe/webhook", data=payload,
                         headers={"stripe-signature": f"t={t},v1={sig}", "Content-Type": "application/json"}, timeout=30)


def topup_event(sid, pack="50", eid=None):
    return {"id": eid or f"evt_TEST_{uuid.uuid4().hex[:10]}", "object": "event", "type": "checkout.session.completed", "api_version": "2024-06-20",
            "data": {"object": {"id": sid, "object": "checkout.session", "mode": "payment", "payment_status": "paid", "status": "complete",
                                "metadata": {"kind": "magic_topup", "pack_size": pack, "user_id": PRO_ID}}}}


def fake_tx(pack=50):
    sid = f"cs_test_TEST_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    DB.payment_transactions.insert_one({"session_id": sid, "user_id": PRO_ID, "kind": "magic_topup", "pack_size": pack, "amount": 10.0,
                                        "currency": "nzd", "status": "initiated", "payment_status": "pending", "credited": False,
                                        "created_at": now, "updated_at": now})
    CREATED_SIDS.append(sid)
    return sid


@pytest.fixture(scope="module", autouse=True)
def restore():
    orig = qdoc()
    yield
    put_settings(50, 50, 10)
    if orig:
        DB.magic_quota.replace_one({"user_id": PRO_ID}, orig, upsert=True)
    else:
        DB.magic_quota.update_one({"user_id": PRO_ID}, {"$set": {"free_used": 0, "purchased_allowance": 0}, "$unset": {"fill": ""}}, upsert=True)
    if CREATED_SIDS:
        DB.payment_transactions.delete_many({"session_id": {"$in": CREATED_SIDS}})


class TestRunningTotal:
    # --- migration + settings state ---
    def test_01_migration_state(self):
        assert DB.migrations.find_one({"_id": "magic_running_total"}) is not None
        st = DB.app_settings.find_one({"key": "magic_quota"}, {"_id": 0})
        assert st["free_total"] == 50 and st["pack_size"] == 50 and st["pack_price"] == 10
        for k in ("daily_limit", "big_pack_size", "big_pack_price"):
            assert k not in st, k
        assert DB.magic_quota.count_documents({"daily_used": {"$exists": True}}) == 0
        assert DB.magic_quota.count_documents({"last_reset_date": {"$exists": True}}) == 0

    def test_02_quota_shape(self):
        assert s().get(f"{BASE_URL}/api/magic/quota").status_code == 401
        seed(0, 0)
        d = quota()
        assert d["free_total"] == 50 and d["pack_size"] == 50 and d["pack_price"] == 10
        assert d["free_left"] == 50 and d["purchased_allowance"] == 0 and d["left"] == 50 and d["of"] == 50
        assert d["price_text"] == "NZ$10" and d["currency"] == "nzd"
        assert d["packs"] == [{"id": "small", "size": 50, "price": 10, "price_text": "NZ$10"}]
        for k in ("daily_limit", "daily_used", "big_pack_size", "big_pack_price"):
            assert k not in d, k
        assert "x-magic-free-left" not in {k.lower() for k in requests.get(f"{BASE_URL}/api/magic/quota", cookies={"session_token": PRO}).headers}

    def test_03_free_user_quota_readable(self):
        d = quota(FREE)
        assert d["of"] >= 50 and "left" in d

    def test_04_no_daily_reset(self):
        # free_used is lifetime: a GET with any timezone never resets it
        seed(30, 0)
        r = s(PRO).get(f"{BASE_URL}/api/magic/quota", headers={"X-Timezone": "Pacific/Honolulu"}).json()
        assert r["free_left"] == 20 and r["left"] == 20 and qdoc()["free_used"] == 30

    def test_05_429_when_exhausted(self):
        seed(50, 0)
        before = DB.ai_drafts.count_documents({"user_id": PRO_ID})
        r = s(PRO).post(f"{BASE_URL}/api/ai/list-draft", json={"name": "TEST", "description": "Weekend sail for two"}, timeout=60)
        assert r.status_code == 429, r.text
        d = r.json()
        assert d["code"] == "daily_limit" and d["left"] == 0 and d["free_left"] == 0
        assert d["detail"] == "You've used all your Magic generations. Buy +50 more for NZ$10."
        assert DB.ai_drafts.count_documents({"user_id": PRO_ID}) == before
        assert qdoc()["free_used"] == 50 and qdoc()["purchased_allowance"] == 0

    def test_06_429_other_endpoints(self):
        seed(50, 0)
        for path, body in [("/api/ai/engine-ask", {"question": "Impeller?"}),
                           ("/api/ai/doctor-ask", {"log_agree": True, "question": "Burn?"}),
                           ("/api/ai/mpa/aisles", {"items": ["Bread"], "aisles": ["Bakery"]})]:
            r = s(PRO).post(f"{BASE_URL}{path}", json=body, timeout=60)
            assert r.status_code == 429, f"{path} {r.status_code} {r.text[:200]}"
            assert r.json()["code"] == "daily_limit"

    def test_07_free_total_zero_blocks(self):
        assert put_settings(0, 50, 10).status_code == 200
        seed(0, 0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/engine-ask", json={"question": "Impeller?"}, timeout=60)
        assert r.status_code == 429
        assert put_settings(50, 50, 10).status_code == 200

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_08_free_consumed_first_with_header(self):
        seed(45, 3)
        r = s(PRO).post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Bread", "Milk"], "aisles": ["Bakery", "Dairy"]}, timeout=120)
        doc = qdoc()
        if r.status_code == 503:
            assert doc["free_used"] == 45, "refund to free failed"
            pytest.skip("AI 503 - refund verified")
        assert r.status_code == 200, r.text
        assert doc["free_used"] == 46 and doc["purchased_allowance"] == 3
        assert r.headers.get("X-Magic-Free-Left") == "7"

    @pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
    def test_09_purchased_after_free(self):
        seed(50, 2)
        r = s(PRO).post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Milk"], "aisles": ["Dairy"]}, timeout=120)
        doc = qdoc()
        if r.status_code == 503:
            assert doc["purchased_allowance"] == 2, "refund to purchased failed"
            pytest.skip("AI 503 - refund verified")
        assert r.status_code == 200, r.text
        assert doc["free_used"] == 50 and doc["purchased_allowance"] == 1
        assert r.headers.get("X-Magic-Free-Left") == "1"

    # --- top-up ---
    def test_10_topup_checkout_small_nz10(self):
        import stripe
        stripe.api_key = ENV["STRIPE_SECRET_KEY"]
        r = s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL, "pack": "small"}, timeout=60)
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        CREATED_SIDS.append(sid)
        cs = stripe.checkout.Session.retrieve(sid)
        assert cs.currency == "nzd" and cs.amount_subtotal == 1000 and cs.metadata["pack_size"] == "50"
        tx = DB.payment_transactions.find_one({"session_id": sid})
        assert tx["pack_size"] == 50 and tx["amount"] == 10 and tx["credited"] is False
        st = requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30).json()
        assert st["payment_status"] == "pending"

    def test_11_topup_big_422_free_403(self):
        assert s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL, "pack": "big"}).status_code == 422
        me = s(FREE).get(f"{BASE_URL}/api/auth/me").json()
        r = s(FREE).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL, "pack": "small"})
        # launch_free mode makes every account premium, so the free account may buy too
        assert r.status_code == (200 if me.get("premium") else 403), r.text
        if r.status_code == 200:
            CREATED_SIDS.append(r.json()["session_id"])
        assert s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": "javascript:alert(1)"}).status_code == 400

    def test_12_credit_adds_on_top_3_to_53(self):
        seed(47, 0)  # 3 left
        q = quota()
        assert q["left"] == 3 and q["of"] == 50
        sid = fake_tx(50)
        assert webhook(topup_event(sid)).status_code == 200
        doc = qdoc()
        assert doc["purchased_allowance"] == 50 and doc["fill"] == 53
        q = quota()
        assert q["left"] == 53 and q["of"] == 53 and q["free_left"] == 3 and q["purchased_allowance"] == 50
        # idempotent
        assert webhook(topup_event(sid)).status_code == 200
        assert qdoc()["purchased_allowance"] == 50
        tx = DB.payment_transactions.find_one({"session_id": sid})
        assert tx["credited"] is True and tx["payment_status"] == "paid"
        assert requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30).json()["payment_status"] == "paid"

    def test_13_credit_from_zero_50_of_50(self):
        seed(50, 0)
        sid = fake_tx(50)
        assert webhook(topup_event(sid)).status_code == 200
        q = quota()
        assert q["left"] == 50 and q["of"] == 50 and q["free_left"] == 0

    def test_14_of_stays_after_use(self):
        seed(50, 40, fill=53)
        q = quota()
        assert q["left"] == 40 and q["of"] == 53

    # --- admin settings ---
    def test_15_admin_auth(self):
        assert s(PRO).get(f"{BASE_URL}/api/admin/settings/quota").status_code == 403
        assert s().get(f"{BASE_URL}/api/admin/settings/quota").status_code == 401
        assert s(PRO).put(f"{BASE_URL}/api/admin/settings/quota", json={"free_total": 1, "pack_size": 1, "pack_price": 1}).status_code == 403

    @pytest.mark.parametrize("body", [{"free_total": -1, "pack_size": 50, "pack_price": 10}, {"free_total": 10001, "pack_size": 50, "pack_price": 10},
                                      {"free_total": 50, "pack_size": 0, "pack_price": 10}, {"free_total": 50, "pack_size": 1001, "pack_price": 10},
                                      {"free_total": 50, "pack_size": 50, "pack_price": 0.5}, {"free_total": 50, "pack_size": 50, "pack_price": 501}])
    def test_16_admin_validation(self, body):
        assert s(ADMIN).put(f"{BASE_URL}/api/admin/settings/quota", json=body).status_code == 422

    def test_17_admin_put_get_reflected_and_restore(self):
        r = put_settings(60, 40, 7.5)
        assert r.status_code == 200, r.text
        assert r.json()["free_total"] == 60 and r.json()["pack_size"] == 40 and r.json()["pack_price"] == 7.5
        g = s(ADMIN).get(f"{BASE_URL}/api/admin/settings/quota").json()
        assert g["free_total"] == 60 and g["pack_size"] == 40 and g["pack_price"] == 7.5 and g["currency"] == "nzd"
        seed(0, 0)
        q = quota()
        assert q["left"] == 60 and q["price_text"] == "NZ$7.50" and q["packs"][0]["size"] == 40
        seed(60, 0)
        r = s(PRO).post(f"{BASE_URL}/api/ai/engine-ask", json={"question": "Impeller?"}, timeout=60)
        assert r.status_code == 429 and r.json()["detail"] == "You've used all your Magic generations. Buy +40 more for NZ$7.50."
        assert put_settings(50, 50, 10).status_code == 200
        st = DB.app_settings.find_one({"key": "magic_quota"})
        assert st["free_total"] == 50 and st["pack_size"] == 50 and st["pack_price"] == 10
        seed(0, 0)
