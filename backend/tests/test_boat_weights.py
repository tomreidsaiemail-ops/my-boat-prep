# Racing weight: boat_weight / crew_weight on BoatDetails (TANK_FIELDS number validation) and unit_g on area items via PUT/GET /api/me/boat.
# Needs: python3 backend/tests/manual_it97_weights_seed.py (TEST_it97_f user); re-seed after running.
import os
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    from dotenv import dotenv_values
    BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
TOKEN = "test_session_it97_f"


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    r = x.get(f"{BASE_URL}/api/me/boat")
    if r.status_code != 200:
        pytest.skip(f"seed missing: {r.status_code}")
    return x


def put(s, **boat):
    st = s.get(f"{BASE_URL}/api/me/boat").json()
    st["boat"].update(boat)
    st["updated_at"] = datetime.now(timezone.utc).isoformat()
    body = {k: st[k] for k in ("boat", "registry", "data", "updated_at", "engine_log", "areas")}
    return s.put(f"{BASE_URL}/api/me/boat", json=body)


@pytest.mark.parametrize("val,exp", [("5000.5", "5000.5"), ("1,5", "1.5"), ("abc", ""), ("123456", "123456"), ("1234567", ""), ("-5", ""), ("", ""), (85, "85")])
def test_weight_validation(s, val, exp):
    r = put(s, boat_weight=val, crew_weight=val)
    assert r.status_code == 200, r.text
    assert r.json()["boat"]["boat_weight"] == exp
    assert r.json()["boat"]["crew_weight"] == exp
    g = s.get(f"{BASE_URL}/api/me/boat").json()["boat"]
    assert g["boat_weight"] == exp and g["crew_weight"] == exp


def test_weights_persist_and_unit_g_kept(s):
    st = s.get(f"{BASE_URL}/api/me/boat").json()
    st["boat"].update({"boat_weight": "10000", "crew_weight": "190"})
    st["areas"] = [{"id": "a_t", "name": "TEST Fridge", "food": True, "items": [{"id": "x1", "name": "Milk", "qty": 2, "unit_g": 1000}]}]
    st["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = s.put(f"{BASE_URL}/api/me/boat", json={k: st[k] for k in ("boat", "registry", "data", "updated_at", "engine_log", "areas")})
    assert r.status_code == 200
    g = s.get(f"{BASE_URL}/api/me/boat").json()
    assert g["boat"]["boat_weight"] == "10000" and g["boat"]["crew_weight"] == "190"
    assert g["areas"][0]["items"][0]["unit_g"] == 1000


def test_no_auth_401():
    assert requests.get(f"{BASE_URL}/api/me/boat").status_code == 401
