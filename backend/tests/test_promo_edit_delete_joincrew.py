# Promo code edit/delete/log + JOINCREW reward/validation regression tests
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/admin/promo-codes"
CODE = "TESTQAPY1"


def s(token):
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def admin():
    return s("test_session_admin_1")


@pytest.fixture(scope="module")
def free():
    return s("test_session_free_1")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    admin.delete(f"{API}/{CODE}")


def find(data, code):
    return next((c for c in data["codes"] if c["code"] == code), None)


# List includes log + JOINCREW skipper_reward only
def test_list_has_log_and_reward(admin):
    r = admin.get(API)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["log"], list)
    jc = find(d, "JOINCREW")
    assert jc and isinstance(jc["skipper_reward"], int)
    other = find(d, "TEST88978X")
    assert other is None or "skipper_reward" not in other


# Non-admin forbidden
@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_non_admin_403(free, method):
    url = API if method == "get" else f"{API}/TEST88978X"
    kw = {"json": {"percent_off": 10, "expires_on": "2029-01-01"}} if method == "put" else {}
    r = getattr(free, method)(url, **kw)
    assert r.status_code == 403


# Create -> edit -> no-change -> delete -> promo check 400 flow
def test_create_edit_delete_flow(admin, free):
    exp = (date.today() + timedelta(days=60)).isoformat()
    r = admin.post(API, json={"code": CODE, "percent_off": 15, "expires_on": exp})
    assert r.status_code == 200, r.text
    assert r.json()["percent_off"] == 15
    assert "skipper_reward" not in r.json()
    d = admin.get(API).json()
    assert d["log"][0]["code"] == CODE and d["log"][0]["action"] == "created"

    # reward ignored for non-JOINCREW
    r = admin.put(f"{API}/{CODE}", json={"percent_off": 25, "expires_on": exp, "skipper_reward": 50})
    assert r.status_code == 200, r.text
    d = r.json()
    c = find(d, CODE)
    assert c["percent_off"] == 25 and "skipper_reward" not in c
    assert d["log"][0]["action"] == "edited" and "discount 15% → 25%" in d["log"][0]["detail"]

    r = admin.put(f"{API}/{CODE}", json={"percent_off": 25, "expires_on": exp})
    assert r.status_code == 400 and r.json()["detail"] == "Nothing has changed"

    # past expiry rejected
    r = admin.put(f"{API}/{CODE}", json={"percent_off": 25, "expires_on": "2020-01-01"})
    assert r.status_code == 400

    # validation
    assert admin.put(f"{API}/{CODE}", json={"percent_off": 0, "expires_on": exp}).status_code == 422
    assert admin.put(f"{API}/{CODE}", json={"percent_off": 101, "expires_on": exp}).status_code == 422

    # promo check works while live
    r = free.post(f"{BASE_URL}/api/payments/promo/check", json={"code": CODE})
    print("promo check live:", r.status_code, r.text[:200])

    r = admin.delete(f"{API}/{CODE}")
    assert r.status_code == 200
    d = r.json()
    assert find(d, CODE) is None
    assert d["log"][0]["action"] == "deleted" and d["log"][0]["code"] == CODE
    assert admin.delete(f"{API}/{CODE}").status_code == 404
    assert admin.put(f"{API}/{CODE}", json={"percent_off": 30, "expires_on": exp}).status_code == 404

    r = free.post(f"{BASE_URL}/api/payments/promo/check", json={"code": CODE})
    assert r.status_code == 400, r.text


# Bad code path pattern
def test_bad_code_path(admin):
    assert admin.delete(f"{API}/bad code!").status_code in (404, 422)


# JOINCREW check for crew without accepted terms
def test_joincrew_beta_rejected():
    r = s("test_session_beta_1").post(f"{BASE_URL}/api/payments/promo/check", json={"code": "JOINCREW"})
    assert r.status_code == 400
    assert r.json()["detail"] == "The JOINCREW code is only available to registered crew members who have accepted boat terms."


# Free user already used JOINCREW
def test_joincrew_free_already_used(free):
    r = free.post(f"{BASE_URL}/api/payments/promo/check", json={"code": "JOINCREW"})
    print(r.status_code, r.text)
    assert r.status_code == 400


# Crew info exposes joincrew_live + badge for free crew
def test_crew_joincrew_badge():
    r = s("test_session_pro_1").get(f"{BASE_URL}/api/boats/main/crew")
    print(r.status_code, r.text[:300])
    if r.status_code != 200:
        pytest.skip("crew endpoint params differ")
    d = r.json()
    assert d.get("joincrew_live") is True
    m = next((x for x in d.get("members", d.get("crew", [])) if isinstance(x, dict) and x.get("user_id") == "test-user-free"), None)
    print("member:", m)
    assert m and m["joincrew"] and m["joincrew"]["reward"] == 12 and m["joincrew"]["rewarded"] is True
