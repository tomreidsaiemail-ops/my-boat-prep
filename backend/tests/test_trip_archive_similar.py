# Create Similar Trip: POST /trip-archives/{id}/similar keeps archive, re-adds crew, no RSVPs/invites; restore unchanged
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
TB = "TEST_sim_boat"
URL = f"{BASE_URL}/api/boats/{TB}/trip-archives"


def _db():
    return MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


def _boat():
    return _db().user_boats.find_one({"owner_id": "test-user-pro", "boat_id": TB}, {"_id": 0})


def payload(trip):
    return {"email_shore": False, "email_crew": False, "trip_id": trip, "name": "TEST_Trip Planning",
            "items": [{"id": "a", "label": "A", "checked": True}, {"id": "b", "label": "B", "checked": False}],
            "details": {"route_start": "TEST_Start", "route_dest": "TEST_Dest", "weather": {"event_name": "TEST_Old", "depart_at": "2026-01-01T08:00", "actual_finish_at": "2026-01-02T09:00"}},
            "depart_at": "2026-01-01T08:00", "finish_at": "2026-01-02T08:00", "window": {"start": None, "end": None}}


@pytest.fixture(autouse=True, scope="module")
def boat():
    db = _db()
    db.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})
    db.user_boats.insert_one({"owner_id": "test-user-pro", "boat_id": TB, "boat": {"name": "TEST sim"},
                              "crew": ["test-user-free", "test-user-beta"],
                              "crew_names": {"test-user-free": "TEST Solo", "test-user-beta": "TEST Both"},
                              "crew_roles": {"test-user-free": ["cook"]}, "agreements": {"test-user-free": {"ok": True}},
                              "crew_trips": {"test-user-free": ["custom_x"], "test-user-beta": ["custom_x", "custom_y"]},
                              "trip_rsvp": {"custom_x": {"test-user-free": {"status": "in"}, "test-user-beta": {"status": "maybe"}}},
                              "trip_notes": {"custom_x": "TEST notes"}})
    db.crew_invites.insert_one({"invite_id": "TEST_inv_sim_1", "owner_id": "test-user-pro", "boat_id": TB, "trip_id": "custom_x",
                                "email": "test_sim_inv@example.com", "email_key": "test_sim_inv@example.com", "name": "TEST Invitee"})
    yield
    db.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})
    db.crew_invites.delete_many({"owner_id": "test-user-pro", "boat_id": TB})
    db.trip_archives.delete_many({"owner_id": "test-user-pro", "boat_id": TB})


class TestSimilar:
    def test_similar_then_restore(self):
        r = requests.post(URL, json=payload("custom_x"), headers=PRO)
        assert r.status_code == 200, r.text
        aid = r.json()["archive_id"]
        d = _boat()
        assert d["crew"] == ["test-user-beta"]  # free removed fully, beta still on custom_y
        # other user cannot
        assert requests.post(f"{URL}/{aid}/similar", json={"to_trip_id": "custom_x"}, headers=FREE).status_code == 404
        s = requests.post(f"{URL}/{aid}/similar", json={"to_trip_id": "custom_x"}, headers=PRO)
        assert s.status_code == 200, s.text
        sj = s.json()
        assert sj["to_trip_id"] == "custom_x" and sj["name"] == "TEST_Trip Planning" and sj["crew"] == 2
        assert len(sj["items"]) == 2 and sj["details"]["route_start"] == "TEST_Start"
        assert sj["details"]["weather"]["event_name"] == "TEST_Old"
        d = _boat()
        assert set(d["crew"]) == {"test-user-free", "test-user-beta"}
        assert d["crew_trips"]["test-user-free"] == ["custom_x"]
        assert set(d["crew_trips"]["test-user-beta"]) == {"custom_x", "custom_y"}
        assert d["crew_roles"]["test-user-free"] == ["cook"] and d["crew_names"]["test-user-free"] == "TEST Solo"
        assert not ((d.get("trip_rsvp") or {}).get("custom_x") or {}), d.get("trip_rsvp")
        assert _db().crew_invites.count_documents({"owner_id": "test-user-pro", "boat_id": TB}) == 0  # invites not carried
        assert (d.get("trip_notes") or {}).get("custom_x") == "TEST notes"
        # archive kept
        lst = requests.get(URL, headers=PRO).json()["archives"]
        assert any(a["archive_id"] == aid for a in lst)
        assert requests.get(f"{URL}/{aid}", headers=PRO).status_code == 200
        # second similar still works (idempotent crew)
        s2 = requests.post(f"{URL}/{aid}/similar", json={"to_trip_id": "custom_x"}, headers=PRO)
        assert s2.status_code == 200
        assert _boat()["crew_trips"]["test-user-free"] == ["custom_x"]
        # restore unchanged: deletes archive, brings RSVP + invite
        rr = requests.post(f"{URL}/{aid}/restore", json={"to_trip_id": "custom_x"}, headers=PRO)
        assert rr.status_code == 200 and rr.json()["invites"] == 1 and len(rr.json()["details"]) > 0
        d = _boat()
        assert d["trip_rsvp"]["custom_x"]["test-user-free"]["status"] == "in"
        assert requests.get(f"{URL}/{aid}", headers=PRO).status_code == 404
        assert all(a["archive_id"] != aid for a in requests.get(URL, headers=PRO).json()["archives"])

    def test_similar_404_and_validation(self):
        assert requests.post(f"{URL}/{uuid.uuid4()}/similar", json={"to_trip_id": "custom_x"}, headers=PRO).status_code == 404
        assert requests.post(f"{URL}/not-a-uuid/similar", json={"to_trip_id": "custom_x"}, headers=PRO).status_code == 422
        assert requests.post(f"{URL}/{uuid.uuid4()}/similar", json={"to_trip_id": "bad id!"}, headers=PRO).status_code == 422
        assert requests.post(f"{URL}/{uuid.uuid4()}/similar", json={"to_trip_id": "custom_x"}).status_code == 401
