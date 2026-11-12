# Iteration 155: shore alert "I've seen it", crew shore_ok_at, trip summary email (temp boat), trip map jpg, agreement PDF
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
SHORE = {"Authorization": "Bearer test_session_shore_1"}
BETA = {"Authorization": "Bearer test_session_beta_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
TB = "TEST_sum2"
STATE = {}


def _db():
    return MongoClient("mongodb://localhost:27017")["test_database"]


@pytest.fixture(scope="module", autouse=True)
def temp_boat():
    d = _db()
    d.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})
    d.user_boats.insert_one({"owner_id": "test-user-pro", "boat_id": TB, "crew": [], "shore": {}, "shore_ids": [], "boat": {"vessel": "TEST_Sum Boat"}})
    now = datetime.now(timezone.utc)
    pts = [{"trip_id": "TEST_sum2_trip", "owner_id": "test-user-pro", "boat_id": TB, "lat": -36.84 + i * 0.01, "lon": 174.76 + i * 0.01,
            "at": (now - timedelta(hours=3 - i)).isoformat(), "kind": "fix"} for i in range(3)]
    d.track_points.insert_many(pts)
    yield
    ids = STATE.get("archives", [])
    d.trip_maps.delete_many({"archive_id": {"$in": ids}})
    d.trip_archives.delete_many({"archive_id": {"$in": ids}, "owner_id": "test-user-pro", "boat_id": TB})
    d.track_points.delete_many({"trip_id": "TEST_sum2_trip", "boat_id": TB})
    d.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})


def _archive(**kw):
    body = {"trip_id": "routeHazards", "name": "TEST_Summary trip", "items": [{"id": "a", "checked": True}],
            "details": {"route_start": "TEST_A", "route_dest": "TEST_B"}, "window": {"start": None, "end": None}, **kw}
    r = requests.post(f"{BASE_URL}/api/boats/{TB}/trip-archives", json=body, headers=PRO)
    assert r.status_code == 200, r.text
    aid = r.json()["archive_id"]
    STATE.setdefault("archives", []).append(aid)
    return aid, r.json()


# Shore alert seen
class TestShoreSeen:
    def test_seen_flow(self):
        aid = str(uuid.uuid4())
        STATE["alert"] = aid
        r = requests.post(f"{BASE_URL}/api/shore/alert", json={"boat_id": "main", "alert_id": aid, "kind": "panPan", "at": int(time.time() * 1000)}, headers=PRO)
        assert r.status_code == 200, r.text
        assert r.json()["alert"]["state"] == "active" and r.json()["alert"]["alert_id"] == aid
        body = {"owner_id": "test-user-pro", "boat_id": "main", "alert_id": aid}
        r1 = requests.post(f"{BASE_URL}/api/shore/alert/seen", json=body, headers=BETA)
        assert r1.status_code == 200, r1.text
        seen = r1.json()["alert"]["seen"]
        assert len(seen) == 1 and seen[0]["by"] == "test-user-beta" and seen[0]["name"] and seen[0]["at"]
        r2 = requests.post(f"{BASE_URL}/api/shore/alert/seen", json=body, headers=BETA)
        assert r2.status_code == 200 and len(r2.json()["alert"]["seen"]) == 1  # idempotent

    def test_seen_non_shore_404(self):
        body = {"owner_id": "test-user-pro", "boat_id": "main", "alert_id": STATE["alert"]}
        r = requests.post(f"{BASE_URL}/api/shore/alert/seen", json=body, headers=FREE)
        assert r.status_code == 404
        r = requests.post(f"{BASE_URL}/api/shore/alert/seen", json={**body, "owner_id": ""}, headers=BETA)
        assert r.status_code in (404, 422)

    def test_seen_wrong_alert_id_no_push(self):
        body = {"owner_id": "test-user-pro", "boat_id": "main", "alert_id": str(uuid.uuid4())}
        r = requests.post(f"{BASE_URL}/api/shore/alert/seen", json=body, headers=SHORE)
        assert r.status_code == 200
        assert not any(s["by"] == "test-shore-only" for s in r.json()["alert"].get("seen") or [])

    def test_skipper_sees_seen(self):
        r = requests.get(f"{BASE_URL}/api/shore/alert", params={"boat_id": "main"}, headers=PRO)
        assert r.status_code == 200
        a = r.json()["alert"]
        assert a["alert_id"] == STATE["alert"] and [s["by"] for s in a["seen"]] == ["test-user-beta"]

    def test_unauth(self):
        r = requests.post(f"{BASE_URL}/api/shore/alert/seen", json={"owner_id": "test-user-pro", "boat_id": "main", "alert_id": STATE["alert"]})
        assert r.status_code == 401


# Crew list: shore contact count + shore_ok_at
class TestCrewShoreOk:
    def test_crew_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/boats/main/crew", headers=PRO)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("shore_contacts") == 2
        crew = {c.get("user_id"): c for c in d.get("crew", [])}
        assert (crew["test-user-free"].get("agreement") or {}).get("shore_ok_at")
        assert not (crew["test-user-beta"].get("agreement") or {}).get("shore_ok_at")


# Agreement PDF
class TestAgreementPdf:
    def test_pdf(self):
        r = requests.get(f"{BASE_URL}/api/crew/agreement/pdf", params={"boat_id": "main", "member_id": "test-user-free"}, headers=PRO)
        assert r.status_code == 200, r.text[:300]
        assert r.content[:4] == b"%PDF"


# Trip summary email on temp boat
class TestTripSummary:
    def test_archive_stores_summary_flags(self):
        aid, s = _archive(email_shore=False, email_crew=True)
        doc = _db().trip_archives.find_one({"archive_id": aid}, {"_id": 0, "summary": 1, "stats": 1})
        assert doc["summary"]["shore"] is False and doc["summary"]["crew"] is True and doc["summary"]["due_at"]
        assert "sent_at" not in doc["summary"]
        assert doc["stats"]["points"] == 3 and doc["stats"]["distance_nm"] > 0
        STATE["send"] = aid

    def test_defaults_true_and_restore_cancels(self):
        aid, _ = _archive()
        doc = _db().trip_archives.find_one({"archive_id": aid}, {"_id": 0, "summary": 1})
        assert doc["summary"]["shore"] is True and doc["summary"]["crew"] is True
        r = requests.post(f"{BASE_URL}/api/boats/{TB}/trip-archives/{aid}/restore", json={"to_trip_id": "routeHazards"}, headers=PRO)
        assert r.status_code == 200, r.text
        STATE["restored"] = aid

    def test_delete_cancels(self):
        aid, _ = _archive(email_shore=True, email_crew=False)
        r = requests.delete(f"{BASE_URL}/api/boats/{TB}/trip-archives/{aid}", headers=PRO)
        assert r.status_code == 200
        STATE["deleted"] = aid

    def test_sent_after_3_min(self):
        aid = STATE["send"]
        deadline = time.time() + 240
        doc = None
        while time.time() < deadline:
            doc = _db().trip_archives.find_one({"archive_id": aid}, {"_id": 0, "summary": 1})
            if (doc["summary"] or {}).get("sent_at"):
                break
            time.sleep(10)
        assert doc["summary"].get("sent_at"), doc
        assert doc["summary"].get("to") == 1  # skipper only (no shore/crew on temp boat)
        due = datetime.fromisoformat(doc["summary"]["due_at"])
        sent = datetime.fromisoformat(doc["summary"]["sent_at"])
        assert (sent - due).total_seconds() >= 175
        m = _db().trip_maps.find_one({"archive_id": aid}, {"_id": 0, "key": 1})
        assert m, "map not stored"
        r = requests.get(f"{BASE_URL}/api/trip-map/{m['key']}.jpg")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/jpeg") and r.content[:2] == b"\xff\xd8"
        assert len(r.content) > 5000

    def test_restored_deleted_never_sent(self):
        d = _db()
        assert d.trip_archives.find_one({"archive_id": {"$in": [STATE["restored"], STATE["deleted"]]}}) is None
        assert d.trip_maps.find_one({"archive_id": {"$in": [STATE["restored"], STATE["deleted"]]}}) is None

    def test_map_404(self):
        r = requests.get(f"{BASE_URL}/api/trip-map/{'x' * 32}.jpg")
        assert r.status_code == 404
