# Iteration 38: Magic Marine Engineer (POST /api/ai/engine-ask), separate engine quota, Walkthrough sign-off, service-history notes 2000
import os
from datetime import datetime, timezone, timedelta
import requests
import pytest
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
PRO, FREE, BETA = "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
ASK = f"{BASE_URL}/api/ai/engine-ask"
SIGN = f"{BASE_URL}/api/me/boat/walkthrough-signoff"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def since():
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


def count(uid, engine):
    q = {"user_id": uid, "created_at": {"$gte": since()}, "kind": {"$in": ["engine"]} if engine else {"$ne": "engine"}}
    return DB.ai_drafts.count_documents(q)


# --- engine-ask validation / tiers
class TestEngineAskValidation:
    def test_unauth_401(self):
        assert requests.post(ASK, json={"question": "rattle"}).status_code == 401

    def test_free_403(self):
        r = s(FREE).post(ASK, json={"question": "rattle"})
        assert r.status_code == 403, r.text

    def test_blank_422(self):
        r = s(PRO).post(ASK, json={"question": "   "})
        assert r.status_code == 422
        assert "magic marine engineer" in r.text.lower()

    def test_missing_question_422(self):
        assert s(PRO).post(ASK, json={}).status_code == 422

    def test_too_long_422(self):
        assert s(PRO).post(ASK, json={"question": "a" * 1025}).status_code == 422

    def test_1024_ok_validation(self):
        # Exactly 1024 chars must pass validation (don't burn AI: use engine_type > 80 to force 422 elsewhere)
        r = s(PRO).post(ASK, json={"question": "a" * 1024, "engine_type": "x" * 81})
        assert r.status_code == 422 and "engine_type" in r.text


# --- real AI call + quota separation
class TestEngineAskReal:
    def test_engine_ask_real_and_quota_separate(self):
        eng_before = count("test-user-pro", True)
        other_before = count("test-user-pro", False)
        r = s(PRO).post(ASK, json={"question": "the engine is making a rattling sound at idle", "engine_type": "Yanmar 3YM30",
                                   "history": ["2026-01-05: 1200 hrs did Oil, Impeller"]}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["answer"], str) and len(d["answer"]) > 40
        assert "**" not in d["answer"]
        assert d["asks_left"] == 20 - (eng_before + 1)
        assert count("test-user-pro", True) == eng_before + 1
        assert count("test-user-pro", False) == other_before

    def test_topup_drafts_left_unaffected(self):
        other = count("test-user-pro", False)
        r = s(PRO).post(f"{BASE_URL}/api/ai/list-topup", json={"name": "Leaving the Dock", "items": [
            {"label": "Tidy lines", "heading": False}, {"label": "Close hatches", "heading": False}]}, timeout=120)
        assert r.status_code == 200, r.text
        assert r.json()["drafts_left"] == 20 - (other + 1)


# --- walkthrough sign-off
@pytest.fixture
def crew_on_pro():
    DB.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"$addToSet": {"crew": "test-user-beta"}})
    yield
    DB.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"$pull": {"crew": "test-user-beta"}})


def cleanup():
    DB.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"},
                             {"$pull": {"data.shipsLog": {"label": {"$regex": "^Crew Walkthrough signed off.*TESTWHEN"}}}})


class TestSignOff:
    def teardown_method(self):
        cleanup()

    def test_owner_signoff(self):
        before = s(PRO).get(f"{BASE_URL}/api/me/boat").json()
        r = s(PRO).post(SIGN, json={"when": "Mon 5 Jan 2026 TESTWHEN 10:00", "stops": 3})
        assert r.status_code == 200, r.text
        item = r.json()["item"]
        assert item["label"].startswith("Crew Walkthrough signed off by ")
        assert item["label"].endswith("(3 stops)") and "TESTWHEN" in item["label"]
        after = s(PRO).get(f"{BASE_URL}/api/me/boat").json()
        assert any(i["label"] == item["label"] for i in after["data"]["shipsLog"])
        assert after["updated_at"] != before["updated_at"]

    def test_single_stop_label(self):
        r = s(PRO).post(SIGN, json={"when": "TESTWHEN", "stops": 1})
        assert r.status_code == 200 and r.json()["item"]["label"].endswith("(1 stop)")

    def test_crew_signoff_into_owner(self, crew_on_pro):
        r = s(BETA).post(SIGN, params={"boat_id": "main", "owner": "test-user-pro"}, json={"when": "TESTWHEN crew", "stops": 2})
        assert r.status_code == 200, r.text
        doc = DB.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
        assert any(i["label"] == r.json()["item"]["label"] for i in doc["data"]["shipsLog"])

    def test_no_access_404(self):
        r = s(FREE).post(SIGN, params={"boat_id": "main", "owner": "test-user-pro"}, json={"when": "TESTWHEN", "stops": 2})
        assert r.status_code == 404

    def test_missing_own_boat_404(self):
        r = s(PRO).post(SIGN, params={"boat_id": "nosuchboat"}, json={"when": "TESTWHEN", "stops": 2})
        assert r.status_code == 404

    @pytest.mark.parametrize("body", [{"when": "x", "stops": 0}, {"when": "", "stops": 2}, {"stops": 2}])
    def test_validation_422(self, body):
        assert s(PRO).post(SIGN, json=body).status_code == 422

    def test_unauth_401(self):
        assert requests.post(SIGN, json={"when": "x", "stops": 1}).status_code == 401


# --- service history notes up to 2000
ENG = {"kind": "engine", "vessel": "TEST_Kia Ora", "skipper": "Tom", "callsign": "ZM1234", "local_date": "26/10/2026",
       "entries": [{"date": "2026-01-05", "hours": 1200, "notes": "n" * 2000, "items": ["Oil"]}]}


def test_pdf_notes_2000_ok():
    r = s(PRO).post(f"{BASE_URL}/api/service-history/pdf", json=ENG)
    assert r.status_code == 200, r.text
    assert r.content[:4] == b"%PDF"


def test_pdf_notes_2001_422():
    body = {**ENG, "entries": [{**ENG["entries"][0], "notes": "n" * 2001}]}
    assert s(PRO).post(f"{BASE_URL}/api/service-history/pdf", json=body).status_code == 422
