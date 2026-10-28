# MPA (Marine Magic Provisioning Assistant) backend: POST /api/ai/mpa/provisions
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/ai/mpa/provisions"
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
BODY = {"items": ["Drinking water", "Bread", "Milk"], "on_board": {"Bread": 2}, "adults": 2, "children": 2, "days": 5}


# Pro user gets AI amounts keyed by the input names
def test_pro_provisions_amounts():
    r = requests.post(URL, json=BODY, headers=PRO, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d["amounts"], dict) and d["amounts"]
    assert set(d["amounts"]).issubset(set(BODY["items"]))
    assert all(isinstance(v, str) and v for v in d["amounts"].values())
    assert isinstance(d["drafts_left"], int)
    print(d)


# Free tier blocked
def test_free_forbidden():
    r = requests.post(URL, json=BODY, headers=FREE, timeout=30)
    assert r.status_code == 403


# No auth
def test_unauth():
    r = requests.post(URL, json=BODY, timeout=30)
    assert r.status_code == 401


# Validation
@pytest.mark.parametrize("patch", [{"items": []}, {"days": 0}, {"adults": -1}, {"days": 366}])
def test_validation_422(patch):
    r = requests.post(URL, json={**BODY, **patch}, headers=PRO, timeout=30)
    assert r.status_code == 422, r.text


# Whitespace-only items pass min_length then trim to [] -> should not call AI
def test_blank_items():
    r = requests.post(URL, json={**BODY, "items": ["  "]}, headers=PRO, timeout=120)
    print("blank items status", r.status_code, r.text[:200])
    assert r.status_code == 422
