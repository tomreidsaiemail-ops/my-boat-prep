# Crew walkthrough sign-off -> db.walkthroughs record, auto-register crew, /crew-register/walkthrough status, register badges
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]

OWNER, BOAT, CREW, CREW_EMAIL = "test-user-pro", "main", "test-user-free", "test.user.free@example.com"
log_ids = []


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    had_entry = db.crew_register.find_one({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL}, {"entry_id": 1})
    had_walk = db.walkthroughs.find_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
    yield
    if not had_walk:
        db.walkthroughs.delete_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
    if not had_entry:
        db.crew_register.delete_one({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL, "status": "unregistered", "name": "TEST Free Crew"})
    if log_ids:
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT},
                                 {"$pull": {"data.shipsLog": {"id": {"$in": log_ids}}, "pushed_items": {"item.id": {"$in": log_ids}}}})


def signoff(tok, owner=OWNER):
    params = {"boat_id": BOAT} if owner is None else {"boat_id": BOAT, "owner": owner}
    r = s(tok).post(f"{BASE_URL}/api/me/boat/walkthrough-signoff", params=params, json={"when": "TEST Fri 6 Nov", "stops": 2})
    if r.status_code == 200:
        log_ids.append(r.json()["item"]["id"])
    return r


class TestWalkthrough:
    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/crew-register/walkthrough", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.status_code == 401

    def test_status_validates_params(self):
        r = s("test_session_free_1").get(f"{BASE_URL}/api/crew-register/walkthrough", params={"owner_id": "bad id!", "boat_id": BOAT})
        assert r.status_code == 422

    def test_done_false_before(self):
        db.walkthroughs.delete_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        r = s("test_session_free_1").get(f"{BASE_URL}/api/crew-register/walkthrough", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.status_code == 200 and r.json() == {"done": False}

    def test_crew_signoff_records_and_registers(self):
        before = db.crew_register.count_documents({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL})
        r = signoff("test_session_free_1")
        assert r.status_code == 200
        item = r.json()["item"]
        assert "Crew Walkthrough signed off by" in item["label"] and "(2 stops)" in item["label"]
        doc = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"data.shipsLog": 1})
        assert any(x.get("id") == item["id"] for x in doc["data"]["shipsLog"])
        w = db.walkthroughs.find_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        assert w and w["email_key"] == CREW_EMAIL and w["at"]
        after = db.crew_register.count_documents({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL})
        assert after == max(before, 1)

    def test_done_true_after(self):
        r = s("test_session_free_1").get(f"{BASE_URL}/api/crew-register/walkthrough", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.json() == {"done": True}
        r2 = s("test_session_free_1").get(f"{BASE_URL}/api/crew-register/walkthrough", params={"owner_id": OWNER, "boat_id": "other"})
        assert r2.json() == {"done": False}

    def test_second_signoff_upserts_no_duplicates(self):
        assert signoff("test_session_free_1").status_code == 200
        assert db.walkthroughs.count_documents({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW}) == 1
        assert db.crew_register.count_documents({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL}) == 1

    def test_auto_entry_fields(self):
        e = db.crew_register.find_one({"owner_id": OWNER, "kind": "crew", "email_key": CREW_EMAIL})
        assert e["status"] in ("unregistered", "pending", "registered")
        assert e["name"] == "TEST Free Crew" or e["status"] != "unregistered"
        assert e["email"] == CREW_EMAIL

    def test_owner_signoff_no_record(self):
        r = signoff("test_session_pro_1", owner=None)
        assert r.status_code == 200
        assert db.walkthroughs.count_documents({"owner_id": OWNER, "user_id": OWNER}) == 0
        assert db.crew_register.count_documents({"owner_id": OWNER, "email_key": "test.user.pro@example.com"}) == 0

    def test_non_crew_cannot_signoff(self):
        r = signoff("test_session_beta_1")
        assert r.status_code in (403, 404)
        assert db.walkthroughs.count_documents({"user_id": "test-user-beta"}) == 0

    def test_signoff_validation(self):
        r = s("test_session_free_1").post(f"{BASE_URL}/api/me/boat/walkthrough-signoff", params={"boat_id": BOAT, "owner": OWNER}, json={"when": "", "stops": 0})
        assert r.status_code == 422

    def test_register_lists_badge(self):
        r = s("test_session_pro_1").get(f"{BASE_URL}/api/crew-register")
        assert r.status_code == 200
        data = r.json()
        me = [c for c in data["crew"] if c["email"] == CREW_EMAIL]
        assert len(me) == 1
        assert me[0]["walkthroughs"] and me[0]["walkthroughs"][0]["boat_id"] == BOAT
        assert me[0]["walkthroughs"][0]["vessel"] == "TEST_Kia Ora" and me[0]["walkthroughs"][0]["at"]
        assert all("email_key" not in c for c in data["crew"] + data["parties"])
        assert all(p["walkthroughs"] == [] for p in data["parties"])
