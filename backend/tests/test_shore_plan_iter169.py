# Iteration 169: PUT /boats/{id}/shore/plan (share route plan on shore page, no email) + GET /shore/track 'plan'
import os

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]
KEY = {"owner_id": "test-admin-1", "boat_id": "main"}
SHORE_EMAIL = "shore.only.test@example.com"


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    x.headers.update({"Authorization": f"Bearer {tok}"})
    return x


ADMIN, SHORE, FREE = s("test_session_admin_1"), s("test_session_shore_1"), s("test_session_free_1")
PLAN = "Route Plan: Route Planning\nTEST Mana-Picton, 1/1/2027 - 2/1/2027\nDeparture: 1/1/2027 08:00\nEstimated arrival: not set"


def _contacts():
    return ADMIN.get(f"{API}/boats/main/shore").json()["contacts"]


def _cleanup():
    ADMIN.put(f"{API}/boats/main/shore/tracking", json={"on": False})
    for c in _contacts():
        if c["email"].endswith("@example.com"):
            ADMIN.delete(f"{API}/boats/main/shore/contacts/{c['key']}")
    mdb.user_boats.update_one(KEY, {"$unset": {"shore_plan": "", "tracking": ""}})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    _cleanup()


class TestSharePlan:
    def test_01_unauth(self):
        assert requests.put(f"{API}/boats/main/shore/plan", json={"text": "x"}).status_code == 401

    def test_02_unknown_boat(self):
        assert ADMIN.put(f"{API}/boats/TEST_nope/shore/plan", json={"text": "x"}).status_code == 404

    def test_03_no_contacts_400(self):
        assert not _contacts()
        r = ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": PLAN})
        assert r.status_code == 400, r.text
        assert "shore contact" in r.json()["detail"]

    def test_04_validation_422(self):
        assert ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": ""}).status_code == 422
        assert ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": "a" * 1501}).status_code == 422
        assert ADMIN.put(f"{API}/boats/main/shore/plan", json={}).status_code == 422

    def test_05_invited_only_200(self):
        r = ADMIN.post(f"{API}/boats/main/shore/invites", json={"name": "TEST_Shore", "email": SHORE_EMAIL, "send_email": False})
        assert r.status_code == 200, r.text
        TestSharePlan.tok = r.json()["link"].rsplit("/", 1)[1]
        r = ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": "  " + PLAN + "  "})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["text"] == PLAN and d["contacts"] == 1 and d["at"]
        doc = mdb.user_boats.find_one(KEY)
        assert doc["shore_plan"]["text"] == PLAN

    def test_06_max_len_ok(self):
        r = ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": "b" * 1500})
        assert r.status_code == 200

    def test_07_joined_contact_sees_plan(self):
        assert SHORE.post(f"{API}/shore/join", json={"token": TestSharePlan.tok}).status_code == 200
        stale = ADMIN.get(f"{API}/shore/track", params={"owner_id": "test-admin-1", "boat_id": "main"}).json()
        assert stale["plan"] is None  # shared before this trip started, so hidden
        assert ADMIN.put(f"{API}/boats/main/shore/tracking", json={"on": True}).status_code == 200
        r = ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": PLAN})
        assert r.status_code == 200 and r.json()["contacts"] == 1
        own = ADMIN.get(f"{API}/shore/track", params={"owner_id": "test-admin-1", "boat_id": "main"})
        assert own.status_code == 200 and own.json()["plan"]["text"] == PLAN
        sh = SHORE.get(f"{API}/shore/track", params={"owner_id": "test-admin-1", "boat_id": "main"})
        assert sh.status_code == 200, sh.text
        assert sh.json()["plan"]["text"] == PLAN
        assert ADMIN.put(f"{API}/boats/main/shore/tracking", json={"on": False}).status_code == 200

    def test_08_outsider_no_track(self):
        r = FREE.get(f"{API}/shore/track", params={"owner_id": "test-admin-1", "boat_id": "main"})
        assert r.status_code == 404

    def test_09_tracking_on_then_plan(self):
        r = ADMIN.put(f"{API}/boats/main/shore/tracking", json={"on": True})
        assert r.status_code == 200 and r.json()["on"] is True
        assert ADMIN.put(f"{API}/boats/main/shore/plan", json={"text": PLAN}).status_code == 200
