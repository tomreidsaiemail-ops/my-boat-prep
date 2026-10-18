# Crew sharing, last boat, per-item sync merge and boat photo API tests
import hashlib
import io
import os
import secrets
import struct
import uuid
import zlib
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, BETA = "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
PRO_ID, FREE_ID = "test-user-pro", "test-user-free"
FREE_EMAIL = "test.user.free@example.com"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_crew1"
BOAT2 = "TEST_crew2"
T0, T1, T2, T3 = "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z", "2026-01-04T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def state(vessel="TEST_Shared", items=None, ts=T0, **extra):
    return {"boat": {"vessel": vessel, "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "owner@example.com"},
            "registry": [{"id": "safety", "name": "Safety Offshore", "isSystem": True}, {"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
            "data": {"safety": items or [{"id": 1, "label": "Lifejackets", "checked": False, "ts": ts},
                                         {"id": 2, "label": "Flares", "checked": False, "ts": ts},
                                         {"id": 3, "label": "EPIRB", "checked": False, "ts": ts}],
                     "shipsLog": [{"id": 87, "label": "x", "checked": False, "ts": ts}]},
            "updated_at": ts, "list_ts": {"safety": ts, "shipsLog": ts}, "sec_ts": {"boat": ts, "registry": ts}, **extra}


def insert_invite(email, boat_id=BOAT, owner=PRO_ID, days=7):
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    DB.crew_invites.insert_one({"invite_id": str(uuid.uuid4()), "token_hash": hashlib.sha256(token.encode()).hexdigest(), "owner_id": owner,
                                "boat_id": boat_id, "email": email, "created_at": now.isoformat(), "expires_at": (now + timedelta(days=days)).isoformat()})
    return token


def png_bytes():
    raw = b"\x00\xff\x00\x00" * 1
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


@pytest.fixture(scope="module", autouse=True)
def setup_cleanup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": {"$regex": "^TEST"}})
    r = s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state())
    assert r.status_code == 200
    yield
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": {"$regex": "^TEST"}})
    DB.crew_invites.delete_many({"owner_id": {"$in": [PRO_ID, FREE_ID]}})
    DB.users.update_many({"user_id": {"$in": [PRO_ID, FREE_ID, "test-user-beta"]}}, {"$unset": {"last_boat": ""}})


def crew_boat(tok=FREE):
    return s(tok).get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": PRO_ID})


# Invites: plan gate and validation
class TestInvites:
    def test_free_owner_403(self):
        assert s(FREE).post(f"{BASE_URL}/api/boats/main/invites", json={"email": "delivered@resend.dev"}).status_code == 403

    def test_own_email_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "Test.User.Pro@example.com"})
        assert r.status_code == 400 and "own email" in r.json()["detail"]

    def test_invalid_email_400(self):
        assert s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "not-an-email"}).status_code == 400

    def test_unknown_boat_404(self):
        assert s(PRO).post(f"{BASE_URL}/api/boats/TEST_nope/invites", json={"email": "delivered@resend.dev"}).status_code == 404

    def test_real_invite_then_cancel(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "delivered@resend.dev"})
        assert r.status_code == 200, r.text
        inv = r.json()
        doc = DB.crew_invites.find_one({"invite_id": inv["invite_id"]})
        assert doc and doc["email"] == "delivered@resend.dev" and doc["expires_at"] > datetime.now(timezone.utc).isoformat()
        assert "token" not in doc
        crew = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()
        assert any(i["invite_id"] == inv["invite_id"] for i in crew["invites"])
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{inv['invite_id']}").status_code == 200
        assert not s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["invites"]


# Joining
class TestJoin:
    def test_unknown_token_400(self):
        assert s(FREE).post(f"{BASE_URL}/api/crew/join", json={"token": "x" * 40}).status_code == 400

    def test_expired_token_400(self):
        tok = insert_invite(FREE_EMAIL, days=-1)
        assert s(FREE).post(f"{BASE_URL}/api/crew/join", json={"token": tok}).status_code == 400

    def test_wrong_email_403(self):
        tok = insert_invite(FREE_EMAIL)
        r = s(BETA).post(f"{BASE_URL}/api/crew/join", json={"token": tok})
        assert r.status_code == 403 and FREE_EMAIL in r.json()["detail"]

    def test_not_crew_404_before_join(self):
        assert crew_boat().status_code == 404

    def test_join_ok(self):
        DB.crew_invites.delete_many({"owner_id": PRO_ID})
        tok = insert_invite(FREE_EMAIL)
        r = s(FREE).post(f"{BASE_URL}/api/crew/join", json={"token": tok})
        assert r.status_code == 200 and r.json()["key"] == f"c_{PRO_ID}_{BOAT}"
        assert DB.crew_invites.count_documents({"owner_id": PRO_ID, "boat_id": BOAT}) == 0
        assert s(FREE).post(f"{BASE_URL}/api/crew/join", json={"token": tok}).status_code == 400

    def test_boats_list_shows_shared(self):
        data = s(FREE).get(f"{BASE_URL}/api/me/boats").json()
        sh = [b for b in data["boats"] if b["crew"]]
        assert len(sh) == 1
        b = sh[0]
        assert b["boat_id"] == BOAT and b["owner_id"] == PRO_ID and b["owner_name"] and b["crew_count"] == 1 and b["vessel"] == "TEST_Shared"
        assert "photo_v" in b and "last" in data
        own = [b for b in s(PRO).get(f"{BASE_URL}/api/me/boats").json()["boats"] if b["boat_id"] == BOAT][0]
        assert own["crew"] is False and own["crew_count"] == 1

    def test_already_crew_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": FREE_EMAIL.upper()})
        assert r.status_code == 400 and "already crew" in r.json()["detail"]

    def test_crew_get_role(self):
        r = crew_boat()
        assert r.status_code == 200 and r.json()["role"] == "crew" and r.json()["boat"]["vessel"] == "TEST_Shared"

    def test_non_crew_get_404(self):
        assert crew_boat(BETA).status_code == 404
        assert s(BETA).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": PRO_ID}, json=state()).status_code == 404

    def test_crew_list_member(self):
        crew = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["crew"]
        assert [m["user_id"] for m in crew] == [FREE_ID]

    def test_free_shared_boat_not_counted(self):
        # free user still able to save own main boat (only 1 own boat)
        cur = s(FREE).get(f"{BASE_URL}/api/me/boat").json()
        assert s(FREE).put(f"{BASE_URL}/api/me/boat", json={k: cur[k] for k in ("boat", "registry", "data", "updated_at")}).status_code == 200


# Crew can tick only, and owner/crew merge per item
class TestCrewPermsAndMerge:
    def test_crew_put_only_checked(self):
        bad = state(vessel="HACKED", items=[{"id": 1, "label": "HACKED", "checked": True, "ts": T1},
                                            {"id": 2, "label": "Flares", "checked": False, "ts": T0},
                                            {"id": 99, "label": "NEW", "checked": True, "ts": T1}], ts=T1)
        bad["registry"] = [{"id": "safety", "name": "HACKED"}]
        bad["emergency_checked"] = {"x": True}
        r = s(FREE).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": PRO_ID}, json=bad)
        assert r.status_code == 200 and r.json()["role"] == "crew"
        d = s(PRO).get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()
        assert d["boat"]["vessel"] == "TEST_Shared"
        assert d["registry"][0]["name"] == "Safety Offshore"
        ids = [i["id"] for i in d["data"]["safety"]]
        assert ids == [1, 2, 3]
        i1 = d["data"]["safety"][0]
        assert i1["checked"] is True and i1["label"] == "Lifejackets"
        assert "shipsLog" in d["data"] and d["emergency_checked"] == {}

    def test_owner_concurrent_tick_keeps_crew_tick(self):
        # Owner's phone still has the stale copy (item 1 unticked @T0) and ticks item 2 @T2
        inc = state(items=[{"id": 1, "label": "Lifejackets", "checked": False, "ts": T0},
                           {"id": 2, "label": "Flares", "checked": True, "ts": T2},
                           {"id": 3, "label": "EPIRB", "checked": False, "ts": T0}], ts=T2)
        inc["list_ts"] = {"safety": T0, "shipsLog": T0}
        r = s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=inc)
        assert r.status_code == 200
        items = {i["id"]: i["checked"] for i in r.json()["data"]["safety"]}
        assert items == {1: True, 2: True, 3: False}

    def test_crew_concurrent_tick_keeps_owner_tick(self):
        # Crew ticks item 3 @T3 from a copy where item 2 is still unticked
        inc = state(items=[{"id": 1, "label": "Lifejackets", "checked": True, "ts": T1},
                           {"id": 2, "label": "Flares", "checked": False, "ts": T0},
                           {"id": 3, "label": "EPIRB", "checked": True, "ts": T3}], ts=T3)
        r = s(FREE).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": PRO_ID}, json=inc)
        assert r.status_code == 200
        items = {i["id"]: i["checked"] for i in crew_boat().json()["data"]["safety"]}
        assert items == {1: True, 2: True, 3: True}

    def test_crew_put_on_nonexistent_boat_404(self):
        assert s(FREE).put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_none", "owner": PRO_ID}, json=state()).status_code == 404


# Remember last boat
class TestLastBoat:
    def test_bad_key_422(self):
        assert s(FREE).put(f"{BASE_URL}/api/me/last-boat", json={"key": "bad key!"}).status_code == 422
        assert s(FREE).put(f"{BASE_URL}/api/me/last-boat", json={}).status_code == 422

    def test_set_and_get(self):
        key = f"c_{PRO_ID}_{BOAT}"
        assert s(FREE).put(f"{BASE_URL}/api/me/last-boat", json={"key": key}).status_code == 200
        assert s(FREE).get(f"{BASE_URL}/api/me/boats").json()["last"] == key

    def test_unauth_401(self):
        assert requests.put(f"{BASE_URL}/api/me/last-boat", json={"key": "main"}).status_code == 401


# Boat photos
class TestPhotos:
    def test_non_image_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/photo", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_too_big_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/photo", files={"file": ("a.jpg", b"\xff" * (3 * 1024 * 1024 + 10), "image/jpeg")})
        assert r.status_code == 400 and "3 MB" in r.json()["detail"]

    def test_unknown_boat_404(self):
        assert s(PRO).post(f"{BASE_URL}/api/boats/TEST_nope/photo", files={"file": ("a.png", png_bytes(), "image/png")}).status_code == 404

    def test_upload_and_access(self):
        data = png_bytes()
        r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/photo", files={"file": ("a.png", data, "image/png")}, timeout=90)
        assert r.status_code == 200, r.text
        v = r.json()["photo_v"]
        own = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/photo", timeout=60)
        assert own.status_code == 200 and own.content == data and own.headers["content-type"] == "image/png"
        crew = s(FREE).get(f"{BASE_URL}/api/boats/{BOAT}/photo", params={"owner": PRO_ID}, timeout=60)
        assert crew.status_code == 200 and crew.content == data
        assert s(BETA).get(f"{BASE_URL}/api/boats/{BOAT}/photo", params={"owner": PRO_ID}).status_code == 404
        sh = [b for b in s(FREE).get(f"{BASE_URL}/api/me/boats").json()["boats"] if b["crew"]][0]
        assert sh["photo_v"] == v

    def test_remove_photo(self):
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/photo").status_code == 200
        assert s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/photo").status_code == 404
        sh = [b for b in s(FREE).get(f"{BASE_URL}/api/me/boats").json()["boats"] if b["crew"]][0]
        assert sh["photo_v"] is None


# Remove crew, leave, delete boat
class TestRemoveLeaveDelete:
    def test_remove_crew(self):
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}").status_code == 200
        assert crew_boat().status_code == 404
        assert not [b for b in s(FREE).get(f"{BASE_URL}/api/me/boats").json()["boats"] if b["crew"]]

    def test_leave(self):
        tok = insert_invite(FREE_EMAIL)
        assert s(FREE).post(f"{BASE_URL}/api/crew/join", json={"token": tok}).status_code == 200
        assert crew_boat().status_code == 200
        assert s(FREE).post(f"{BASE_URL}/api/crew/leave", json={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 200
        assert crew_boat().status_code == 404

    def test_delete_boat_removes_invites(self):
        assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT2}, json=state("TEST_Two")).status_code == 200
        insert_invite(FREE_EMAIL, boat_id=BOAT2)
        assert DB.crew_invites.count_documents({"owner_id": PRO_ID, "boat_id": BOAT2}) == 1
        assert s(PRO).delete(f"{BASE_URL}/api/me/boats/{BOAT2}").status_code == 200
        assert DB.crew_invites.count_documents({"owner_id": PRO_ID, "boat_id": BOAT2}) == 0
