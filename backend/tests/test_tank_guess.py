# Magic Marine Navigator tank/battery guess: POST /api/ai/tank-guess validation, tier gate, one live call, and parser unit tests
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/ai/tank-guess"
PRO = {"session_token": "test_session_pro_1"}
FREE = {"session_token": "test_session_free_1"}
GOOD = {"make": "Beneteau", "model": "Oceanis 38", "year_built": "2014", "units": "m", "tank_units": "L"}

sys.path.insert(0, "/app/backend")


# Validation (422s) - no LLM call made
@pytest.mark.parametrize("body", [
    {**GOOD, "make": ""},
    {k: v for k, v in GOOD.items() if k != "model"},
    {**GOOD, "year_built": "14"},
    {**GOOD, "year_built": "20145"},
    {**GOOD, "year_built": "abcd"},
    {**GOOD, "units": "yd"},
    {**GOOD, "tank_units": "kg"},
])
def test_validation_422(body):
    r = requests.post(URL, json=body, cookies=PRO, timeout=20)
    assert r.status_code == 422, r.text


# Tier gate
def test_non_premium_403():
    me = requests.get(f"{BASE_URL}/api/auth/me", cookies=FREE, timeout=20).json()
    if me.get("premium"):
        pytest.skip("test-user-free is premium via FIRST200 launch promo; 403 path not reachable")
    r = requests.post(URL, json=GOOD, cookies=FREE, timeout=20)
    assert r.status_code == 403
    assert "Pro" in r.json().get("detail", "")


def test_unauthenticated_401():
    r = requests.post(URL, json=GOOD, timeout=20)
    assert r.status_code == 401


# One live call (uses one Magic ask)
def test_pro_live_guess():
    r = requests.post(URL, json={**GOOD, "boat_type": "Sailing yacht", "loa": "11.5"}, cookies=FREE, timeout=90)
    if r.status_code == 429:
        pytest.skip("Magic asks used up for this user")
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["fuel", "water", "lpg_bottles", "lpg_kg", "house_ah", "asks_left"]:
        assert k in d
    assert isinstance(d["lpg_bottles"], int) and isinstance(d["house_ah"], int)
    assert 0 < d["fuel"] <= 20000 and 0 < d["water"] <= 20000
    print("guess:", d)


# parse_tanks unit tests
def test_parse_tanks_clamps_and_rounds():
    from ai_lists import parse_tanks
    out = parse_tanks('```json\n{"fuel": 130.44, "water": 99999, "lpg_bottles": 2.7, "lpg_kg": 4.5, "house_ah": 280}\n```')
    assert out == {"fuel": 130.4, "water": 0, "lpg_bottles": 2, "lpg_kg": 4.5, "house_ah": 280}


def test_parse_tanks_all_zero_raises():
    from ai_lists import parse_tanks
    with pytest.raises(ValueError):
        parse_tanks('{"fuel": 0, "water": 0, "lpg_bottles": 0, "lpg_kg": 0, "house_ah": 0}')
    with pytest.raises(ValueError):
        parse_tanks("no json here")
