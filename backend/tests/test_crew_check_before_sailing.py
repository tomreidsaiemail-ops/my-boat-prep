# Iteration 125: crew "check before sailing" - role briefing reads, crew_joined, shopping_sent, crew-register boat_id / vessel / has_boat.
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


PRO, FREE = hdr("test_session_pro_1"), hdr("test_session_free_1")
OWNER, BOAT = "test-user-pro", "main"


@pytest.fixture(scope="module", autouse=True)
def restore_boat():
    snap = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "crew_roles": 1, "crew_joined": 1, "crew": 1, "crew_names": 1, "data.tpl_test67crew": 1})
    yield
    s = {"crew_roles": snap.get("crew_roles") or {}, "crew": snap.get("crew") or [], "crew_names": snap.get("crew_names") or {},
         "data.tpl_test67crew": (snap.get("data") or {}).get("tpl_test67crew") or []}
    u = {"$set": s}
    if snap.get("crew_joined") is None:
        u["$unset"] = {"crew_joined": ""}
    db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, u)
    db.briefing_reads.delete_many({"owner_id": OWNER, "boat_id": BOAT, "user_id": "test-user-free"})
    db.shopping_notes.delete_many({"owner_id": OWNER, "boat_id": BOAT, "email_key": "test.user.free@example.com"})


def crew_member():
    r = requests.get(f"{API}/boats/{BOAT}/crew", headers=PRO)
    assert r.status_code == 200, r.text
    return r.json(), next(m for m in r.json()["crew"] if m["user_id"] == "test-user-free")


class TestBriefingRead:
    def test_01_set_roles_and_briefings_shape(self):
        r = requests.put(f"{API}/boats/{BOAT}/crew/test-user-free/roles", json={"roles": ["Port Trim", "Helm"]}, headers=PRO)
        assert r.status_code == 200, r.text
        _, m = crew_member()
        b = {x["role"]: x for x in m["briefings"]}
        assert b["Port Trim"]["has_briefing"] is True and b["Port Trim"]["read_at"] is None and b["Port Trim"]["read_old"] is False
        assert b["Helm"]["has_briefing"] is False

    def test_02_reject_unassigned_and_no_briefing(self):
        body = {"owner_id": OWNER, "boat_id": BOAT}
        assert requests.post(f"{API}/crew/briefing-read", json={**body, "role": "Mainsheet"}, headers=FREE).status_code == 400
        assert requests.post(f"{API}/crew/briefing-read", json={**body, "role": "Helm"}, headers=FREE).status_code == 400
        assert requests.post(f"{API}/crew/briefing-read", json={**body, "role": "Port Trim"}, headers=PRO).status_code == 404
        assert requests.post(f"{API}/crew/briefing-read", json={**body, "role": "Port Trim"}).status_code == 401

    def test_03_read_then_skipper_sees_green(self):
        r = requests.post(f"{API}/crew/briefing-read", json={"owner_id": OWNER, "boat_id": BOAT, "role": "port trim"}, headers=FREE)
        assert r.status_code == 200, r.text
        assert r.json()["read_at"]
        ag = requests.get(f"{API}/crew/agreement", params={"owner_id": OWNER, "boat_id": BOAT}, headers=FREE).json()
        roles = {x["role"]: x for x in ag["roles"]}
        assert roles["Port Trim"]["read_at"] and roles["Helm"]["read_at"] is None
        _, m = crew_member()
        b = {x["role"]: x for x in m["briefings"]}
        assert b["Port Trim"]["read_at"] and b["Port Trim"]["read_old"] is False

    def test_04_changed_briefing_goes_stale(self):
        items = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"data.tpl_test67crew": 1})["data"]["tpl_test67crew"]
        new = [{**i, "briefing": i["briefing"] + " TEST changed"} if i.get("briefing") else i for i in items]
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"data.tpl_test67crew": new}})
        _, m = crew_member()
        b = {x["role"]: x for x in m["briefings"]}
        assert b["Port Trim"]["read_at"] is None and b["Port Trim"]["read_old"] is True
        ag = requests.get(f"{API}/crew/agreement", params={"owner_id": OWNER, "boat_id": BOAT}, headers=FREE).json()
        assert next(x for x in ag["roles"] if x["role"] == "Port Trim")["read_at"] is None
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"data.tpl_test67crew": items}})
        _, m = crew_member()
        assert next(x for x in m["briefings"] if x["role"] == "Port Trim")["read_at"]

    def test_05_shopping_sent_on_member(self):
        db.shopping_notes.update_one({"owner_id": OWNER, "boat_id": BOAT, "email_key": "test.user.free@example.com"},
                                     {"$set": {"at": datetime.now(timezone.utc).isoformat(), "count": 2}}, upsert=True)
        _, m = crew_member()
        assert m["shopping_sent"]["count"] == 2 and m["shopping_sent"]["at"]


class TestInviteJoinAndRegister:
    uid = f"test-user-c125-{uuid.uuid4().hex[:6]}"
    tok = f"test_session_c125_{uuid.uuid4().hex[:6]}"
    email = f"test.user.c125.{uuid.uuid4().hex[:6]}@example.com"
    entry = None

    @classmethod
    def setup_class(cls):
        now = datetime.now(timezone.utc)
        db.users.insert_one({"user_id": cls.uid, "email": cls.email, "name": "TEST C125", "picture": "", "role": "free", "created_at": now.isoformat()})
        db.user_sessions.insert_one({"user_id": cls.uid, "session_token": cls.tok, "expires_at": now + timedelta(days=1), "created_at": now})

    @classmethod
    def teardown_class(cls):
        requests.delete(f"{API}/boats/{BOAT}/crew/{cls.uid}", headers=PRO)
        if cls.entry:
            requests.delete(f"{API}/crew-register/{cls.entry}", headers=PRO)
        db.crew_invites.delete_many({"owner_id": OWNER, "email": cls.email})
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$pull": {"crew": cls.uid}, "$unset": {f"crew_joined.{cls.uid}": "", f"crew_roles.{cls.uid}": "", f"crew_names.{cls.uid}": ""}})
        db.users.delete_one({"user_id": cls.uid})
        db.user_sessions.delete_one({"session_token": cls.tok})

    def test_01_register_request_sends_boat_id(self):
        r = requests.post(f"{API}/crew-register", json={"kind": "crew", "name": "TEST C125", "email": self.email}, headers=PRO)
        assert r.status_code == 200, r.text
        TestInviteJoinAndRegister.entry = r.json()["entry_id"]
        r = requests.post(f"{API}/crew-register/requests", json={"entry_ids": [self.entry], "send_email": False, "boat_id": BOAT}, headers=PRO)
        assert r.status_code == 200, r.text
        assert db.crew_register.find_one({"entry_id": self.entry})["boat_id"] == BOAT

    def test_02_mine_vessel_has_boat_false(self):
        r = requests.get(f"{API}/crew-register/mine", headers=hdr(self.tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["has_boat"] is False
        req = next(x for x in d["requests"] if x["entry_id"] == self.entry)
        assert req["vessel"] == "TEST_Kia Ora"

    def test_03_invite_shows_created_and_briefings(self):
        r = requests.post(f"{API}/boats/{BOAT}/invites", json={"name": "TEST C125", "email": self.email, "roles": ["Port Trim"], "send_email": False}, headers=PRO)
        assert r.status_code == 200, r.text
        d, _ = crew_member()
        inv = next(i for i in d["invites"] if i["email"] == self.email)
        assert inv["created_at"] and inv["briefings"] == [{"role": "Port Trim", "has_briefing": True, "read_at": None, "read_old": False}]
        TestInviteJoinAndRegister.invite_id = inv["invite_id"]

    def test_04_accept_sets_crew_joined_and_has_boat(self):
        r = requests.post(f"{API}/crew/invites/{self.invite_id}/accept", headers=hdr(self.tok))
        assert r.status_code == 200, r.text
        d, _ = crew_member()
        m = next(x for x in d["crew"] if x["user_id"] == self.uid)
        assert m["invited_at"] and m["joined_at"]
        assert requests.get(f"{API}/crew-register/mine", headers=hdr(self.tok)).json()["has_boat"] is True

    def test_05_remove_unsets_crew_joined(self):
        r = requests.delete(f"{API}/boats/{BOAT}/crew/{self.uid}", headers=PRO)
        assert r.status_code == 200, r.text
        doc = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"crew_joined": 1})
        assert self.uid not in (doc.get("crew_joined") or {})
