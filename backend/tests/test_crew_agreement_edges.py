# Iteration 81: edge cases for invite name validation, boat terms limits, agreement with no zone map stops
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO_ID, FREE_ID = "test-user-pro", "test-user-free"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_agr_edge"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


PRO, FREE = s("test_session_pro_1"), s("test_session_free_1")


@pytest.fixture(scope="module", autouse=True)
def setup():
    state = {"boat": {"vessel": "TEST_Edge", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
             "registry": [], "data": {}, "updated_at": T0, "list_ts": {}, "sec_ts": {"boat": T0, "registry": T0}}
    assert PRO.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state).status_code == 200
    yield
    DB.user_boats.delete_one({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


def test_name_too_long_422():
    r = PRO.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "x" * 61, "email": "test_edge@example.com", "send_email": False})
    assert r.status_code == 422


def test_name_whitespace_collapsed():
    r = PRO.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "  Big   Al ", "email": "test_edge@example.com", "send_email": False})
    assert r.status_code == 200 and r.json()["name"] == "Big Al"
    inv = next(i for i in PRO.get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["invites"] if i["invite_id"] == r.json()["invite_id"])
    assert inv["name"] == "Big Al"


def test_terms_too_long_422():
    assert PRO.put(f"{BASE_URL}/api/boats/{BOAT}/terms", json={"terms": "x" * 4001}).status_code == 422


def test_terms_persist_in_crew_get():
    assert PRO.put(f"{BASE_URL}/api/boats/{BOAT}/terms", json={"terms": "  Shoes off  "}).json()["boat_terms"] == "Shoes off"
    assert PRO.get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["boat_terms"] == "Shoes off"


def test_accept_with_no_stops_and_rejoin_resets():
    r = PRO.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "Freddie", "email": "test.user.free@example.com", "send_email": False})
    assert FREE.post(f"{BASE_URL}/api/crew/invites/{r.json()['invite_id']}/accept").status_code == 200
    a = FREE.post(f"{BASE_URL}/api/crew/agreement", json={"owner_id": PRO_ID, "boat_id": BOAT, "stops": [], "accept": True})
    assert a.status_code == 200 and a.json()["agreement"]["accepted_at"] and a.json()["agreement"]["stops_total"] == 0
    # "Not now" after accepting keeps accepted_at
    a = FREE.post(f"{BASE_URL}/api/crew/agreement", json={"owner_id": PRO_ID, "boat_id": BOAT, "stops": [], "accept": False})
    assert a.json()["agreement"]["accepted_at"]
    # leave and rejoin -> agreement cleared
    assert FREE.post(f"{BASE_URL}/api/crew/leave", json={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 200
    assert FREE.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 404
    r = PRO.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "Fred2", "email": "test.user.free@example.com", "send_email": False})
    assert FREE.post(f"{BASE_URL}/api/crew/invites/{r.json()['invite_id']}/accept").status_code == 200
    m = next(x for x in PRO.get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["crew"] if x["user_id"] == FREE_ID)
    assert m["agreement"] is None and m["name"] == "Fred2"
    FREE.post(f"{BASE_URL}/api/crew/leave", json={"owner_id": PRO_ID, "boat_id": BOAT})


def test_agreement_requires_auth():
    assert requests.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": PRO_ID, "boat_id": BOAT}).status_code == 401
