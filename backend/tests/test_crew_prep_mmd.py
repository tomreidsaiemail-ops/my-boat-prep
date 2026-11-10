# Iteration 81: Crew Prep progress in crew list, agreement PDF, role briefing resend, Magic Marine Doctor Ship's Log entries
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE = "test_session_pro_1", "test_session_free_1"
PRO_ID, FREE_ID = "test-user-pro", "test-user-free"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_prep"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def boat_state():
    roles = [{"id": 1, "label": "Helm"}, {"id": 2, "label": "Radio Operator", "briefing": "Race channel is Yacht Club VHF 77"}]
    prep = [{"id": 11, "label": "1. Kit"}, {"id": 12, "label": "Lifejacket", "indent": True, "checked": True}, {"id": 13, "label": "Boots", "indent": True}]
    return {"boat": {"vessel": "TEST_Prep", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
            "registry": [{"id": "custom_roles", "name": "Crew Roles", "isSystem": False}, {"id": "custom_tom", "name": "Crew Prep - Tom", "isSystem": False},
                         {"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
            "data": {"custom_roles": roles, "custom_tom": prep, "shipsLog": []},
            "updated_at": T0, "list_ts": {"custom_roles": T0, "custom_tom": T0, "shipsLog": T0}, "sec_ts": {"boat": T0, "registry": T0}}


def cleanup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.invite_sends.delete_many({"owner_id": PRO_ID})
    DB.briefing_sends.delete_many({"owner_id": PRO_ID})


@pytest.fixture(scope="module", autouse=True)
def setup():
    cleanup()
    assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=boat_state()).status_code == 200
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$set": {"zone_maps": [
        {"id": "m1", "updated_at": T0, "pins": [{"id": "p1", "x": 0.1, "y": 0.1, "label": "Galley"}]}]}})
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"name": "Tom", "email": "test.user.free@example.com", "roles": ["Helm"], "send_email": False})
    assert r.status_code == 200, r.text
    c = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()
    assert c["invites"][0]["prep"] == {"list_id": "custom_tom", "list_name": "Crew Prep - Tom", "ticked": 1, "total": 2}
    assert s(FREE).post(f"{BASE_URL}/api/crew/invites/{r.json()['invite_id']}/accept").status_code == 200
    yield
    cleanup()


def test_crew_prep_progress_for_member():
    m = next(x for x in s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["crew"] if x["user_id"] == FREE_ID)
    assert m["prep"]["ticked"] == 1 and m["prep"]["total"] == 2 and m["prep"]["list_name"] == "Crew Prep - Tom"


def test_agreement_pdf_access():
    own = s(FREE).get(f"{BASE_URL}/api/crew/agreement/pdf", params={"owner_id": PRO_ID, "boat_id": BOAT})
    assert own.status_code == 200 and own.content[:4] == b"%PDF" and "Tom" in own.headers.get("content-disposition", "")
    other = s(FREE).get(f"{BASE_URL}/api/crew/agreement/pdf", params={"owner_id": PRO_ID, "boat_id": BOAT, "member_id": "someone"})
    assert other.status_code == 403
    sk = s(PRO).get(f"{BASE_URL}/api/crew/agreement/pdf", params={"boat_id": BOAT, "member_id": FREE_ID})
    assert sk.status_code == 200 and sk.content[:4] == b"%PDF"
    assert s(PRO).get(f"{BASE_URL}/api/crew/agreement/pdf", params={"boat_id": BOAT}).status_code == 404


def test_briefing_resend_rules():
    assert s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/briefings", json={"member_id": "nobody"}).status_code == 404
    r = s(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/briefings", json={"member_id": FREE_ID})
    assert r.status_code == 200 and r.json() == {"sent": [], "skipped": ["Tom"]}
    assert s(FREE).post(f"{BASE_URL}/api/boats/{BOAT}/briefings", json={}).status_code == 404


def test_mmd_needs_log_agreement():
    r = s(PRO).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "Small cut?"})
    assert r.status_code == 422 and "Ship's Log" in r.text
    r = s(PRO).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "Small cut?", "log_agree": True, "owner_id": "someone-else", "boat_id": BOAT})
    assert r.status_code == 404


def test_mmd_skipper_log_item():
    r = s(PRO).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "TEST_ small cut on a finger", "log_agree": True, "log_when": "Mon, 1 Jun 2026, 10:00",
                                                          "boat_id": BOAT, "kit": ["Plasters"]}, timeout=120)
    assert r.status_code == 200, r.text
    item = r.json()["log_item"]
    assert item["label"].startswith("Magic Marine Doctor asked by Skipper on Mon, 1 Jun 2026, 10:00: TEST_ small cut")
    assert item["mmd_answer"] == r.json()["answer"]
    doc = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"data.shipsLog": 1, "pushed_items": 1})
    assert [i["id"] for i in doc["data"]["shipsLog"]] == [item["id"]] and doc["pushed_items"][0]["item"]["id"] == item["id"]


def test_mmd_crew_logged_on_skippers_boat():
    r = s(FREE).post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "TEST_ bruised knee", "log_agree": True, "owner_id": PRO_ID, "boat_id": BOAT}, timeout=120)
    if r.status_code in (402, 403):
        pytest.skip("Free crew can't use the Magic Marine Doctor")
    assert r.status_code == 200, r.text
    assert "asked by Tom" in r.json()["log_item"]["label"]
    log = DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"data.shipsLog": 1})["data"]["shipsLog"]
    mine = [i for i in log if "asked by Tom" in i["label"]]
    assert len(mine) == 1 and mine[0]["mmd_answer"]
