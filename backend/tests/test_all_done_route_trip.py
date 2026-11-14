# All-done (DEPART/ARRIVED) backend: BoatDetails route_trip + underway persistence, shore tracking/arrived guards
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
BOAT = "TESTalldone"


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Authorization": "Bearer test_session_admin_1", "Content-Type": "application/json"})
    yield x
    x.delete(f"{BASE_URL}/api/me/boats/{BOAT}")


def _put(s, boat):
    return s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json={"boat": boat, "data": {}, "registry": [], "updated_at": _now(), "boat_ts": {k: _now() for k in boat}})


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# BoatDetails accepts route_trip + underway and they persist
def test_route_trip_underway_persist(s):
    u = {"trip_id": "custom_1", "name": "Route Planning 2", "line": "TEST Mana-Picton, 1/1/2027 - 10/1/2027", "at": "2026-01-10T10:00:00Z"}
    r = _put(s, {"vessel": "TEST_AllDone", "route_trip": "custom_1", "underway": u})
    assert r.status_code == 200, r.text
    assert r.json()["boat"]["route_trip"] == "custom_1"
    g = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT})
    assert g.status_code == 200
    b = g.json()["boat"]
    assert b["route_trip"] == "custom_1"
    assert b["underway"]["line"] == u["line"]


# Clearing underway (ARRIVED) persists as {}
def test_underway_cleared(s):
    r = _put(s, {"vessel": "TEST_AllDone", "route_trip": "custom_1", "underway": {}})
    assert r.status_code == 200
    b = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()["boat"]
    assert b["underway"] == {}
    assert b["route_trip"] == "custom_1"


# Validation: too-long route_trip rejected, oversized/invalid underway coerced to {}
def test_route_trip_validation(s):
    r = _put(s, {"vessel": "TEST_AllDone", "route_trip": "x" * 81})
    assert r.status_code == 422
    r = _put(s, {"vessel": "TEST_AllDone", "underway": "notadict"})
    assert r.status_code == 200
    assert r.json()["boat"]["underway"] == {}


# Shore: no shore contact -> tracking on refused with 400; arrived when not tracking -> 400
def test_shore_guards(s):
    g = s.get(f"{BASE_URL}/api/boats/{BOAT}/shore")
    assert g.status_code == 200
    assert g.json().get("contacts", []) == []
    t = s.put(f"{BASE_URL}/api/boats/{BOAT}/shore/tracking", json={"on": True})
    assert t.status_code == 400
    a = s.post(f"{BASE_URL}/api/boats/{BOAT}/shore/arrived")
    assert a.status_code == 400


def test_shore_unauth():
    assert requests.post(f"{BASE_URL}/api/boats/{BOAT}/shore/arrived").status_code == 401
