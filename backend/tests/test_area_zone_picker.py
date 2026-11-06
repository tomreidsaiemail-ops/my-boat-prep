# Boat area zone picker (iteration 124): skipper zone persistence, crew zone changes on F&D areas, merge_crew_areas unit tests
import os
import sys
import time
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from sync_merge import merge_crew_areas  # noqa: E402

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CREW = {"Authorization": "Bearer test_session_free_1"}
OWNER = {"Authorization": "Bearer test_session_pro_1"}
Q = {"boat_id": "main", "owner": "test-user-pro"}
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
FRIDGE, PORT = "amw1pvdq802hq", "amvr1vpa6f5jn"


def now_iso(offset_ms=0):
    return datetime.fromtimestamp((time.time() * 1000 + offset_ms) / 1000, timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module", autouse=True)
def backup():
    doc = db.user_boats.find_one(KEY)
    yield doc
    db.user_boats.replace_one({"_id": doc["_id"]}, doc)


def area(areas, aid):
    return next((a for a in areas if a["id"] == aid), None)


# --- unit: merge_crew_areas zone handling
class TestMergeUnit:
    def test_crew_zone_on_top_fd_accepted(self):
        prev = [{"id": "a1", "name": "Fridge", "food": True}]
        inc = [{"id": "a1", "name": "Fridge", "food": True, "zone": {"label": "Galley", "colour": "Orange"}}]
        out = merge_crew_areas(prev, inc, "")
        assert out[0]["zone"] == {"label": "Galley", "colour": "Orange"}

    def test_crew_zone_on_non_fd_ignored(self):
        prev = [{"id": "a1", "name": "Locker"}]
        inc = [{"id": "a1", "name": "Locker", "zone": {"label": "Galley", "colour": "Orange"}}]
        assert "zone" not in merge_crew_areas(prev, inc, "")[0]

    def test_crew_omitting_zone_keeps_skippers(self):
        prev = [{"id": "a1", "name": "Fridge", "food": True, "zone": {"label": "Cockpit", "colour": "Gold"}}]
        inc = [{"id": "a1", "name": "Fridge", "food": True}]
        assert merge_crew_areas(prev, inc, "")[0]["zone"]["colour"] == "Gold"

    def test_crew_zone_on_sub_area_ignored(self):
        prev = [{"id": "p", "name": "Fridge", "food": True}, {"id": "c", "name": "Box", "parent_id": "p"}]
        inc = [{"id": "p", "name": "Fridge", "food": True}, {"id": "c", "name": "Box", "parent_id": "p", "zone": {"label": "Galley", "colour": "Orange"}}]
        out = merge_crew_areas(prev, inc, "")
        assert "zone" not in area(out, "c")


# --- API: skipper sets zone, crew sets zone on F&D, crew blocked on non-F&D
class TestZoneApi:
    def test_owner_sets_zone_persists(self):
        s = requests.get(f"{BASE_URL}/api/me/boat", headers=OWNER).json()
        area(s["areas"], PORT)["zone"] = {"label": "Cockpit", "colour": "Gold"}
        s["sec_ts"]["areas"] = now_iso(1000)
        body = {k: s[k] for k in ("boat", "registry", "data", "updated_at", "sec_ts", "list_ts", "areas") if k in s}
        r = requests.put(f"{BASE_URL}/api/me/boat", headers=OWNER, json=body)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/me/boat", headers=OWNER).json()
        assert area(g["areas"], PORT)["zone"] == {"label": "Cockpit", "colour": "Gold"}

    def test_crew_sets_zone_on_fd(self):
        s = requests.get(f"{BASE_URL}/api/me/boat", params=Q, headers=CREW).json()
        area(s["areas"], FRIDGE)["zone"] = {"label": "Galley", "colour": "Orange"}
        area(s["areas"], PORT)["zone"] = {"label": "Saloon", "colour": "Green"}
        s["sec_ts"]["areas"] = now_iso(2000)
        body = {k: v for k, v in s.items() if k not in ("synced_at", "role")}
        r = requests.put(f"{BASE_URL}/api/me/boat", params=Q, headers=CREW, json=body)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/me/boat", headers=OWNER).json()
        assert area(g["areas"], FRIDGE)["zone"] == {"label": "Galley", "colour": "Orange"}
        assert area(g["areas"], PORT)["zone"] == {"label": "Cockpit", "colour": "Gold"}  # non-F&D unchanged
