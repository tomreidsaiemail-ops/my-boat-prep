# Crew agreement Trip Plan (iteration 211): crew-preview trip, GET/POST /api/crew/agreement terms_ok/plan_ok/meet_ok.
# Needs `python /app/tests/seed_trip_211.py crewboat` (TEST boat test-user-pro/test_trip211 with test-user-free as crew) and `seed` for Model Vessel.
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
db = MongoClient("mongodb://localhost:27017")["test_database"]
CQ = {"owner_id": "test-user-pro", "boat_id": "test_trip211"}
MQ = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
DEFAULT = "Pier X, Berth YYY, be onboard no later than ONE HOUR before DEPARTURE, as that is when the crew briefing will begin."
BODY = {"owner_id": "test-user-pro", "boat_id": "test_trip211", "stops": []}


def set_weather(q, **kw):
    db.user_boats.update_one(q, {"$set": {f"boat.weather.{k}": v for k, v in kw.items()}})


def unset_weather(q, *keys):
    db.user_boats.update_one(q, {"$unset": {f"boat.weather.{k}": "" for k in keys}})


@pytest.fixture(autouse=True)
def fresh():
    assert db.user_boats.find_one(CQ), "run seed_trip_211.py crewboat first"
    db.user_boats.update_one(CQ, {"$unset": {"agreements": ""}, "$set": {"boat.weather.meetup": "TEST_Meet at Pier 3 Berth 12 at 0800 sharp"}})
    unset_weather(CQ, "meetup_agree")
    yield


# crew-preview trip
class TestPreview:
    def test_preview_trip_fields(self):
        r = requests.get(f"{BASE_URL}/api/boats/model_vessel/crew-preview", params={"roles": ["Anchor Lead"], "trip_id": "routeHazards"}, headers=PRO)
        assert r.status_code == 200
        t = r.json()["trip"]
        assert t["name"] == "Route Planning" and t["event"] == "TEST_Summer Cruise" and t["why"].startswith("TEST_Why")
        assert t["depart_at"] == "2026-12-18T09:00" and t["finish_at"] == "2026-12-19T16:00"
        assert t["meetup_agree"] is True
        assert len(t["legs"]) == 2
        assert t["legs"][0]["route_start"] == "TEST_Mana Marina" and t["legs"][0]["start_pos"]["lat"] == -36.84
        assert t["legs"][1]["route_dest"] == "TEST_Kawau" and t["legs"][1]["dest_pos"]

    def test_preview_default_trip_id(self):
        r = requests.get(f"{BASE_URL}/api/boats/model_vessel/crew-preview", headers=PRO)
        assert r.status_code == 200 and r.json()["trip"]["trip_id"] == "routeHazards"

    def test_preview_unknown_trip_null(self):
        r = requests.get(f"{BASE_URL}/api/boats/model_vessel/crew-preview", params={"trip_id": "nosuchtrip"}, headers=PRO)
        assert r.status_code == 200 and r.json()["trip"] is None

    def test_preview_bad_trip_id_422(self):
        r = requests.get(f"{BASE_URL}/api/boats/model_vessel/crew-preview", params={"trip_id": "bad id!"}, headers=PRO)
        assert r.status_code == 422


# meetup_agree rules
class TestMeetupAgree:
    def get_trip(self):
        r = requests.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": "test-user-pro", "boat_id": "test_trip211"}, headers=FREE)
        assert r.status_code == 200
        return r.json()["trip"]

    def test_changed_meetup_agree_true(self):
        t = self.get_trip()
        assert t["meetup_agree"] is True and t["legs"][0]["route_start"] == "TEST_A"

    def test_explicit_false(self):
        set_weather(CQ, meetup_agree=False)
        assert self.get_trip()["meetup_agree"] is False

    def test_default_text_false(self):
        set_weather(CQ, meetup=DEFAULT, meetup_agree=True)
        assert self.get_trip()["meetup_agree"] is False

    def test_missing_meetup_false(self):
        unset_weather(CQ, "meetup")
        t = self.get_trip()
        assert t["meetup_agree"] is False and t["meetup"] == DEFAULT

    def test_no_route_trip_null(self):
        doc = db.user_boats.find_one(CQ)
        try:
            db.user_boats.update_one(CQ, {"$set": {"boat.route_start": "", "boat.route_dest": "", "boat.weather": {}}})
            assert self.get_trip() is None
        finally:
            db.user_boats.update_one(CQ, {"$set": {"boat": doc["boat"]}})


# POST /api/crew/agreement checks
class TestSave:
    def post(self, **kw):
        return requests.post(f"{BASE_URL}/api/crew/agreement", json={**BODY, **kw}, headers=FREE)

    def test_reject_without_terms(self):
        r = self.post(accept=True, plan_ok=True, meet_ok=True)
        assert r.status_code == 400 and "Standard Terms" in r.json()["detail"]

    def test_reject_without_plan(self):
        r = self.post(accept=True, terms_ok=True, meet_ok=True)
        assert r.status_code == 400 and "plan" in r.json()["detail"]

    def test_reject_without_meet(self):
        r = self.post(accept=True, terms_ok=True, plan_ok=True)
        assert r.status_code == 400 and "meet up" in r.json()["detail"]

    def test_meet_not_needed_when_agree_off(self):
        set_weather(CQ, meetup_agree=False)
        r = self.post(accept=True, terms_ok=True, plan_ok=True)
        assert r.status_code == 200, r.text
        a = r.json()["agreement"]
        assert a["accepted_at"] and a["terms_ok_at"] and a["plan_ok_at"] and "meet_ok_at" not in a

    def test_accept_stores_all(self):
        r = self.post(accept=True, terms_ok=True, plan_ok=True, meet_ok=True)
        assert r.status_code == 200, r.text
        stored = db.user_boats.find_one(CQ)["agreements"]["test-user-free"]
        assert stored["accepted_at"] and stored["terms_ok_at"] and stored["plan_ok_at"] and stored["meet_ok_at"]
        g = requests.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": "test-user-pro", "boat_id": "test_trip211"}, headers=FREE).json()
        assert g["agreement"]["meet_ok_at"] == stored["meet_ok_at"]

    def test_non_accept_keeps_ticks(self):
        r = self.post(accept=False, terms_ok=True, plan_ok=True)
        assert r.status_code == 200
        first = r.json()["agreement"]
        assert first["terms_ok_at"] and first["plan_ok_at"] and "accepted_at" not in first
        r2 = self.post(accept=False, terms_ok=True, plan_ok=True, meet_ok=True)
        a = r2.json()["agreement"]
        assert a["terms_ok_at"] == first["terms_ok_at"] and a["meet_ok_at"]
        # unticking drops the stamp
        a3 = self.post(accept=False, terms_ok=False, plan_ok=True).json()["agreement"]
        assert "terms_ok_at" not in a3 and "meet_ok_at" not in a3

    def test_no_trip_plan_not_needed(self):
        doc = db.user_boats.find_one(CQ)
        try:
            db.user_boats.update_one(CQ, {"$set": {"boat.route_start": "", "boat.route_dest": "", "boat.weather": {}}})
            r = self.post(accept=True, terms_ok=True)
            assert r.status_code == 200, r.text
        finally:
            db.user_boats.update_one(CQ, {"$set": {"boat": doc["boat"]}})

    def test_non_crew_404(self):
        r = requests.post(f"{BASE_URL}/api/crew/agreement", json={**BODY, "accept": True}, headers={"Cookie": "session_token=test_session_admin_1"})
        assert r.status_code == 404
