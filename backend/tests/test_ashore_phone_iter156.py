# Iteration 156: ashore_since on land pings, /crew-register/my-phone, /shore/track skipper + skipper_phone, /shore/arrived guard
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
SHORE = {"Authorization": "Bearer test_session_shore_1"}
LAND = (-39.60, 175.60)   # inland North Island (Taihape area)
WATER = (-36.60, 175.00)  # Hauraki Gulf


def _trip():
    r = requests.get(f"{BASE_URL}/api/boats/main/shore", headers=PRO, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _ping(trip_id, lat, lon):
    return requests.post(f"{BASE_URL}/api/track/points", headers=PRO, timeout=60, json={
        "boat_id": "main", "trip_id": trip_id, "points": [{"lat": lat, "lon": lon, "at": int(time.time() * 1000), "kind": "ping"}]})


@pytest.fixture(scope="module")
def trip_id():
    r = requests.get(f"{BASE_URL}/api/boats/main/shore", headers=PRO, timeout=30)
    assert r.status_code == 200
    t = r.json().get("tracking") or {}
    if not t.get("on"):
        pytest.skip(f"tracking not on for main: {t}")
    return t["trip_id"]


# Land pings set ashore_since once; water clears it
class TestAshoreSince:
    def test_land_sets_then_unchanged_then_water_clears(self, trip_id):
        r0 = _ping(trip_id, *WATER)
        assert r0.status_code == 200, r0.text
        assert r0.json()["tracking"].get("ashore_since") is None
        r1 = _ping(trip_id, *LAND)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["ashore"] is True, d1
        s1 = d1["tracking"].get("ashore_since")
        assert isinstance(s1, str) and s1
        time.sleep(1.5)
        r2 = _ping(trip_id, *LAND)
        assert r2.json()["tracking"]["ashore_since"] == s1
        r3 = _ping(trip_id, *WATER)
        d3 = r3.json()
        assert d3["ashore"] is False
        assert d3["tracking"].get("ashore_since") is None
        r4 = _ping(trip_id, *LAND)
        assert r4.json()["tracking"]["ashore_since"] != s1  # fresh period
        _ping(trip_id, *WATER)


# my-phone from crew_register
class TestMyPhone:
    def test_my_phone_pro_blank(self):
        r = requests.get(f"{BASE_URL}/api/crew-register/my-phone", headers=PRO, timeout=30)
        assert r.status_code == 200
        assert "phone" in r.json()

    def test_my_phone_unauth(self):
        r = requests.get(f"{BASE_URL}/api/crew-register/my-phone", timeout=30)
        assert r.status_code == 401


# Shore track exposes skipper + phone
class TestShoreTrack:
    def test_shore_track_fields(self):
        r = requests.get(f"{BASE_URL}/api/shore/track?owner_id=test-user-pro&boat_id=main", headers=SHORE, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["skipper"] == "TEST_Skipper"
        assert "skipper_phone" in d and isinstance(d["skipper_phone"], str)

    def test_shore_track_forbidden_other(self):
        r = requests.get(f"{BASE_URL}/api/shore/track?owner_id=test-user-free&boat_id=main", headers=SHORE, timeout=30)
        assert r.status_code == 404


# Arrived guard
class TestArrived:
    def test_arrived_unknown_boat(self):
        r = requests.post(f"{BASE_URL}/api/boats/nope_{uuid.uuid4().hex[:6]}/shore/arrived", headers=PRO, timeout=30)
        assert r.status_code == 404
