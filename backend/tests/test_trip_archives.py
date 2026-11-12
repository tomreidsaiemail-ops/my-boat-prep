# Trip archiving & reset: archive / list / detail / restore / delete / owner scoping
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
MAIN = f"{BASE_URL}/api/boats/main/trip-archives"
TB = "TEST_arch_boat"
TBURL = f"{BASE_URL}/api/boats/{TB}/trip-archives"


def _db():
    return MongoClient("mongodb://localhost:27017")["test_database"]


def _crew_state():
    d = _db().user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0, "crew": 1, "crew_trips": 1, "crew_names": 1, "trip_rsvp": 1, "trip_notes": 1})
    return d


@pytest.fixture(scope="module")
def created():
    ids = []
    yield ids
    for b, a in ids:
        requests.delete(f"{BASE_URL}/api/boats/{b}/trip-archives/{a}", headers=PRO)


def payload(trip="routeHazards"):
    return {"email_shore": False, "email_crew": False, "trip_id": trip, "name": "TEST_Route Planning", "items": [{"id": "a", "checked": True}, {"id": "b", "checked": False}],
            "details": {"route_start": "TEST_Start", "route_dest": "TEST_Dest"}, "depart_at": "2026-01-01T08:00", "finish_at": "2026-01-02T08:00",
            "window": {"start": None, "end": None}}


class TestMainBoatArchiveRestore:
    def test_archive_restore_cycle_routeHazards(self, created):
        before = _crew_state()
        r = requests.post(MAIN, json=payload(), headers=PRO)
        assert r.status_code == 200, r.text
        s = r.json()
        aid = s["archive_id"]
        created.append(("main", aid))
        st = s["stats"]
        for k in ("ticked", "total", "crew", "invites", "points", "distance_nm"):
            assert k in st
        assert st["ticked"] == 1 and st["total"] == 2 and st["crew"] == 2
        assert s["route_start"] == "TEST_Start"
        mid = _crew_state()
        assert mid["crew"] == ["test-user-free", "test-user-beta"]  # still on custom_trip2
        assert mid["crew_trips"]["test-user-free"] == ["custom_trip2"]
        assert mid["crew_trips"]["test-user-beta"] == ["custom_trip2"]
        # list
        lst = requests.get(MAIN, headers=PRO).json()["archives"]
        assert lst[0]["archive_id"] == aid
        # detail
        d = requests.get(f"{MAIN}/{aid}", headers=PRO)
        assert d.status_code == 200
        dj = d.json()
        assert len(dj["items"]) == 2 and dj["details"]["route_dest"] == "TEST_Dest"
        assert {c["name"] for c in dj["crew"]} == {"TEST Free Crew", "Beta Crew"}
        assert isinstance(dj["path"], list)
        # free user cannot see/restore/delete
        assert requests.get(MAIN, headers=FREE).json()["archives"] == [] or all(a["archive_id"] != aid for a in requests.get(MAIN, headers=FREE).json()["archives"])
        assert requests.get(f"{MAIN}/{aid}", headers=FREE).status_code == 404
        assert requests.post(f"{MAIN}/{aid}/restore", json={"to_trip_id": "routeHazards"}, headers=FREE).status_code == 404
        requests.delete(f"{MAIN}/{aid}", headers=FREE)
        assert requests.get(f"{MAIN}/{aid}", headers=PRO).status_code == 200
        # restore
        rr = requests.post(f"{MAIN}/{aid}/restore", json={"to_trip_id": "routeHazards"}, headers=PRO)
        assert rr.status_code == 200, rr.text
        rj = rr.json()
        assert rj["to_trip_id"] == "routeHazards" and len(rj["items"]) == 2 and rj["crew"] == 2
        after = _crew_state()
        assert set(after["crew_trips"]["test-user-free"]) == set(before["crew_trips"]["test-user-free"])
        assert set(after["crew_trips"]["test-user-beta"]) == set(before["crew_trips"]["test-user-beta"])
        assert requests.get(f"{MAIN}/{aid}", headers=PRO).status_code == 404

    def test_archive_restore_custom_trip2_rsvp_notes(self, created):
        before = _crew_state()
        r = requests.post(MAIN, json=payload("custom_trip2"), headers=PRO)
        assert r.status_code == 200
        aid = r.json()["archive_id"]
        created.append(("main", aid))
        mid = _crew_state()
        assert "custom_trip2" not in (mid.get("trip_rsvp") or {}) or not mid["trip_rsvp"]["custom_trip2"]
        assert "custom_trip2" not in (mid.get("trip_notes") or {})
        dj = requests.get(f"{MAIN}/{aid}", headers=PRO).json()
        assert dj["notes"] == before["trip_notes"]["custom_trip2"]
        assert any(c["rsvp"] == "in" for c in dj["crew"])
        rr = requests.post(f"{MAIN}/{aid}/restore", json={"to_trip_id": "custom_trip2"}, headers=PRO)
        assert rr.status_code == 200
        after = _crew_state()
        assert after["trip_rsvp"]["custom_trip2"]["test-user-free"]["status"] == "in"
        assert after["trip_notes"]["custom_trip2"] == before["trip_notes"]["custom_trip2"]
        for m in ("test-user-free", "test-user-beta"):
            assert set(after["crew_trips"][m]) == set(before["crew_trips"][m])

    def test_delete_archive(self, created):
        # archive a trip nobody is on, then delete
        r = requests.post(MAIN, json=payload("TEST_notrip"), headers=PRO)
        assert r.status_code == 200
        aid = r.json()["archive_id"]
        assert r.json()["stats"]["crew"] == 0
        assert requests.delete(f"{MAIN}/{aid}", headers=PRO).status_code == 200
        assert requests.get(f"{MAIN}/{aid}", headers=PRO).status_code == 404

    def test_validation(self):
        assert requests.post(MAIN, json={"trip_id": "bad id!", "name": "x"}, headers=PRO).status_code == 422
        assert requests.post(MAIN, json={"trip_id": "x", "name": ""}, headers=PRO).status_code == 422
        assert requests.get(f"{MAIN}/not-a-uuid", headers=PRO).status_code == 422
        assert requests.get(MAIN).status_code == 401
        assert requests.post(f"{BASE_URL}/api/boats/nope_boat/trip-archives", json=payload(), headers=PRO).status_code == 404


class TestFullRemovalAndReAdd:
    """Crew member whose only trip is archived is removed from boat, re-added on restore with fields"""

    @pytest.fixture(autouse=True, scope="class")
    def boat(self):
        db = _db()
        db.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})
        db.user_boats.insert_one({"owner_id": "test-user-pro", "boat_id": TB, "boat": {"name": "TEST arch"}, "crew": ["test-user-free"],
                                  "crew_names": {"test-user-free": "TEST Solo"}, "crew_roles": {"test-user-free": ["cook"]},
                                  "agreements": {"test-user-free": {"ok": True}}, "crew_trips": {"test-user-free": ["custom_x"]},
                                  "trip_rsvp": {"custom_x": {"test-user-free": {"status": "maybe"}}}, "trip_notes": {"custom_x": "TEST notes"}})
        db.crew_invites.insert_one({"invite_id": "TEST_inv_arch_1", "owner_id": "test-user-pro", "boat_id": TB, "trip_id": "custom_x",
                                    "email": "test_arch_inv@example.com", "email_key": "test_arch_inv@example.com", "name": "TEST Invitee"})
        yield
        db.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": TB})
        db.crew_invites.delete_many({"owner_id": "test-user-pro", "boat_id": TB})
        db.trip_archives.delete_many({"owner_id": "test-user-pro", "boat_id": TB})

    def test_full_cycle(self):
        db = _db()
        r = requests.post(TBURL, json=payload("custom_x"), headers=PRO)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["stats"]["crew"] == 1 and s["stats"]["invites"] == 1
        d = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": TB})
        assert d["crew"] == []
        assert "test-user-free" not in (d.get("crew_names") or {}) and "test-user-free" not in (d.get("crew_trips") or {})
        assert "test-user-free" not in (d.get("crew_roles") or {})
        assert db.crew_invites.count_documents({"owner_id": "test-user-pro", "boat_id": TB}) == 0
        dj = requests.get(f"{TBURL}/{s['archive_id']}", headers=PRO).json()
        assert dj["crew"][0] == {"name": "TEST Solo", "roles": ["cook"], "rsvp": "maybe"}
        assert dj["invites"][0]["email"] == "test_arch_inv@example.com"
        # restore into a NEW list id
        rr = requests.post(f"{TBURL}/{s['archive_id']}/restore", json={"to_trip_id": "custom_new1"}, headers=PRO)
        assert rr.status_code == 200
        assert rr.json()["invites"] == 1
        d = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": TB})
        assert d["crew"] == ["test-user-free"]
        assert d["crew_trips"]["test-user-free"] == ["custom_new1"]
        assert d["crew_names"]["test-user-free"] == "TEST Solo" and d["crew_roles"]["test-user-free"] == ["cook"]
        assert d["agreements"]["test-user-free"] == {"ok": True}
        assert d["trip_rsvp"]["custom_new1"]["test-user-free"]["status"] == "maybe"
        assert d["trip_notes"]["custom_new1"] == "TEST notes"
        inv = db.crew_invites.find_one({"invite_id": "TEST_inv_arch_1"})
        assert inv and inv["trip_id"] == "custom_new1"
