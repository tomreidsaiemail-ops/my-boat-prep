# Top-up checkout fix (iteration 57): POST /api/payments/topup-checkout retry-by-email on unusable stored customer,
# Stripe errors -> 502 readable detail, tier gating (free 403, preview admin ok), 429-dialog path, Pro checkout regression.
import os
import sys
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
import stripe
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
stripe.api_key = ENV["STRIPE_SECRET_KEY"]
PRO, FREE = "test_session_pro_1", "test_session_free_1"
PRO_ID, PA_ID = "test-user-pro", "user_cd2a5bd996a9"
PA_TOKEN = "TEST_pa_session_it57"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def topup(tok, pack="small"):
    return s(tok).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": BASE_URL, "pack": pack})


@pytest.fixture(scope="module", autouse=True)
def setup_cleanup():
    now = datetime.now(timezone.utc)
    DB.user_sessions.insert_one({"session_token": PA_TOKEN, "user_id": PA_ID, "created_at": now, "expires_at": now + timedelta(hours=1)})
    quota_backup = DB.magic_quota.find_one({"user_id": PRO_ID}, {"_id": 0})
    yield
    DB.user_sessions.delete_one({"session_token": PA_TOKEN})
    DB.users.update_one({"user_id": PRO_ID}, {"$unset": {"stripe_customer_id": ""}})
    if quota_backup:
        DB.magic_quota.replace_one({"user_id": PRO_ID}, quota_backup, upsert=True)


def _check_session(sid, amount):
    cs = stripe.checkout.Session.retrieve(sid)
    assert cs.livemode is False
    assert cs.currency == "nzd"
    assert cs.amount_subtotal == amount, cs.amount_subtotal
    assert cs.metadata["kind"] == "magic_topup"
    return cs


class TestTopupCheckout:
    def test_pro_small(self):
        r = topup(PRO, "small")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com/")
        _check_session(d["session_id"], 500)
        tx = DB.payment_transactions.find_one({"session_id": d["session_id"]})
        assert tx["pack_size"] == 20 and tx["credited"] is False

    def test_pro_big(self):
        r = topup(PRO, "big")
        assert r.status_code == 200, r.text
        cs = _check_session(r.json()["session_id"], 1500)
        assert cs.metadata["pack_size"] == "100"

    def test_from_429_limit(self):
        today = datetime.now(timezone.utc).date().isoformat()
        DB.magic_quota.update_one({"user_id": PRO_ID}, {"$set": {"daily_used": 20, "last_reset_date": today}}, upsert=True)
        q = s(PRO).get(f"{BASE_URL}/api/magic/quota").json()
        assert q["free_left"] == 0
        for pack in ("small", "big"):
            r = topup(PRO, pack)
            assert r.status_code == 200, r.text

    def test_bogus_customer_retries_by_email(self):
        DB.users.update_one({"user_id": PRO_ID}, {"$set": {"stripe_customer_id": "cus_DOESNOTEXIST123"}})
        try:
            r = topup(PRO, "small")
            assert r.status_code == 200, r.text
            cs = _check_session(r.json()["session_id"], 500)
            assert cs.customer_email == "test.user.pro@example.com"
        finally:
            DB.users.update_one({"user_id": PRO_ID}, {"$unset": {"stripe_customer_id": ""}})

    def test_free_403(self):
        r = topup(FREE)
        assert r.status_code == 403
        assert r.json()["detail"] == "Upgrade to Pro to use this feature"

    def test_preview_admin_ok(self):
        me = s(PA_TOKEN).get(f"{BASE_URL}/api/auth/me").json()
        assert me.get("premium") is True, me
        r = topup(PA_TOKEN)
        assert r.status_code == 200, r.text
        assert r.json()["checkout_url"].startswith("https://checkout.stripe.com/")

    def test_invalid_origin_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/payments/topup-checkout", json={"origin_url": "javascript:alert(1)", "pack": "small"})
        assert r.status_code == 400

    def test_pro_subscription_checkout_regression(self):
        r = s(FREE).post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        assert r.json()["checkout_url"].startswith("https://checkout.stripe.com/")


class TestStartTopupSessionUnit:
    """Direct unit test of payments._start_session error handling."""

    @pytest.fixture(scope="class")
    def payments(self):
        sys.path.insert(0, "/app/backend")
        for k, v in ENV.items():
            os.environ.setdefault(k, v)
        import payments as p
        return p

    def _kwargs(self, currency="nzd", customer=None):
        kw = dict(line_items=[{"price_data": {"currency": currency, "unit_amount": 500, "product_data": {"name": "TEST_unit"}}, "quantity": 1}],
                  mode="payment", success_url=f"{BASE_URL}/payment/success", cancel_url=f"{BASE_URL}/payment/cancel")
        if customer:
            kw["customer"] = customer
        else:
            kw["customer_email"] = "test.user.pro@example.com"
        return kw

    def test_invalid_currency_502(self, payments):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as ei:
            asyncio.run(payments._start_session(self._kwargs("zzz"), {"user_id": "u", "email": "test.user.pro@example.com"}))
        assert ei.value.status_code == 502
        assert ei.value.detail.startswith("Stripe couldn't start the checkout")
        print("502 detail:", ei.value.detail)

    def test_bogus_customer_retry_unit(self, payments):
        sess = asyncio.run(payments._start_session(self._kwargs(customer="cus_DOESNOTEXIST123"),
                                                         {"user_id": "u", "email": "test.user.pro@example.com"}))
        assert sess.url.startswith("https://checkout.stripe.com/")
        assert sess.customer_email == "test.user.pro@example.com"
