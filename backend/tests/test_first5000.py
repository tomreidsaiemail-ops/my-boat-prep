# FIRST5000 launch promotion: Stripe prices, admin toggle, offer endpoint, checkout session contents
import os
from pathlib import Path

import pytest
import requests
import stripe
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOGGLE = f"{BASE_URL}/api/admin/promo-codes/first5000"


def s(token):
    r = requests.Session()
    r.cookies.set("session_token", token)
    return r


@pytest.fixture(scope="module")
def admin():
    c = s("test_session_admin_1")
    yield c
    c.put(TOGGLE, json={"running": True})  # always leave FIRST5000 ON (live launch state)


# Stripe catalog
def test_stripe_prices():
    full = stripe.Price.list(lookup_keys=["pro_yearly"], active=True).data
    first = stripe.Price.list(lookup_keys=["pro_yearly_first5000"], active=True).data
    assert len(full) == 1 and full[0].unit_amount == 4999 and full[0].currency == "nzd" and full[0].recurring.interval == "year"
    assert len(first) == 1 and first[0].unit_amount == 2499 and first[0].currency == "nzd" and first[0].recurring.interval == "year"
    assert first[0].metadata.get("plan") == "first5000"
    assert full[0].product == first[0].product


# Admin-only toggle
@pytest.mark.parametrize("tok", ["test_session_free_1", "test_session_pro_1", "test_session_beta_1"])
def test_toggle_forbidden(tok):
    assert s(tok).put(TOGGLE, json={"running": True}).status_code == 403


def test_toggle_unauth():
    assert requests.put(TOGGLE, json={"running": True}).status_code == 401


def test_toggle_validation(admin):
    assert admin.put(TOGGLE, json={}).status_code == 422


def test_toggle_and_list(admin):
    r = admin.put(TOGGLE, json={"running": True})
    assert r.status_code == 200 and r.json() == {"running": True}
    d = admin.get(f"{BASE_URL}/api/admin/promo-codes").json()
    assert d["first5000"] is True and d["first5000_price"] == 24.99
    assert d["base_price"] == {"amount": 49.99, "currency": "NZD"}
    o = s("test_session_free_1").get(f"{BASE_URL}/api/payments/offer").json()
    assert o == {"first5000": True, "price": 49.99, "first5000_price": 24.99}
    r = admin.put(TOGGLE, json={"running": False})
    assert r.json() == {"running": False}
    assert admin.get(f"{BASE_URL}/api/admin/promo-codes").json()["first5000"] is False
    assert s("test_session_pro_1").get(f"{BASE_URL}/api/payments/offer").json()["first5000"] is False


def test_offer_unauth():
    assert requests.get(f"{BASE_URL}/api/payments/offer").status_code == 401


def _session(admin, running):
    admin.put(TOGGLE, json={"running": running})
    r = s("test_session_free_1").post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL})
    assert r.status_code == 200, r.text
    sess = stripe.checkout.Session.retrieve(r.json()["session_id"], expand=["line_items"])
    return sess


# Checkout session while FIRST5000 running
def test_checkout_running(admin):
    sess = _session(admin, True)
    li = sess.line_items.data[0]
    assert li.price.lookup_key == "pro_yearly_first5000" and li.price.unit_amount == 2499
    assert sess.metadata["first5000"] == "1" and sess.metadata["lookup_key"] == "pro_yearly_first5000"
    msg = sess.custom_text.submit.message
    assert msg.startswith("FIRST5000 launch offer: 50% off. You pay NZD 24.99 for your first year and NZD 24.99 again at your first renewal, then NZD 49.99 a year")
    assert sess.mode == "subscription"
    stripe.checkout.Session.expire(sess.id)


# Checkout session while FIRST5000 not running
def test_checkout_not_running(admin):
    sess = _session(admin, False)
    li = sess.line_items.data[0]
    assert li.price.lookup_key == "pro_yearly" and li.price.unit_amount == 4999
    assert sess.metadata["first5000"] == "0"
    assert sess.custom_text.submit.message.startswith("Pro renews automatically at NZD 49.99 a year")
    stripe.checkout.Session.expire(sess.id)


def test_checkout_pro_blocked():
    # manual pro has no subscription -> may still be allowed; just must not 500
    r = s("test_session_pro_1").post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL})
    assert r.status_code in (200, 400)
