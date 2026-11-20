# Welcome sign-in rules: skipper/complete/auto/section/home_set fields and PUT validation
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
NEW = {"Authorization": "Bearer test_session_welcome_new"}
CREW = {"Authorization": "Bearer test_session_welcome_crew"}
SHORE = {"Authorization": "Bearer test_session_shore_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
KEYS = ["find", "crew", "trip", "racer", "sell", "lend", "fish", "provision"]


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(os.environ.get("MONGO_URL"))
    d = c[os.environ.get("DB_NAME")]
    d.users.update_one({"user_id": "test-welcome-new"}, {"$unset": {"welcome": 1}})
    yield d
    d.users.update_one({"user_id": "test-welcome-new"}, {"$unset": {"welcome": 1}})


class TestWelcomeSignin:
    def test_new_skipper_fields(self, mdb):
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        for k in ("skipper", "complete", "auto", "section", "home_set"):
            assert k in d
        assert d["skipper"] is True and d["auto"] is True and d["complete"] is False
        assert d["section"] == "" and d["home_set"] is False
        assert [q["key"] for q in d["questions"]] == KEYS

    def test_crew_not_skipper(self, mdb):
        d = requests.get(f"{BASE_URL}/api/welcome", headers=CREW).json()
        assert d["skipper"] is False and d["auto"] is False

    def test_shore_not_skipper(self, mdb):
        r = requests.get(f"{BASE_URL}/api/welcome", headers=SHORE)
        assert r.status_code == 200, r.text
        assert r.json()["skipper"] is False and r.json()["auto"] is False

    def test_pro_is_skipper(self, mdb):
        d = requests.get(f"{BASE_URL}/api/welcome", headers=PRO).json()
        assert d["skipper"] is True

    def test_section_and_home_set(self, mdb):
        assert requests.put(f"{BASE_URL}/api/welcome", headers=NEW, json={"section": "crew"}).status_code == 200
        assert requests.put(f"{BASE_URL}/api/welcome", headers=NEW, json={"home_set": True}).status_code == 200
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["section"] == "crew" and d["home_set"] is True

    @pytest.mark.parametrize("bad", ["Crew", "has space", "a" * 21, "x-y", "<script>"])
    def test_invalid_section(self, mdb, bad):
        r = requests.put(f"{BASE_URL}/api/welcome", headers=NEW, json={"section": bad})
        assert r.status_code == 422

    def test_complete_rules(self, mdb):
        mdb.users.update_one({"user_id": "test-welcome-new"}, {"$unset": {"welcome": 1}})
        # all answers but no mv_ack -> not complete
        requests.put(f"{BASE_URL}/api/welcome", headers=NEW, json={"answers": {k: "yes" for k in KEYS}})
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["complete"] is False and d["auto"] is True
        # mv_ack but one missing answer -> not complete
        mdb.users.update_one({"user_id": "test-welcome-new"}, {"$unset": {"welcome.answers.provision": 1}, "$set": {"welcome.mv_ack": True}})
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["complete"] is False and d["auto"] is True
        # complete but force visit still due -> auto true
        requests.put(f"{BASE_URL}/api/welcome", headers=NEW, json={"answers": {"provision": "no"}})
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["complete"] is True and d["due"] is True and d["auto"] is True
        # visited -> auto false
        requests.post(f"{BASE_URL}/api/welcome/visited", headers=NEW)
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["complete"] is True and d["auto"] is False

    def test_incomplete_after_visit_still_auto(self, mdb):
        mdb.users.update_one({"user_id": "test-welcome-new"}, {"$unset": {"welcome": 1}})
        requests.post(f"{BASE_URL}/api/welcome/visited", headers=NEW)
        d = requests.get(f"{BASE_URL}/api/welcome", headers=NEW).json()
        assert d["due"] is False and d["auto"] is True


# Crew member who names their own boat becomes a skipper
def test_crew_naming_own_boat_is_skipper(mdb):
    res = mdb.user_boats.insert_one({"owner_id": "test-welcome-crew", "boat_id": "TEST_own", "boat": {"vessel": "TEST_Own Boat"}, "crew": []})
    try:
        d = requests.get(f"{BASE_URL}/api/welcome", headers=CREW).json()
        assert d["skipper"] is True and d["auto"] is True
    finally:
        mdb.user_boats.delete_one({"_id": res.inserted_id})
    assert requests.get(f"{BASE_URL}/api/welcome", headers=CREW).json()["skipper"] is False
