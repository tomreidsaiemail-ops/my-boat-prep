# Promo codes admin API + checkout allow_promotion_codes regression
import os
import time
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/admin/promo-codes"
FUTURE = (date.today() + timedelta(days=60)).isoformat()
CODE = f"TEST{int(time.time()) % 100000}x"


def s(token):
    r = requests.Session()
    r.cookies.set("session_token", token)
    return r


@pytest.fixture(scope="module")
def admin():
    return s("test_session_admin_1")


# Admin-only guard
@pytest.mark.parametrize("tok", ["test_session_free_1", "test_session_pro_1", "test_session_beta_1"])
def test_non_admin_forbidden(tok):
    c = s(tok)
    assert c.get(API).status_code == 403
    assert c.post(API, json={"code": "TESTNOPE", "percent_off": 10, "expires_on": FUTURE}).status_code == 403


def test_unauth_401():
    assert requests.get(API).status_code == 401


# List shape
def test_list(admin):
    r = admin.get(API)
    assert r.status_code == 200
    d = r.json()
    assert d["base_price"] == {"amount": 9.99, "currency": "NZD"}
    assert isinstance(d["codes"], list)
    t = [c for c in d["codes"] if c["code"] == "TESTMBP25"]
    assert t and t[0]["percent_off"] == 25 and t[0]["active"] is True
    created = [c["created_at"] for c in d["codes"]]
    assert created == sorted(created, reverse=True)


# Validation
@pytest.mark.parametrize("code", ["AB", "HAS SPACE", "BAD$CODE", "X" * 31])
def test_invalid_code(admin, code):
    r = admin.post(API, json={"code": code, "percent_off": 10, "expires_on": FUTURE})
    assert r.status_code in (400, 422), r.text


@pytest.mark.parametrize("pct", [0, -5, 100.5, 150])
def test_invalid_percent(admin, pct):
    assert admin.post(API, json={"code": "TESTPCT", "percent_off": pct, "expires_on": FUTURE}).status_code == 422


def test_past_expiry(admin):
    past = (date.today() - timedelta(days=3)).isoformat()
    r = admin.post(API, json={"code": "TESTPAST", "percent_off": 10, "expires_on": past})
    assert r.status_code == 400 and "expiry" in r.json()["detail"].lower()


def test_duplicate_existing(admin):
    r = admin.post(API, json={"code": "testmbp25", "percent_off": 10, "expires_on": FUTURE})
    assert r.status_code == 400 and "already exists" in r.json()["detail"]


# Create -> list -> duplicate
def test_create_and_list(admin):
    r = admin.post(API, json={"code": CODE.lower(), "percent_off": 15, "expires_on": FUTURE})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["code"] == CODE.upper()
    assert d["percent_off"] == 15 and d["times_redeemed"] == 0 and d["active"] is True
    assert d["expires_at"].startswith((date.fromisoformat(FUTURE)).isoformat()) and d["expires_at"].endswith("+00:00")
    lst = admin.get(API).json()["codes"]
    assert lst[0]["code"] == CODE.upper() and lst[0]["times_redeemed"] == 0 and lst[0]["active"] is True
    dup = admin.post(API, json={"code": CODE.upper(), "percent_off": 20, "expires_on": FUTURE})
    assert dup.status_code == 400


# Checkout regression
def test_checkout_free():
    r = s("test_session_free_1").post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL})
    assert r.status_code == 200, r.text
    assert "checkout.stripe.com" in r.json()["checkout_url"]
