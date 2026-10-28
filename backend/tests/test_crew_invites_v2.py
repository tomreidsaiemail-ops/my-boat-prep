# Crew invite v2: canonical email_key, roles, voyage notes, pending invites (accept/decline), legacy join, role sourcing
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, BETA, ADMIN = "test_session_pro_1", "test_session_free_1", "test_session_beta_1", "test_session_admin_1"
PRO_ID, FREE_ID, BETA_ID, ADMIN_ID = "test-user-pro", "test-user-free", "test-user-beta", "test-admin-1"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_inv2"
T0 = "2026-01-01T00:00:00Z"
ADMIN_VARIANT = "Tom.Reidsaiemail+x@googlemail.com"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def state(vessel="TEST_InvBoat", registry_extra=None, data_extra=None):
    reg = [{"id": "safety", "name": "Safety Offshore", "isSystem": True}] + (registry_extra or [])
    data = {"safety": [{"id": 1, "label": "Lifejackets", "checked": False, "ts": T0}], **(data_extra or {})}
    return {"boat": {"vessel": vessel, "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
            "registry": reg, "data": data, "updated_at": T0, "list_ts": {k: T0 for k in data}, "sec_ts": {"boat": T0, "registry": T0}}


def invite(email, roles=None, notes="", tok=PRO, boat=BOAT):
    return s(tok).post(f"{BASE_URL}/api/boats/{boat}/invites", json={"email": email, "roles": roles or [], "notes": notes, "send_email": False})


def crew(boat=BOAT):
    return s(PRO).get(f"{BASE_URL}/api/boats/{boat}/crew").json()


def cleanup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": {"$regex": "^TEST_inv"}})
    DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": {"$regex": "^TEST_inv"}})
    DB.list_templates.delete_many({"custom": True, "name": {"$regex": "^crew roles$", "$options": "i"}})
    DB.users.update_many({"user_id": {"$in": [FREE_ID, BETA_ID, ADMIN_ID]}, "last_boat": {"$regex": f"_{BOAT}$"}}, {"$unset": {"last_boat": ""}})


@pytest.fixture(scope="module", autouse=True)
def setup():
    cleanup()
    assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state()).status_code == 200
    yield
    cleanup()


# email_key unit behaviour (module import)
def test_email_key_unit():
    import sys
    sys.path.insert(0, "/app/backend")
    for k, v in ENV.items():
        os.environ.setdefault(k, v)
    from crew import email_key, clean_roles
    assert email_key("chris.siekmann.cs@googlemail.com") == email_key("chrissiekmann.cs@gmail.com") == "chrissiekmanncs@gmail.com"
    assert email_key("A.B+tag@Gmail.com") == "ab@gmail.com"
    assert email_key("a.b+tag@example.com") == "a.b+tag@example.com"
    assert clean_roles(["Cook", " cook ", "  Navi   gator "]) == ["Cook", "Navi gator"]
    assert len(clean_roles([f"r{i}" for i in range(20)])) == 12
    assert len(clean_roles(["x" * 60])[0]) == 40


# Create invite: email_key, roles dedupe, notes on boat
class TestCreateInvite:
    def test_free_403(self):
        assert s(FREE).post(f"{BASE_URL}/api/boats/main/invites", json={"email": "x@example.com", "send_email": False}).status_code == 403

    def test_create_with_roles_notes(self):
        roles = ["Cook", "cook", "Navigator", "x" * 60] + [f"TEST_r{i}" for i in range(15)]
        r = invite("TEST_Crew.One@example.com", roles, "  Dec 3-5 tentative  ")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == "test_crew.one@example.com"
        assert d["roles"][:3] == ["Cook", "Navigator", "x" * 40] and len(d["roles"]) == 12
        doc = DB.crew_invites.find_one({"invite_id": d["invite_id"]})
        assert doc["email_key"] == "test_crew.one@example.com"
        c = crew()
        assert c["voyage_notes"] == "Dec 3-5 tentative"
        inv = [i for i in c["invites"] if i["invite_id"] == d["invite_id"]][0]
        assert inv["roles"] == d["roles"] and inv["email"] == d["email"] and "declined_at" not in inv
        assert "Cook" in c["role_options"]

    def test_reinvite_canonical_replaces(self):
        a = invite("chris.siekmann.cs@googlemail.com", ["Cook"]).json()
        b = invite("chrissiekmann.cs+boat@gmail.com", ["Deckhand"])
        assert b.status_code == 200
        keys = list(DB.crew_invites.find({"owner_id": PRO_ID, "boat_id": BOAT, "email_key": "chrissiekmanncs@gmail.com"}))
        assert len(keys) == 1 and keys[0]["invite_id"] == b.json()["invite_id"] and keys[0]["roles"] == ["Deckhand"]
        assert not DB.crew_invites.find_one({"invite_id": a["invite_id"]})

    def test_own_email_400(self):
        r = invite("TEST.USER.PRO@example.com")
        assert r.status_code == 400 and "own email" in r.json()["detail"]

    def test_own_gmail_variant_400(self):
        # admin is a premium (beta_tester) gmail user: googlemail/dots/+tag variant of own email must be rejected
        assert s(ADMIN).put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_invA"}, json=state()).status_code == 200
        try:
            r = invite(ADMIN_VARIANT, tok=ADMIN, boat="TEST_invA")
            assert r.status_code == 400 and "own email" in r.json()["detail"]
        finally:
            DB.user_boats.delete_many({"owner_id": ADMIN_ID, "boat_id": "TEST_invA"})

    def test_invalid_email_400(self):
        assert invite("nope").status_code == 400

    def test_voyage_notes_put(self):
        r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/voyage-notes", json={"notes": " TEST_notes 2 "})
        assert r.status_code == 200
        assert crew()["voyage_notes"] == "TEST_notes 2"

    def test_voyage_notes_non_owner_404(self):
        assert s(BETA).put(f"{BASE_URL}/api/boats/{BOAT}/voyage-notes", json={"notes": "hack"}).status_code == 404
        assert crew()["voyage_notes"] == "TEST_notes 2"


# Pending invites: canonical matching, accept, decline, cross-user
class TestPending:
    def test_pending_canonical_match_and_accept(self):
        inv = invite(ADMIN_VARIANT, ["Navigator", "Cook"]).json()
        p = s(ADMIN).get(f"{BASE_URL}/api/crew/pending").json()["invites"]
        mine = [i for i in p if i["invite_id"] == inv["invite_id"]]
        assert len(mine) == 1 and mine[0]["vessel"] == "TEST_InvBoat" and mine[0]["skipper"]
        # other user cannot see / accept / decline
        assert not [i for i in s(BETA).get(f"{BASE_URL}/api/crew/pending").json()["invites"] if i["invite_id"] == inv["invite_id"]]
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/{inv['invite_id']}/accept").status_code == 404
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/{inv['invite_id']}/decline").status_code == 404
        r = s(ADMIN).post(f"{BASE_URL}/api/crew/invites/{inv['invite_id']}/accept")
        assert r.status_code == 200 and r.json()["key"] == f"c_{PRO_ID}_{BOAT}"
        c = crew()
        m = [x for x in c["crew"] if x["user_id"] == ADMIN_ID][0]
        assert m["roles"] == ["Navigator", "Cook"] and m["email"] == "tomreidsaiemail@gmail.com"
        assert not [i for i in c["invites"] if i["invite_id"] == inv["invite_id"]]
        assert not [i for i in s(ADMIN).get(f"{BASE_URL}/api/crew/pending").json()["invites"] if i["invite_id"] == inv["invite_id"]]

    def test_already_crew_canonical_400(self):
        r = invite("tom.reidsaiemail@googlemail.com")
        assert r.status_code == 400 and "already crew" in r.json()["detail"]

    def test_pending_excludes_already_crew(self):
        # inject invite directly (bypassing already-crew check) -> pending should skip it
        DB.crew_invites.insert_one({"invite_id": str(uuid.uuid4()), "owner_id": PRO_ID, "boat_id": BOAT, "email": "tomreidsaiemail@gmail.com",
                                    "email_key": "tomreidsaiemail@gmail.com", "roles": [], "created_at": datetime.now(timezone.utc).isoformat(),
                                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), "token_hash": "x"})
        p = s(ADMIN).get(f"{BASE_URL}/api/crew/pending").json()["invites"]
        assert not [i for i in p if i["vessel"] == "TEST_InvBoat"]
        DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT, "email_key": "tomreidsaiemail@gmail.com"})

    def test_remove_crew_removes_roles(self):
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/crew/{ADMIN_ID}").status_code == 200
        doc = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})
        assert ADMIN_ID not in (doc.get("crew") or []) and ADMIN_ID not in (doc.get("crew_roles") or {})

    def test_decline(self):
        inv = invite("test.user.beta@example.com", ["Cook"]).json()
        assert [i for i in s(BETA).get(f"{BASE_URL}/api/crew/pending").json()["invites"] if i["invite_id"] == inv["invite_id"]]
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/{inv['invite_id']}/decline").status_code == 200
        c = [i for i in crew()["invites"] if i["invite_id"] == inv["invite_id"]][0]
        assert c.get("declined_at")
        assert not [i for i in s(BETA).get(f"{BASE_URL}/api/crew/pending").json()["invites"] if i["invite_id"] == inv["invite_id"]]
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/{inv['invite_id']}/accept").status_code == 404
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{inv['invite_id']}").status_code == 200

    def test_expired_excluded(self):
        iid = str(uuid.uuid4())
        DB.crew_invites.insert_one({"invite_id": iid, "owner_id": PRO_ID, "boat_id": BOAT, "email": "test.user.beta@example.com",
                                    "email_key": "test.user.beta@example.com", "roles": [], "created_at": T0, "expires_at": "2020-01-01T00:00:00Z", "token_hash": "y"})
        assert not [i for i in s(BETA).get(f"{BASE_URL}/api/crew/pending").json()["invites"] if i["invite_id"] == iid]
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/{iid}/accept").status_code == 404
        DB.crew_invites.delete_one({"invite_id": iid})

    def test_bad_invite_id_422(self):
        assert s(BETA).post(f"{BASE_URL}/api/crew/invites/notanid/accept").status_code == 422

    def test_unauth_401(self):
        assert requests.get(f"{BASE_URL}/api/crew/pending").status_code == 401


# Legacy token join compares canonical email
class TestLegacyJoin:
    def test_join_googlemail_variant(self):
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        DB.crew_invites.insert_one({"invite_id": str(uuid.uuid4()), "token_hash": hashlib.sha256(token.encode()).hexdigest(), "owner_id": PRO_ID, "boat_id": BOAT,
                                    "email": "tom.reids.aiemail@googlemail.com", "email_key": "tomreidsaiemail@gmail.com",
                                    "created_at": now.isoformat(), "expires_at": (now + timedelta(days=7)).isoformat()})
        r = s(ADMIN).post(f"{BASE_URL}/api/crew/join", json={"token": token})
        assert r.status_code == 200 and r.json()["key"] == f"c_{PRO_ID}_{BOAT}"
        assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/crew/{ADMIN_ID}").status_code == 200


# Role options sourcing: boat 'Crew Roles' list > admin template 'Crew Roles' > used roles
class TestRoleOptions:
    def test_admin_template_then_boat_list(self):
        DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
        DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$unset": {"crew_roles": ""}})
        assert crew()["role_options"] == []
        r = s(ADMIN).post(f"{BASE_URL}/api/admin/template-lists", json={"name": "Crew Roles", "items": ["TEST_Helm", "TEST_Bow"]})
        assert r.status_code == 200, r.text
        lid = r.json().get("list_id") or r.json().get("id")
        try:
            assert crew()["role_options"] == ["TEST_Helm", "TEST_Bow"]
            reg = [{"id": "c_roles", "name": "Crew Roles"}]
            data = {"c_roles": [{"id": 1, "label": "TEST_Galley", "checked": False, "ts": T0}]}
            assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state(registry_extra=reg, data_extra=data)).status_code == 200
            invite("TEST_r@example.com", ["TEST_Custom"])
            assert crew()["role_options"] == ["TEST_Galley", "TEST_Custom"]
        finally:
            s(ADMIN).delete(f"{BASE_URL}/api/admin/template-lists/{lid}")
