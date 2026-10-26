# FIRST5000 without Subscription Schedules: price switch logic (unit), renewal toggle, signed webhook, setup_stripe migration (live)
import os
import sys
import json
import time
from pathlib import Path

import pytest
import requests
import stripe
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WH_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
DAY = 86400


def s(token):
    r = requests.Session()
    r.cookies.set("session_token", token)
    return r


# ---------- Unit: billing.end_first5000_after_first_renewal ----------
@pytest.fixture
def fake_stripe(monkeypatch):
    import billing
    calls = []
    class _P(dict):
        id = "price_full"
    full = _P(unit_amount=4999, metadata={})
    monkeypatch.setattr(billing.stripe.Price, "list", lambda **k: type("L", (), {"data": [full]})())
    monkeypatch.setattr(billing.stripe.Subscription, "modify", lambda sid, **k: calls.append((sid, k)))
    return billing, calls


def _sub(days, plan="first5000", status="active"):
    start = 1_700_000_000
    return {"id": "sub_x", "status": status, "start_date": start,
            "items": {"data": [{"id": "si_1", "current_period_start": start + days * DAY,
                                "price": {"unit_amount": 2499, "metadata": {"plan": plan} if plan else {}}}]}}


def test_no_switch_in_first_year(fake_stripe):
    billing, calls = fake_stripe
    sub = _sub(0)
    billing.end_first5000_after_first_renewal(sub)
    assert calls == [] and sub["items"]["data"][0]["price"]["unit_amount"] == 2499


def test_switch_after_first_renewal(fake_stripe):
    billing, calls = fake_stripe
    sub = _sub(365)
    billing.end_first5000_after_first_renewal(sub)
    assert calls == [("sub_x", {"items": [{"id": "si_1", "price": "price_full"}], "proration_behavior": "none"})]
    assert sub["items"]["data"][0]["price"]["unit_amount"] == 4999


@pytest.mark.parametrize("plan,status", [(None, "active"), ("first5000", "canceled"), ("first5000", "past_due")])
def test_no_switch_for_other_prices_or_inactive(fake_stripe, plan, status):
    billing, calls = fake_stripe
    billing.end_first5000_after_first_renewal(_sub(365, plan, status))
    assert calls == []


# ---------- Live: requires test-user-free to hold an active FIRST5000 sub ----------
@pytest.fixture(scope="module")
def live_sub():
    me = s("test_session_free_1").get(f"{BASE_URL}/api/auth/me")
    if me.status_code != 200 or not me.json().get("first5000"):
        pytest.skip("test-user-free has no FIRST5000 sub")
    from pymongo import MongoClient
    u = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]].users.find_one({"user_id": "test-user-free"})
    return u["stripe_subscription_id"]


def _assert_clean(sub_id, cancel):
    sub = stripe.Subscription.retrieve(sub_id)
    assert sub.get("schedule") is None
    assert sub.cancel_at_period_end is cancel
    assert sub["items"]["data"][0]["price"]["unit_amount"] == 2499
    return sub


def test_renewal_cancel_and_restore(live_sub):
    c = s("test_session_free_1")
    r = c.post(f"{BASE_URL}/api/payments/renewal", json={"renew": False})
    assert r.status_code == 200, r.text
    assert r.json()["cancel_at_period_end"] is True and r.json()["renew_price"] == 24.99
    _assert_clean(live_sub, True)
    r = c.post(f"{BASE_URL}/api/payments/renewal", json={"renew": True})
    assert r.status_code == 200, r.text
    assert r.json()["cancel_at_period_end"] is False and r.json()["first5000"] is True
    _assert_clean(live_sub, False)


def _post_event(obj, etype="customer.subscription.updated"):
    payload = json.dumps({"id": "evt_test_x", "object": "event", "type": etype, "data": {"object": obj}})
    ts = int(time.time())
    sig = stripe.WebhookSignature._compute_signature(f"{ts}.{payload}", WH_SECRET)
    return requests.post(f"{BASE_URL}/api/stripe/webhook", data=payload,
                         headers={"stripe-signature": f"t={ts},v1={sig}", "Content-Type": "application/json"})


def test_webhook_bad_signature():
    r = requests.post(f"{BASE_URL}/api/stripe/webhook", data="{}", headers={"stripe-signature": "t=1,v1=bad"})
    assert r.status_code == 400


def test_webhook_subscription_updated_no_schedule(live_sub):
    obj = stripe.Subscription.retrieve(live_sub).to_dict_recursive() if hasattr(stripe.Subscription, "to_dict_recursive") else stripe.Subscription.retrieve(live_sub).to_dict()
    for _ in range(2):
        r = _post_event(obj)
        assert r.status_code == 200, r.text
    _assert_clean(live_sub, False)
    me = s("test_session_free_1").get(f"{BASE_URL}/api/auth/me").json()
    assert me["first5000"] is True and me["renew_price"] == 24.99 and me["role"] == "pro"


def test_setup_stripe_migration_skips_first5000(live_sub):
    import setup_stripe
    setup_stripe.setup()
    _assert_clean(live_sub, False)
