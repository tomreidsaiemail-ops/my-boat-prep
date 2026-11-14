# Interim departures backend: BoatDetails.legs persists via sync, trimmed to last 30 per trip, oversized trimmed oldest-first
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
BOAT = "TESTlegs174"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Authorization": "Bearer test_session_admin_1", "Content-Type": "application/json"})
    yield x
    x.delete(f"{BASE_URL}/api/me/boats/{BOAT}")


def _put(s, boat):
    return s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT},
                 json={"boat": boat, "data": {}, "registry": [], "updated_at": _now(), "boat_ts": {k: _now() for k in boat}})


def _leg(i, extra=""):
    return {"id": i, "kind": "berth", "start": "TEST A", "dest": "TEST B", "depart_at": "2026-01-10T09:00",
            "finish_at": "2026-01-10T17:00", "why": "TEST why", "advice": extra, "photos": [], "at": "2026-01-10T09:00:00Z"}


# legs persist and round-trip through GET
def test_legs_persist(s):
    legs = {"routeHazards": [_leg(1), {**_leg(2), "arrived_at": "2026-01-10T17:00:00Z", "arrived_list": "Arriving at Destination"}]}
    r = _put(s, {"vessel": "TEST_Legs", "legs": legs})
    assert r.status_code == 200, r.text
    b = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()["boat"]
    assert len(b["legs"]["routeHazards"]) == 2
    assert b["legs"]["routeHazards"][1]["arrived_list"] == "Arriving at Destination"
    assert b["legs"]["routeHazards"][0]["kind"] == "berth"


# >30 legs per trip trimmed to last 30
def test_legs_trim_30(s):
    r = _put(s, {"vessel": "TEST_Legs", "legs": {"routeHazards": [_leg(i) for i in range(40)], "custom_1": [_leg(99)]}})
    assert r.status_code == 200, r.text
    b = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()["boat"]
    ids = [x["id"] for x in b["legs"]["routeHazards"]]
    assert ids == list(range(10, 40))
    assert b["legs"]["custom_1"][0]["id"] == 99


# oversized legs trimmed oldest-first, not wiped
def test_legs_oversize_trim(s):
    r = _put(s, {"vessel": "TEST_Legs", "legs": {"routeHazards": [_leg(i, "x" * 1990) for i in range(30)], "custom_1": [_leg(500, "y" * 1990) for _ in range(30)]}})
    assert r.status_code == 200, r.text
    b = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()["boat"]
    rh = b["legs"]["routeHazards"]
    assert 0 < len(rh) < 30
    assert rh[-1]["id"] == 29  # newest kept
    assert len(b["legs"]["custom_1"]) > 0


# invalid legs coerced to {} / non-list values dropped
def test_legs_invalid(s):
    r = _put(s, {"vessel": "TEST_Legs", "legs": "bad"})
    assert r.status_code == 200
    assert r.json()["boat"]["legs"] == {}
    r = _put(s, {"vessel": "TEST_Legs", "legs": {"a": "notalist", "b": [_leg(1)]}})
    assert r.status_code == 200
    assert list(r.json()["boat"]["legs"].keys()) == ["b"]
