# Crew role editing (PUT crew roles) + crew RSVP (voyage, rsvp, clear, cleanup on remove/leave)
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, BETA = "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
PRO_ID, FREE_ID, BETA_ID = "test-user-pro", "test-user-free", "test-user-beta"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_rsvp"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def state():
    data = {"safety": [{"id": 1, "label": "Lifejackets", "checked": False, "ts": T0}]}
    return {"boat": {"vessel": "TEST_RsvpBoat", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
            "registry": [{"id": "safety", "name": "Safety Offshore", "isSystem": True}], "data": data, "updated_at": T0,
            "list_ts": {k: T0 for k in data}, "sec_ts": {"boat": T0, "registry": T0}}


def add_crew(*uids, roles=None):
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$addToSet": {"crew": {"$each": list(uids)}},
                             "$set": {f"crew_roles.{u}": roles or [] for u in uids}})


def crew():
    r = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew")
    assert r.status_code == 200
    return r.json()


def member(uid):
    return next((m for m in crew()["crew"] if m["user_id"] == uid), None)


def cleanup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


@pytest.fixture(scope="module", autouse=True)
def setup():
    cleanup()
    assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state()).status_code == 200
    add_crew(BETA_ID, FREE_ID, roles=["Cook"])
    assert s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/voyage-notes", json={"notes": "TEST leaving Friday"}).status_code == 200
    yield
    cleanup()


# --- Edit roles ---
def test_set_roles_dedupes_and_persists():
    r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{BETA_ID}/roles", json={"roles": ["Navigator", " navigator ", "Cook", "  Deck   Hand "]})
    assert r.status_code == 200
    assert r.json()["roles"] == ["Navigator", "Cook", "Deck Hand"]
    assert member(BETA_ID)["roles"] == ["Navigator", "Cook", "Deck Hand"]


def test_set_roles_empty():
    r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}/roles", json={"roles": []})
    assert r.status_code == 200 and r.json()["roles"] == []
    assert member(FREE_ID)["roles"] == []


def test_set_roles_cap():
    r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}/roles", json={"roles": [f"R{i}" + "x" * 50 for i in range(15)]})
    assert r.status_code == 200
    roles = r.json()["roles"]
    assert len(roles) == 12 and all(len(x) <= 40 for x in roles)
    assert s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}/roles", json={"roles": [f"r{i}" for i in range(21)]}).status_code == 422


def test_set_roles_non_crew_404():
    r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/test-admin-1/roles", json={"roles": ["Cook"]})
    assert r.status_code == 404
    assert "crew_roles" not in DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}) or "test-admin-1" not in DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}).get("crew_roles", {})


def test_set_roles_not_owner_404():
    r = s(BETA).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}/roles", json={"roles": ["Hacker"]})
    assert r.status_code == 404
    assert "Hacker" not in member(FREE_ID)["roles"]


def test_set_roles_unauth():
    assert requests.put(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}/roles", json={"roles": []}).status_code == 401


# --- Voyage / RSVP ---
def test_crew_voyage_initial():
    r = s(BETA).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT})
    assert r.status_code == 200
    assert r.json() == {"notes": "TEST leaving Friday", "rsvp": None}
    assert member(BETA_ID)["rsvp"] is None


def test_crew_voyage_non_crew_404():
    r = requests.Session()
    r.cookies.set("session_token", "test_session_admin_1")
    assert r.get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 404
    # owner is not crew of own boat
    assert s(PRO).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 404


def test_rsvp_in_out_and_isolation():
    assert s(BETA).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "in"}).json() == {"rsvp": "in"}
    assert s(FREE).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "out"}).status_code == 200
    b = s(BETA).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).json()
    f = s(FREE).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).json()
    assert b["rsvp"] == "in" and f["rsvp"] == "out"
    assert set(b.keys()) == {"notes", "rsvp"}
    assert member(BETA_ID)["rsvp"] == "in" and member(FREE_ID)["rsvp"] == "out"
    # change mind
    s(BETA).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "out"})
    assert member(BETA_ID)["rsvp"] == "out"


def test_rsvp_invalid_status_422():
    for st in ["maybe", "", "IN", None]:
        r = s(BETA).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": st})
        assert r.status_code == 422, st


def test_rsvp_non_crew_404():
    r = s("test_session_admin_1").post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "in"})
    assert r.status_code == 404
    doc = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})
    assert "test-admin-1" not in (doc.get("rsvp") or {})


def test_clear_rsvp_owner_only():
    assert s(BETA).delete(f"{BASE_URL}/api/boats/{BOAT}/rsvp").status_code == 404
    assert member(BETA_ID)["rsvp"] is not None
    r = s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/rsvp")
    assert r.status_code == 200
    assert all(m["rsvp"] is None for m in crew()["crew"])
    assert s(BETA).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).json()["rsvp"] is None


def test_remove_crew_unsets_rsvp():
    s(FREE).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "in"})
    assert s(PRO).delete(f"{BASE_URL}/api/boats/{BOAT}/crew/{FREE_ID}").status_code == 200
    doc = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})
    assert FREE_ID not in (doc.get("rsvp") or {}) and FREE_ID not in (doc.get("crew_roles") or {})
    assert s(FREE).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 404


def test_leave_crew_unsets_rsvp():
    s(BETA).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": PRO_ID, "boat_id": BOAT, "status": "in"})
    assert s(BETA).post(f"{BASE_URL}/api/crew/leave", json={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 200
    doc = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})
    assert BETA_ID not in (doc.get("rsvp") or {}) and BETA_ID not in (doc.get("crew_roles") or {})
    assert BETA_ID not in doc.get("crew", [])
    assert s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/crew/{BETA_ID}/roles", json={"roles": ["Cook"]}).status_code == 404
