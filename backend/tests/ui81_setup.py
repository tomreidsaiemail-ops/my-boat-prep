# Iteration 81 UI setup/teardown for a temporary TEST_ui81 boat (usage: python ui81_setup.py setup|teardown)
import os, sys, requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
DB = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
BOAT, PRO_ID, FREE_ID = "TEST_ui81", "test-user-pro", "test-user-free"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session(); ss.cookies.set("session_token", tok); return ss


def setup():
    teardown()
    roles = [{"id": 1, "label": "Helm"}, {"id": 2, "label": "Radio Operator"}]
    prep = [{"id": 11, "label": "1. Kit"}, {"id": 12, "label": "Lifejacket", "indent": True, "checked": True}, {"id": 13, "label": "Boots", "indent": True}]
    fak = [{"id": 21, "label": "Plasters"}, {"id": 22, "label": "Antiseptic wipes"}]
    state = {"boat": {"vessel": "TEST_UI81", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
             "registry": [{"id": "custom_fak", "name": "First Aid Kit - basic for cruising", "isSystem": False},
                          {"id": "custom_roles", "name": "Crew Roles", "isSystem": False},
                          {"id": "custom_tom", "name": "Crew Prep - Tom", "isSystem": False},
                          {"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
             "data": {"custom_fak": fak, "custom_roles": roles, "custom_tom": prep, "shipsLog": []},
             "updated_at": T0, "list_ts": {k: T0 for k in ["custom_fak", "custom_roles", "custom_tom", "shipsLog"]}, "sec_ts": {"boat": T0, "registry": T0}}
    r = s("test_session_pro_1").put(f"{BASE}/api/me/boat", params={"boat_id": BOAT}, json=state); print("put boat", r.status_code)
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$set": {"zone_maps": [
        {"id": "m1", "updated_at": T0, "pins": [{"id": "p1", "x": 0.1, "y": 0.1, "label": "Galley"}]}]}})
    r = s("test_session_pro_1").post(f"{BASE}/api/boats/{BOAT}/invites", json={"name": "Tom", "email": "test.user.free@example.com", "roles": ["Helm"], "send_email": False})
    print("invite", r.status_code, r.text[:200])
    r2 = s("test_session_pro_1").post(f"{BASE}/api/boats/{BOAT}/invites", json={"name": "Tom", "email": "TEST_tom2@example.com", "roles": ["Helm"], "send_email": False})
    print("invite2", r2.status_code, r2.text[:200])
    a = s("test_session_free_1").post(f"{BASE}/api/crew/invites/{r.json()['invite_id']}/accept"); print("accept", a.status_code)
    print(s("test_session_pro_1").get(f"{BASE}/api/boats/{BOAT}/crew").json())
    s("test_session_pro_1").put(f"{BASE}/api/me/last-boat", json={"key": BOAT})
    s("test_session_free_1").put(f"{BASE}/api/me/last-boat", json={"key": f"c_{PRO_ID}_{BOAT}"})


def teardown():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.crew_invites.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.invite_sends.delete_many({"owner_id": PRO_ID})
    DB.briefing_sends.delete_many({"owner_id": PRO_ID})
    DB.users.update_one({"user_id": PRO_ID}, {"$unset": {"last_boat": ""}})
    DB.users.update_one({"user_id": FREE_ID}, {"$set": {"last_boat": "c_test-user-pro_TEST_agr"}})


if __name__ == "__main__":
    setup() if sys.argv[1] == "setup" else teardown()
