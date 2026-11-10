# Quick Invite (POST /api/boats/{boat_id}/quick-invite), claim on first sign-in (GET /api/me/boats), voyage rsvp_quick, pending excludes quick, routes-crew help template
import os
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
OWNER, BOAT = "test-user-pro", "main"
PRO, FREE = "test_session_pro_1", "test_session_free_1"
TS = str(int(time.time()))
NEW_EMAIL = f"test_quick_new_{TS}@example.com"
NEW_UID, NEW_TOK = f"TEST_quick_{TS}", f"test_session_quick_{TS}"
PEND_EMAIL = f"test_quick_pend_{TS}@example.com"


def s(tok):
    x = requests.Session()
    x.headers["Authorization"] = f"Bearer {tok}"
    return x


def crew():
    r = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew")
    assert r.status_code == 200, r.text
    return r.json()


def add_entry(name, email):
    r = s(PRO).post(f"{BASE_URL}/api/crew-register", json={"kind": "crew", "name": name, "email": email})
    assert r.status_code in (200, 201), r.text
    d = r.json()
    return (d.get("entry") or d)["entry_id"]


@pytest.fixture(scope="module")
def ctx():
    c = {"entries": [], "invites": []}
    yield c
    p = s(PRO)
    p.delete(f"{BASE_URL}/api/boats/{BOAT}/crew/{NEW_UID}")
    for i in c["invites"]:
        p.delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{i}")
    db.crew_invites.delete_many({"owner_id": OWNER, "email_key": {"$in": [NEW_EMAIL, PEND_EMAIL]}})
    for e in c["entries"]:
        p.delete(f"{BASE_URL}/api/crew-register/{e}")
    db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$pull": {"crew": NEW_UID}})
    db.users.delete_one({"user_id": NEW_UID})
    db.user_sessions.delete_one({"session_token": NEW_TOK})


def test_auth_and_premium_required():
    assert requests.post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": "x"}).status_code == 401
    # test-user-free is premium via launch_free, so only the 401 path is checkable here


def test_unknown_entry_400():
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": "nope", "trip_id": "routeHazards"})
    assert r.status_code == 400
    assert "registered crew member" in r.json()["detail"]


def test_already_crew_same_trip_400():
    e = db.crew_register.find_one({"owner_id": OWNER, "kind": "crew", "email_key": "test.user.free@example.com"}, {"_id": 0, "entry_id": 1})
    if not e:
        pytest.skip("no register entry for free crew")
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": e["entry_id"], "trip_id": "custom_trip2", "trip_name": "Route Planning - 2"})
    assert r.status_code == 400
    assert "already crew on Route Planning - 2" in r.json()["detail"]


def test_free_crew_voyage_quick_note_and_reply_clears():
    v = s(FREE).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": OWNER, "boat_id": BOAT}).json()
    t2 = next(t for t in v["trips"] if t["trip_id"] == "custom_trip2")
    assert t2["rsvp"] == "in" and t2["rsvp_quick"] is True
    orig = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "trip_rsvp.custom_trip2.test-user-free": 1})["trip_rsvp"]["custom_trip2"]["test-user-free"]
    try:
        r = s(FREE).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": OWNER, "boat_id": BOAT, "status": "in", "trip_id": "custom_trip2"})
        assert r.status_code == 200, r.text
        v = s(FREE).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": OWNER, "boat_id": BOAT}).json()
        t2 = next(t for t in v["trips"] if t["trip_id"] == "custom_trip2")
        assert t2["rsvp"] == "in" and t2["rsvp_quick"] is False
        m = next(m for m in crew()["crew"] if m["user_id"] == "test-user-free")
        assert "custom_trip2" not in m["trip_quick"]
    finally:
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"trip_rsvp.custom_trip2.test-user-free": orig}})


def test_pending_normal_invite_other_trip_409(ctx):
    eid = add_entry("TEST_Pend Crew", PEND_EMAIL)
    ctx["entries"].append(eid)
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "TEST_Pend Crew", "email": PEND_EMAIL, "roles": [], "notes": "", "send_email": False,
                                                                 "trip_id": "routeHazards", "trip_name": "Route Planning"})
    assert r.status_code in (200, 201), r.text
    inv = next(i for i in crew()["invites"] if i["email"] == PEND_EMAIL)
    ctx["invites"].append(inv["invite_id"])
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "custom_trip2", "trip_name": "Route Planning - 2"})
    assert r.status_code == 409, r.text
    assert "yet to respond" in r.json()["detail"]


def test_no_account_quick_then_first_sign_in(ctx):
    eid = add_entry("TEST_Quick New", NEW_EMAIL)
    ctx["entries"].append(eid)
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "custom_trip2", "trip_name": "Route Planning - 2", "roles": ["Bow"]})
    assert r.status_code == 200, r.text
    assert r.json() == {"joined": False}
    assert db.email_outbox.count_documents({"to": NEW_EMAIL}) == 0 if "email_outbox" in db.list_collection_names() else True
    inv = next(i for i in crew()["invites"] if i["email"] == NEW_EMAIL)
    assert inv["quick"] is True and inv["trip_id"] == "custom_trip2"
    # first sign-in
    db.users.insert_one({"user_id": NEW_UID, "email": NEW_EMAIL, "name": "TEST Quick New", "picture": "", "role": "free", "created_at": datetime.now(timezone.utc).isoformat()})
    db.user_sessions.insert_one({"user_id": NEW_UID, "session_token": NEW_TOK, "expires_at": datetime.now(timezone.utc) + timedelta(days=1), "created_at": datetime.now(timezone.utc)})
    n = s(NEW_TOK)
    assert n.get(f"{BASE_URL}/api/crew/pending").json()["invites"] == []
    boats = n.get(f"{BASE_URL}/api/me/boats").json()["boats"]
    assert any(b.get("owner_id") == OWNER and b.get("boat_id") == BOAT for b in boats), boats
    assert db.crew_invites.count_documents({"email_key": NEW_EMAIL}) == 0
    m = next(m for m in crew()["crew"] if m["user_id"] == NEW_UID)
    assert m["trips"] == ["custom_trip2"] and m["trip_rsvp"]["custom_trip2"] == "in" and m["trip_quick"] == {"custom_trip2": True}
    assert m["quick"] is True and m["roles"] == ["Bow"] and not m.get("agreement")
    v = n.get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": OWNER, "boat_id": BOAT}).json()
    t2 = next(t for t in v["trips"] if t["trip_id"] == "custom_trip2")
    assert t2["rsvp_quick"] is True
    # now crew on that trip -> second quick invite is refused
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "custom_trip2", "trip_name": "Route Planning - 2"})
    assert r.status_code == 400 and "already crew" in r.json()["detail"]
    # quick to another trip for existing crew adds the trip
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "routeHazards", "trip_name": "Route Planning"})
    assert r.status_code == 200 and r.json() == {"joined": True}
    m = next(m for m in crew()["crew"] if m["user_id"] == NEW_UID)
    assert set(m["trips"]) == {"custom_trip2", "routeHazards"} and m["trip_quick"].get("routeHazards") is True


def test_own_email_400(ctx):
    e = db.crew_register.find_one({"owner_id": OWNER, "kind": "crew", "email_key": "test.user.pro@example.com"}, {"_id": 0, "entry_id": 1})
    if not e:
        eid = add_entry("TEST_Me", "test.user.pro@example.com")
        ctx["entries"].append(eid)
    else:
        eid = e["entry_id"]
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "routeHazards"})
    assert r.status_code == 400


def test_routes_crew_help_template():
    r = s(PRO).get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel -"})
    assert r.status_code == 200, r.text
    lists = r.json() if isinstance(r.json(), list) else r.json().get("lists", [])
    hit = [l for l in lists if "planning routes and inviting crew" in (l.get("name") or "").lower()]
    assert hit, [l.get("name") for l in lists]
    assert len(hit[0].get("items") or []) == 12


def test_remove_quick_invite_no_account(ctx):
    email = f"test_quick_rm_{TS}@example.com"
    eid = add_entry("TEST_Quick Rm", email)
    ctx["entries"].append(eid)
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/quick-invite", json={"entry_id": eid, "trip_id": "routeHazards", "trip_name": "Route Planning"})
    assert r.status_code == 200 and r.json() == {"joined": False}
    inv = next(i for i in crew()["invites"] if i["email"] == email)
    r = s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{inv['invite_id']}")
    db.crew_invites.delete_many({"owner_id": OWNER, "email_key": email})
    assert r.status_code == 200, f"Remove Quick Invite failed: {r.status_code} {r.text} invite_id={inv['invite_id']}"
