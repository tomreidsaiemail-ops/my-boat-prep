# Walkthrough stops: unlabelled cupboard stops (own photo + comment), '+c:' contents flags in walk_skip, crew agreement requires them.
# Read-only on areas/zone maps; restores walk_skip and the crew agreement afterwards. Single class so xdist loadscope keeps it on one worker.
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
OWNER, BOAT, CREW = "test-user-pro", "main", "test-user-free"
FRIDGE = "area:amw1pvdq802hq"
GALLEY = "f634a094-b684-4f3f-8086-5542789ff9a3:comment"
AG = {"owner_id": OWNER, "boat_id": BOAT}


def s(tok):
    x = requests.Session()
    x.headers["Authorization"] = f"Bearer {tok}"
    return x


@pytest.fixture(scope="module", autouse=True)
def snapshot():
    doc = db.user_boats.find_one(AG, {"_id": 0, "walk_skip": 1, "agreements": 1})
    yield
    db.user_boats.update_one(AG, {"$set": {"walk_skip": [], f"agreements.{CREW}": (doc.get("agreements") or {}).get(CREW)}})


class TestWalkContents:
    def test_save_contents_flag_and_filter_unknown(self):
        r = s("test_session_pro_1").put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops",
                                        json={"skip": ["+c:" + FRIDGE, "+c:bogus:x", "bogus:y", "+c:" + GALLEY, "+c:" + FRIDGE]})
        assert r.status_code == 200, r.text
        # comment-only photo stops are still allowed a '+c:' key by the backend (UI never sends it)
        assert r.json()["walk_skip"][0] == "+c:" + FRIDGE
        assert "+c:bogus:x" not in r.json()["walk_skip"] and "bogus:y" not in r.json()["walk_skip"]
        assert r.json()["walk_skip"].count("+c:" + FRIDGE) == 1

    def test_me_boats_persisted(self):
        boats = s("test_session_pro_1").get(f"{BASE_URL}/api/me/boats").json()
        boats = boats["boats"] if isinstance(boats, dict) else boats
        b = next(x for x in boats if x.get("boat_id") == BOAT and not x.get("crew"))
        assert "+c:" + FRIDGE in b["walk_skip"]

    def test_crew_sees_contents_flag(self):
        boats = s("test_session_free_1").get(f"{BASE_URL}/api/me/boats").json()
        boats = boats["boats"] if isinstance(boats, dict) else boats
        b = next(x for x in boats if x.get("owner_id") == OWNER and x.get("boat_id") == BOAT)
        assert "+c:" + FRIDGE in (b.get("walk_skip") or [])

    def test_accept_requires_fridge_stop(self):
        r = s("test_session_free_1").post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [GALLEY], "accept": True, "shore_ok": True})
        assert r.status_code == 400
        r = s("test_session_free_1").post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [GALLEY, FRIDGE], "accept": False})
        assert r.status_code == 200, r.text
        a = r.json()["agreement"]
        assert a["stops_total"] == 2 and sorted(a["stops"]) == sorted([GALLEY, FRIDGE])

    def test_skip_fridge_removes_requirement(self):
        r = s("test_session_pro_1").put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops", json={"skip": [FRIDGE]})
        assert r.json()["walk_skip"] == [FRIDGE]
        r = s("test_session_free_1").post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [GALLEY], "accept": False})
        assert r.json()["agreement"]["stops_total"] == 1
        s("test_session_pro_1").put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops", json={"skip": []})
