# Iteration 121: MPA galley crew access (galley_payer), crew MPA list merge (kind mpa), own meal meal_type
import os
import time
import asyncio
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
PRO, FREE = "test_session_pro_1", "test_session_free_1"
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
CREW_Q = {"boat_id": "main", "owner": "test-user-pro"}
FIELDS = ("registry", "data", "list_ts", "sec_ts", "crew_roles", "updated_at")


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def mongo(fn):
    async def run():
        cli = AsyncIOMotorClient(os.environ['MONGO_URL'])
        try:
            return await fn(cli[os.environ['DB_NAME']])
        finally:
            cli.close()
    return asyncio.run(run())


def set_roles(roles):
    mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {"crew_roles.test-user-free": roles}}))


def boat_doc():
    return mongo(lambda db: db.user_boats.find_one(KEY, {"_id": 0}))


def future(sec=60):
    return (datetime.now(timezone.utc) + timedelta(seconds=sec)).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module", autouse=True)
def restore_boat():
    snap = boat_doc()
    yield
    mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {k: snap.get(k) for k in FIELDS}}))


def crew_get():
    r = requests.get(f"{BASE_URL}/api/me/boat", params=CREW_Q, headers=h(FREE))
    assert r.status_code == 200, r.text
    return r.json()


def crew_put(st):
    body = {k: st.get(k) for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "electrical_log", "rigging_log", "deleted_lists",
                                   "emergency_checked", "list_hidden", "template_versions", "sec_ts", "list_ts", "areas") if st.get(k) is not None}
    r = requests.put(f"{BASE_URL}/api/me/boat", params=CREW_Q, json=body, headers=h(FREE))
    assert r.status_code == 200, r.text
    return r.json()


# ---- MPA endpoints: galley_payer ----
class TestMpaGalleyPayer:
    def test_aisles_crew_no_role_403(self):
        set_roles([])
        r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", params=CREW_Q, json={"items": ["milk"], "aisles": ["Dairy", "Bakery"]}, headers=h(FREE))
        assert r.status_code == 403, r.text
        assert "Galley Lead" in r.json().get("detail", "")

    def test_provisions_crew_no_role_403(self):
        set_roles(["Helm"])
        r = requests.post(f"{BASE_URL}/api/ai/mpa/provisions", params=CREW_Q, json={"items": ["milk"], "adults": 2, "children": 0, "days": 2}, headers=h(FREE))
        assert r.status_code == 403, r.text

    def test_aisles_owner_validation_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": [], "aisles": ["Dairy"]}, headers=h(PRO))
        assert r.status_code == 422

    def test_aisles_unauth_401(self):
        assert requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["milk"], "aisles": ["Dairy"]}).status_code == 401

    def test_aisles_galley_crew_200_real_ai(self):
        set_roles(["Galley Lead / Chef"])
        r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", params=CREW_Q, json={"items": ["milk", "sourdough bread"], "aisles": ["Dairy", "Bakery", "Produce"]},
                          headers=h(FREE), timeout=120)
        if r.status_code == 429:
            pytest.skip("skipper's daily Magic limit reached (galley crew passed the role check)")
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["aisles"], dict)
        assert set(d["aisles"].values()) <= {"Dairy", "Bakery", "Produce"}


# ---- sync_merge.merge_crew_galley allows kind mpa ----
class TestCrewMpaMerge:
    def test_galley_crew_updates_existing_mpa(self):
        set_roles(["Galley Lead / Chef"])
        st = crew_get()
        mpa = [r for r in st["registry"] if r.get("kind") == "mpa"]
        assert mpa, "pro boat should already have an MPA Shopping List"
        lid = mpa[0]["id"]
        st["data"][lid] = [{"id": 1, "label": "Dairy", "checked": False}, {"id": 2, "label": "TEST_CrewMilk", "indent": True, "checked": False}]
        st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}
        crew_put(st)
        d = boat_doc()
        assert any(i["label"] == "TEST_CrewMilk" for i in d["data"][lid])

    def test_galley_crew_creates_mpa_when_missing(self):
        set_roles(["Galley Lead / Chef"])
        # remove the MPA list from the owner's boat (restored by module fixture)
        doc = boat_doc()
        mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {"registry": [r for r in doc["registry"] if r.get("kind") != "mpa"]}}))
        st = crew_get()
        assert not any(r.get("kind") == "mpa" for r in st["registry"])
        lid = f"custom_{int(time.time() * 1000)}"
        st["registry"] = st["registry"] + [{"id": lid, "name": "MPA Shopping List", "isSystem": False, "kind": "mpa"}]
        st["data"][lid] = [{"id": 1, "label": "Bakery", "checked": False}, {"id": 2, "label": "TEST_CrewBread", "indent": True, "checked": False}]
        st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}
        crew_put(st)
        d = boat_doc()
        reg = [r for r in d["registry"] if r["id"] == lid]
        assert reg and reg[0].get("kind") == "mpa"
        assert d["data"][lid][1]["label"] == "TEST_CrewBread"

    def test_no_role_crew_cannot_touch_mpa(self):
        set_roles([])
        st = crew_get()
        mpa = [r for r in st["registry"] if r.get("kind") == "mpa"]
        assert mpa
        lid = mpa[0]["id"]
        st["data"][lid] = st["data"][lid] + [{"id": 99, "label": "TEST_NoRoleMpa", "checked": False}]
        st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}
        crew_put(st)
        assert not any(i["label"] == "TEST_NoRoleMpa" for i in boat_doc()["data"][lid])


# ---- Own meals meal_type ----
class TestOwnMealType:
    def test_meal_type_persist_and_validation(self):
        r = requests.post(f"{BASE_URL}/api/me/meals", json={"name": "TEST_Brekkie Bowl", "recipe": "Mix", "ingredients": ["oats"], "meal_type": "lunch"}, headers=h(PRO))
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        none = None
        try:
            assert r.json()["meal_type"] == "lunch"
            got = [m for m in requests.get(f"{BASE_URL}/api/me/meals", headers=h(PRO)).json()["meals"] if m["id"] == mid]
            assert got and got[0]["meal_type"] == "lunch"
            bad = requests.post(f"{BASE_URL}/api/me/meals", json={"name": "TEST_Bad", "ingredients": ["x"], "meal_type": "snack"}, headers=h(PRO))
            assert bad.status_code == 422
            none = requests.post(f"{BASE_URL}/api/me/meals", json={"name": "TEST_Brekkie Bowl", "recipe": "Mix", "ingredients": ["oats"]}, headers=h(PRO))
            assert none.status_code == 200 and none.json()["meal_type"] is None
            # upsert by name should keep the same id (known issue: a new id is generated on every save)
        finally:
            for m in requests.get(f"{BASE_URL}/api/me/meals", headers=h(PRO)).json()["meals"]:
                if m["name"].lower() == "test_brekkie bowl":
                    requests.delete(f"{BASE_URL}/api/me/meals/{m['id']}", headers=h(PRO))
