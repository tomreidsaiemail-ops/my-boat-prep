# Iteration 80: invite name, role briefings in the invite email, crew agreement (terms + walk-through ticks), skipper visibility
import os
import sys
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE = "test_session_pro_1", "test_session_free_1"
PRO_ID, FREE_ID = "test-user-pro", "test-user-free"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_agr"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def boat_state():
    roles = [{"id": 1, "label": "1. Racing Roles"}, {"id": 2, "label": "Radio Operator", "indent": True, "briefing": "Race channel is Yacht Club VHF 77"},
             {"id": 3, "label": "Helm", "indent": True}]
    return {"boat": {"vessel": "TEST_Agreement", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
            "registry": [{"id": "custom_roles", "name": "Crew Roles", "isSystem": False}], "data": {"custom_roles": roles},
            "updated_at": T0, "list_ts": {"custom_roles": T0}, "sec_ts": {"boat": T0, "registry": T0}}


def cleanup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.invite_sends.delete_many({"owner_id": PRO_ID})


@pytest.fixture(scope="module", autouse=True)
def setup():
    cleanup()
    assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=boat_state()).status_code == 200
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$set": {"zone_maps": [
        {"id": "m1", "updated_at": T0, "pins": [{"id": "p1", "x": 0.1, "y": 0.1, "label": "Galley"}, {"id": "p2", "x": 0.5, "y": 0.5, "label": "Lazarette"}]}]}})
    yield
    cleanup()


def test_invite_needs_name():
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "test.user.free@example.com", "send_email": False})
    assert r.status_code == 422
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "   ", "email": "test.user.free@example.com", "send_email": False})
    assert r.status_code == 400


def test_email_html_has_briefing():
    sys.path.insert(0, "/app/backend")
    for k, v in ENV.items():
        os.environ.setdefault(k, v)
    from crew import invite_html
    html = invite_html("Sk", "Boat", "t@example.com", "https://x/", ["Radio Operator"], "", {"radio operator": "Race channel is Yacht Club VHF 77"}, "Tom")
    assert "Role briefing - Radio Operator" in html and "Yacht Club VHF 77" in html and "Hi Tom" in html


def test_full_agreement_flow():
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "Tom", "email": "test.user.free@example.com", "roles": ["Radio Operator"], "send_email": False})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Tom"
    c = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()
    assert c["invites"][0]["name"] == "Tom"
    inv = r.json()["invite_id"]
    assert s(FREE).post(f"{BASE_URL}/api/crew/invites/{inv}/accept").status_code == 200
    c = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()
    m = next(x for x in c["crew"] if x["user_id"] == FREE_ID)
    assert m["name"] == "Tom" and m["agreement"] is None

    assert s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/terms", json={"terms": "Shoes off below"}).status_code == 200
    a = s(FREE).get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": PRO_ID, "boat_id": BOAT})
    assert a.status_code == 200, a.text
    a = a.json()
    assert a["boat_terms"] == "Shoes off below"
    assert a["roles"] == [{"role": "Radio Operator", "briefing": "Race channel is Yacht Club VHF 77", "read_at": None}]
    assert isinstance(a["terms"], list) and a["agreement"] is None

    body = {"owner_id": PRO_ID, "boat_id": BOAT, "stops": ["m1:p1"], "accept": True}
    assert s(FREE).post(f"{BASE_URL}/api/crew/agreement", json=body).status_code == 400
    r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**body, "accept": False})
    assert r.status_code == 200 and "accepted_at" not in r.json()["agreement"]
    m = next(x for x in s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["crew"] if x["user_id"] == FREE_ID)
    assert m["agreement"]["stops"] == ["m1:p1"] and m["agreement"]["stops_total"] == 2

    r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**body, "stops": ["m1:p1", "m1:p2", "bogus"]})
    assert r.status_code == 200 and r.json()["agreement"]["accepted_at"]
    m = next(x for x in s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["crew"] if x["user_id"] == FREE_ID)
    assert m["agreement"]["accepted_at"] and m["agreement"]["stops"] == ["m1:p1", "m1:p2"]


def test_not_crew_blocked():
    assert s(PRO).get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": "someone-else", "boat_id": BOAT}).status_code == 404
    assert s(FREE).put(f"{BASE_URL}/api/boats/{BOAT}/terms", json={"terms": "x"}).status_code == 404


def test_standard_terms_seeded():
    a = s(FREE).get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": PRO_ID, "boat_id": BOAT}).json()
    assert len(a["terms"]) >= 1
