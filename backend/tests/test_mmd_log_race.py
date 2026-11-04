# Iteration 81: crew Ship's Log entries (MMD/walkthrough, server-pushed) must survive a later skipper sync from a stale copy
import os
import time
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT, PRO_ID, FREE_ID = "TEST_race81", "test-user-pro", "test-user-free"
T0 = "2026-01-01T00:00:00Z"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


@pytest.fixture(scope="module", autouse=True)
def boat():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    st = {"boat": {"vessel": "TEST_Race"}, "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
          "data": {"shipsLog": []}, "updated_at": T0, "list_ts": {"shipsLog": T0}, "sec_ts": {"boat": T0, "registry": T0}}
    assert s("test_session_pro_1").put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=st).status_code == 200
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$addToSet": {"crew": FREE_ID}})
    yield
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


def test_crew_entry_survives_stale_skipper_sync():
    stale = s("test_session_pro_1").get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()
    r = s("test_session_free_1").post(f"{BASE_URL}/api/me/boat/walkthrough-signoff", params={"boat_id": BOAT, "owner": PRO_ID}, json={"when": "now", "stops": 1})
    assert r.status_code == 200, r.text
    crew_id = r.json()["item"]["id"]
    time.sleep(0.05)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    stale["data"]["shipsLog"] = (stale["data"].get("shipsLog") or []) + [{"id": 1, "label": "TEST_ skipper MMD entry", "checked": False}]
    stale["list_ts"]["shipsLog"] = now
    stale["updated_at"] = now
    assert s("test_session_pro_1").put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=stale).status_code == 200
    ids = [i["id"] for i in DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})["data"]["shipsLog"]]
    assert 1 in ids
    assert crew_id in ids, f"crew entry lost after stale skipper sync: {ids}"


def test_skipper_can_delete_entry_after_phone_has_it():
    pro = s("test_session_pro_1")
    cur = pro.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}).json()
    crew_ids = [i["id"] for i in cur["data"]["shipsLog"] if i["id"] != 1]
    assert crew_ids
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    assert pro.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json={**cur, "updated_at": now}).status_code == 200
    assert not DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}).get("pushed_items")
    time.sleep(0.05)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    gone = {**cur, "data": {**cur["data"], "shipsLog": [i for i in cur["data"]["shipsLog"] if i["id"] == 1]}, "list_ts": {**cur["list_ts"], "shipsLog": now}, "updated_at": now}
    assert pro.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=gone).status_code == 200
    ids = [i["id"] for i in DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT})["data"]["shipsLog"]]
    assert ids == [1]
