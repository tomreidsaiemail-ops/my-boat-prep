# Boat Budget: admin template seed, admin-lists prefix, BoatDetails make/model/currency/notes, crew privacy, AI budget endpoint
import os
import asyncio
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
BETA = {"Authorization": "Bearer test_session_beta_1"}
OWNER, BOAT, CREW = "test-user-pro", "main", "test-user-free"


def run(fn):
    async def wrap():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        return await fn(db)
    return asyncio.run(wrap())


# --- template seed + admin-lists ---
def test_budget_template_seeded():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Boat Budget"}, headers=PRO)
    assert r.status_code == 200, r.text
    lists = r.json()["lists"]
    assert len(lists) >= 1
    tpl = lists[0]
    assert tpl["name"] == "Admin - Boat Budget"
    assert len(tpl["items"]) == 12
    assert any("|" in i["label"] for i in tpl["items"])
    assert any("|" not in i["label"] for i in tpl["items"])


def test_budget_template_is_private():
    doc = run(lambda db: db.list_templates.find_one({"custom": True, "name": "Admin - Boat Budget"}, {"_id": 0, "private": 1}))
    assert doc and doc.get("private") is True


def test_admin_lists_unknown_prefix():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Nope"}, headers=PRO)
    assert r.status_code == 400


def test_admin_lists_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Boat Budget"})
    assert r.status_code == 401


# --- owner boat budget fields ---
@pytest.fixture(scope="module")
def pro_state():
    r = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, headers=PRO)
    assert r.status_code == 200, r.text
    return r.json()


def test_owner_has_budget_list(pro_state):
    reg = [l for l in pro_state["registry"] if l.get("kind") == "budget"]
    assert reg and reg[0]["id"] == "boatBudget"
    assert "boatBudget" in pro_state["data"]
    for k in ("make", "model", "budget_currency", "budget_notes"):
        assert k in pro_state["boat"]


def test_owner_put_make_model_persist(pro_state):
    body = {k: pro_state[k] for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "deleted_lists", "sec_ts", "list_ts") if k in pro_state}
    orig = dict(pro_state["boat"])
    body["boat"] = {**orig, "make": "  TEST_Make  ", "model": "TEST_Model", "budget_currency": "usd"}
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    body["updated_at"] = now
    body["sec_ts"] = {**(pro_state.get("sec_ts") or {}), "boat": now}
    r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=body, headers=PRO)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, headers=PRO).json()["boat"]
    try:
        assert g["make"].strip() == "TEST_Make"
        print("make stored as", repr(g["make"]))
        assert g["model"] == "TEST_Model"
        assert g["budget_currency"] in ("USD", "usd")
        print("currency stored as", g["budget_currency"])
    finally:
        now2 = datetime.now(timezone.utc).isoformat()
        body["boat"] = orig
        body["updated_at"] = now2
        body["sec_ts"] = {**body["sec_ts"], "boat": now2}
        requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=body, headers=PRO)


# --- crew privacy ---
@pytest.fixture(scope="module")
def crew_setup():
    def add(db):
        return db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$addToSet": {"crew": CREW}})
    def seed_notes(db):
        return db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"boat.budget_notes": "TEST_notes_secret"}})
    before = run(lambda db: db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "crew": 1, "boat.budget_notes": 1}))
    was_crew = CREW in (before.get("crew") or [])
    old_notes = (before.get("boat") or {}).get("budget_notes", "")
    run(add)
    if not old_notes:
        run(seed_notes)
    yield
    if not was_crew:
        run(lambda db: db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$pull": {"crew": CREW}}))
    if not old_notes:
        run(lambda db: db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {"boat.budget_notes": old_notes}}))


def test_crew_does_not_see_budget(crew_setup):
    r = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": OWNER}, headers=FREE)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "crew"
    assert not any(l.get("kind") == "budget" for l in d["registry"])
    assert "boatBudget" not in d["data"]
    assert d["boat"]["budget_notes"] == ""


def test_crew_put_keeps_owner_budget(crew_setup):
    before = run(lambda db: db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "data.boatBudget": 1, "boat.budget_notes": 1, "registry": 1}))
    d = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": OWNER}, headers=FREE).json()
    body = {k: d[k] for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "deleted_lists", "sec_ts", "list_ts") if k in d}
    r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT, "owner": OWNER}, json=body, headers=FREE)
    assert r.status_code == 200, r.text
    assert "boatBudget" not in r.json()["data"]
    after = run(lambda db: db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "data.boatBudget": 1, "boat.budget_notes": 1, "registry": 1}))
    assert after["data"]["boatBudget"] == before["data"]["boatBudget"]
    assert after["boat"]["budget_notes"] == before["boat"]["budget_notes"]
    assert any(l.get("kind") == "budget" for l in after["registry"])


def test_owner_still_sees_notes(crew_setup):
    d = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, headers=PRO).json()
    assert d["boat"]["budget_notes"] != ""


# --- AI budget ---
@pytest.fixture
def first200_off():
    doc = run(lambda db: db.app_settings.find_one({"key": "first200"}, {"_id": 0, "running": 1}))
    was = bool(doc and doc.get("running"))
    if was:
        run(lambda db: db.app_settings.update_one({"key": "first200"}, {"$set": {"running": False}}))
        import time; time.sleep(11)
    yield
    if was:
        run(lambda db: db.app_settings.update_one({"key": "first200"}, {"$set": {"running": True}}))


def test_ai_budget_free_forbidden(first200_off):
    r = requests.post(f"{BASE_URL}/api/ai/budget", json={"make": "Beneteau", "model": "Oceanis 38"}, headers=FREE)
    assert r.status_code in (402, 403), r.text


def test_ai_budget_requires_make_or_model():
    r = requests.post(f"{BASE_URL}/api/ai/budget", json={"make": "", "model": ""}, headers=PRO)
    assert r.status_code == 422


def test_ai_budget_bad_units():
    r = requests.post(f"{BASE_URL}/api/ai/budget", json={"make": "X", "units": "yd"}, headers=PRO)
    assert r.status_code == 422


def test_ai_budget_beta_success():
    r = requests.post(f"{BASE_URL}/api/ai/budget", json={"make": "Beneteau", "model": "Oceanis 38", "boat_type": "Sloop", "currency": "NZD", "loa": "11.5"},
                      headers=BETA, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d["answer"], str) and len(d["answer"]) > 40
    assert "*" not in d["answer"] and "#" not in d["answer"]
    assert "asks_left" in d
    print(d["answer"])
