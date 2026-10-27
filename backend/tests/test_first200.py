# FIRST200 launch: admin toggle mutual exclusion with FIRST5000, everyone Pro free, checkout blocked, offer flags
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PROMO = f"{BASE_URL}/api/admin/promo-codes"


def s(token):
    r = requests.Session()
    r.cookies.set("session_token", token)
    return r


@pytest.fixture(scope="module")
def admin():
    c = s("test_session_admin_1")
    yield c
    # always restore: FIRST5000 ON, FIRST200 OFF
    c.put(f"{PROMO}/first5000", json={"running": True})
    c.put(f"{PROMO}/first200", json={"running": False})


@pytest.mark.parametrize("tok", ["test_session_free_1", "test_session_pro_1"])
def test_first200_toggle_admin_only(tok):
    assert s(tok).put(f"{PROMO}/first200", json={"running": True}).status_code == 403


def test_first200_unauth():
    assert requests.put(f"{PROMO}/first200", json={"running": True}).status_code == 401


def test_mutual_exclusion_and_persistence(admin):
    r = admin.put(f"{PROMO}/first200", json={"running": True})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["first200"] is True and d["first5000"] is False
    g = admin.get(PROMO).json()
    assert g["first200"] is True and g["first5000"] is False
    r = admin.put(f"{PROMO}/first5000", json={"running": True})
    d = r.json()
    assert d["first5000"] is True and d["first200"] is False
    g = admin.get(PROMO).json()
    assert g["first200"] is False and g["first5000"] is True


def test_first200_everyone_pro(admin):
    assert admin.put(f"{PROMO}/first200", json={"running": True}).json()["first200"] is True
    time.sleep(11)
    free = s("test_session_free_1")
    me = free.get(f"{BASE_URL}/api/auth/me").json()
    assert me["premium"] is True and me["launch_free"] is True and me["role"] == "free"
    pro_me = s("test_session_pro_1").get(f"{BASE_URL}/api/auth/me").json()
    assert pro_me["premium"] is True and pro_me["launch_free"] is True
    # checkout blocked
    r = free.post(f"{BASE_URL}/api/payments/checkout", json={"origin_url": BASE_URL})
    assert r.status_code == 400 and "FIRST200" in r.json()["detail"]
    # offer flags
    pub = requests.get(f"{BASE_URL}/api/payments/offer/public").json()
    assert pub["first200"] is True and pub["first5000"] is False
    off = free.get(f"{BASE_URL}/api/payments/offer").json()
    assert off["first200"] is True
    # premium-gated endpoint accessible for free user (require_premium) - zone-map list via shared inventory is not gated; use ai list draft validation
    r = free.post(f"{BASE_URL}/api/ai/list-draft", json={})
    assert r.status_code != 403, f"free user still blocked by require_premium: {r.status_code} {r.text[:200]}"


def test_back_to_first5000_free_not_premium(admin):
    d = admin.put(f"{PROMO}/first5000", json={"running": True}).json()
    assert d["first5000"] is True and d["first200"] is False
    time.sleep(11)
    me = s("test_session_free_1").get(f"{BASE_URL}/api/auth/me").json()
    assert me["premium"] is False and me["launch_free"] is False
    pub = requests.get(f"{BASE_URL}/api/payments/offer/public").json()
    assert pub["first200"] is False and pub["first5000"] is True
    pro_me = s("test_session_pro_1").get(f"{BASE_URL}/api/auth/me").json()
    assert pro_me["premium"] is True and pro_me["launch_free"] is False
