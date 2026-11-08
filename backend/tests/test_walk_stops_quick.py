# Walkthrough stops picker (walk_skip), agreement stop filtering, quick accept for returning crew, register walkthrough at/full_at/quick
import os
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]
OWNER, BOAT, CREW = "test-user-pro", "main", "test-user-free"
PRO, FREE = "test_session_pro_1", "test_session_free_1"
MAPS = {"f634a094-b684-4f3f-8086-5542789ff9a3": ["tg1", "tg2"], "e7b33faf-9dea-4729-ae03-3ff1ba897e2e": ["th1"]}
ALL = [f"{m}:{p}" for m, ps in MAPS.items() for p in ps]
AG = {"owner_id": OWNER, "boat_id": BOAT}


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


@pytest.fixture(scope="module", autouse=True)
def setup():
    doc = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "walk_skip": 1, "agreements": 1})
    walk = db.walkthroughs.find_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW}, {"_id": 0})
    had_entry = db.crew_register.find_one({"owner_id": OWNER, "kind": "crew", "email_key": "test.user.free@example.com"}, {"_id": 1})
    free_skip = db.user_boats.find_one({"owner_id": CREW, "boat_id": BOAT}, {"_id": 0, "walk_skip": 1}) or {}
    for m, ps in MAPS.items():
        r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{m}/pins",
                       json={"pins": [{"id": p, "x": 0.3 + 0.2 * i, "y": 0.5, "label": f"TEST_Cupboard {p}", "area_id": None} for i, p in enumerate(ps)]})
        assert r.status_code == 200, r.text
    yield
    for m in MAPS:
        s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{m}/pins", json={"pins": []})
    db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"walk_skip": doc.get("walk_skip") or [], f"agreements.{CREW}": (doc.get("agreements") or {}).get(CREW)}})
    if not had_entry:
        db.crew_register.delete_one({"owner_id": OWNER, "kind": "crew", "email_key": "test.user.free@example.com", "status": "unregistered"})
    if "walk_skip" not in free_skip:
        db.user_boats.update_one({"owner_id": CREW, "boat_id": BOAT}, {"$unset": {"walk_skip": ""}})
    if walk:
        db.walkthroughs.replace_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW}, walk, upsert=True)
    else:
        db.walkthroughs.delete_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})


class TestWalkStops:
    def test_requires_auth(self):
        assert requests.put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops", json={"skip": []}).status_code == 401

    def test_crew_cannot_save(self):
        # free user's own boat is also "main": saving only touches their own boat, never the skipper's
        s(FREE).put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops", json={"skip": [ALL[0]]})
        assert ALL[0] not in (db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"walk_skip": 1}).get("walk_skip") or [])

    def test_save_filters_unknown_and_dupes(self):
        r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/walk-stops", json={"skip": [ALL[1], ALL[1], "bogus:x"]})
        assert r.status_code == 200 and r.json() == {"walk_skip": [ALL[1]]}

    def test_me_boats_has_walk_skip(self):
        r = s(PRO).get(f"{BASE_URL}/api/me/boats")
        assert r.status_code == 200
        data = r.json()
        boats = data["boats"] if isinstance(data, dict) else data
        b = next(x for x in boats if x.get("boat_id") == BOAT and not x.get("crew"))
        assert b["walk_skip"] == [ALL[1]]

    def test_crew_agreement_excludes_skipped(self):
        db.walkthroughs.delete_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        r = s(FREE).get(f"{BASE_URL}/api/crew/agreement", params=AG)
        assert r.status_code == 200
        assert r.json()["walkthrough"] is None
        # stop ids exposed via zone maps on crew boats; skipped stop must not be required
        r2 = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [ALL[0], ALL[2]], "accept": False})
        assert r2.status_code == 200 and r2.json()["agreement"]["stops_total"] == 2
        assert ALL[1] not in r2.json()["agreement"]["stops"]


class TestQuickAccept:
    def test_quick_without_walk_400(self):
        db.walkthroughs.delete_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [], "accept": True, "quick": True})
        assert r.status_code == 400

    def test_accept_requires_all_stops(self):
        r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [ALL[0]], "accept": True})
        assert r.status_code == 400

    def test_full_accept_sets_full_at(self):
        r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [ALL[0], ALL[2]], "accept": True})
        assert r.status_code == 200, r.text
        a = r.json()["agreement"]
        assert a["accepted_at"] and not a.get("quick")
        w = db.walkthroughs.find_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        assert w["full_at"] == w["at"] and w["quick"] is False

    def test_quick_accept_with_old_walk(self):
        old = (datetime.now(timezone.utc) - timedelta(days=95)).isoformat()
        db.walkthroughs.update_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW}, {"$set": {"at": old, "full_at": old, "quick": False}})
        db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$unset": {f"agreements.{CREW}": ""}})
        g = s(FREE).get(f"{BASE_URL}/api/crew/agreement", params=AG).json()
        assert g["walkthrough"] == {"full_at": old} and g["agreement"] is None
        r = s(FREE).post(f"{BASE_URL}/api/crew/agreement", json={**AG, "stops": [], "accept": True, "quick": True})
        assert r.status_code == 200, r.text
        a = r.json()["agreement"]
        assert a["quick"] is True and a["full_at"] == old and sorted(a["stops"]) == sorted([ALL[0], ALL[2]])
        w = db.walkthroughs.find_one({"owner_id": OWNER, "boat_id": BOAT, "user_id": CREW})
        assert w["quick"] is True and w["full_at"] == old and w["at"] != old

    def test_register_rows_walkthrough_fields(self):
        r = s(PRO).get(f"{BASE_URL}/api/crew-register")
        assert r.status_code == 200
        me = [c for c in r.json()["crew"] if c["email"] == "test.user.free@example.com"]
        assert me and me[0]["walkthroughs"]
        w = next(x for x in me[0]["walkthroughs"] if x["boat_id"] == BOAT)
        assert w["quick"] is True and w["full_at"] and w["at"] and w["full_at"] < w["at"]
