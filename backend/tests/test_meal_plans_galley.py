# Meal plans: common meals, own meals, Magic meal plan AI, galley crew rights (iteration 120)
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
PRO, FREE, ADMIN = "test_session_pro_1", "test_session_free_1", "test_session_admin_1"
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
CREW_Q = {"boat_id": "main", "owner": "test-user-pro"}


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


# ---- Common meals ----
class TestCommonMeals:
    def test_common_meals(self):
        r = requests.get(f"{BASE_URL}/api/meals/common", headers=h(PRO))
        assert r.status_code == 200
        items = r.json()["items"]
        heads = [i["label"] for i in items if not i.get("indent")]
        assert len(heads) >= 8
        assert heads[0] == "1. Scrambled Eggs"
        assert items[1]["indent"] and items[1]["label"].startswith("[")

    def test_common_meals_unauth(self):
        assert requests.get(f"{BASE_URL}/api/meals/common").status_code == 401

    def test_migration_once(self):
        n = mongo(lambda db: db.list_templates.count_documents({"custom": True, "name": {"$regex": r"^\s*common meals\s*$", "$options": "i"}}))
        assert n == 1


# ---- Own meals ----
class TestOwnMeals:
    def test_crud_upsert_isolation(self):
        body = {"name": "TEST_Curry Pot", "recipe": "[Simmer it]", "ingredients": ["1 onion", " ", "200g rice"]}
        r = requests.post(f"{BASE_URL}/api/me/meals", json=body, headers=h(PRO))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Curry Pot" and d["recipe"] == "Simmer it" and d["ingredients"] == ["1 onion", "200g rice"]
        # same name (case-insensitive) upserts
        r2 = requests.post(f"{BASE_URL}/api/me/meals", json={**body, "name": "test_curry pot", "ingredients": ["2 onions"]}, headers=h(PRO))
        assert r2.status_code == 200
        mine = requests.get(f"{BASE_URL}/api/me/meals", headers=h(PRO)).json()["meals"]
        hits = [m for m in mine if m["name"].lower() == "test_curry pot"]
        assert len(hits) == 1 and hits[0]["ingredients"] == ["2 onions"]
        # other users can't see it
        other = requests.get(f"{BASE_URL}/api/me/meals", headers=h(FREE)).json()["meals"]
        assert not any(m["name"].lower() == "test_curry pot" for m in other)
        # other user can't delete it
        requests.delete(f"{BASE_URL}/api/me/meals/{hits[0]['id']}", headers=h(FREE))
        assert any(m["id"] == hits[0]["id"] for m in requests.get(f"{BASE_URL}/api/me/meals", headers=h(PRO)).json()["meals"])
        # delete
        assert requests.delete(f"{BASE_URL}/api/me/meals/{hits[0]['id']}", headers=h(PRO)).status_code == 200
        assert not any(m["id"] == hits[0]["id"] for m in requests.get(f"{BASE_URL}/api/me/meals", headers=h(PRO)).json()["meals"])

    def test_validation(self):
        assert requests.post(f"{BASE_URL}/api/me/meals", json={"name": "", "ingredients": []}, headers=h(PRO)).status_code == 422


# ---- Magic meal plan (AI) ----
class TestMagicMealPlan:
    def test_free_user_403(self):
        if requests.get(f"{BASE_URL}/api/auth/me", headers=h(FREE)).json().get("premium"):
            pytest.skip("launch_free: every user is premium right now, 403 not reachable")
        r = requests.post(f"{BASE_URL}/api/ai/mpa/meal-plan", json={"days": 1, "meals": ["dinner"]}, headers=h(FREE))
        assert r.status_code == 403

    def test_bad_body_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/meal-plan", json={"days": 0, "meals": []}, headers=h(PRO))
        assert r.status_code == 422

    def test_pro_fresh_2_days(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/meal-plan", json={"mode": "fresh", "days": 2, "meals": ["breakfast", "dinner"], "adults": 2,
                                                                      "provisioning": "over", "note": "easy one-pot"}, headers=h(PRO), timeout=150)
        assert r.status_code == 200, r.text
        meals = r.json()["meals"]
        assert len(meals) == 4, meals
        for m in meals:
            assert m["meal_type"] in ("breakfast", "dinner") and m["name"] and m["ingredients"] and isinstance(m["day"], int)

    def test_crew_on_pro_boat_onboard_1_day(self):
        # Crew without a Provision Manager / Galley Lead role may not spend the skipper's Magics.
        r = requests.post(f"{BASE_URL}/api/ai/mpa/meal-plan", params=CREW_Q, json={"mode": "onboard", "days": 1, "meals": ["lunch"],
                          "on_board": ["rice", "tuna", "tinned tomatoes"], "provisioning": "under"}, headers=h(FREE), timeout=150)
        assert r.status_code == 403, r.text


# ---- Galley crew rights ----
@pytest.fixture(scope="class")
def restore_boat():
    snap = boat_doc()
    yield
    mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {k: snap.get(k) for k in ("registry", "data", "list_ts", "sec_ts", "crew_roles", "updated_at")}}))


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


def edit(st, lid, label):
    st["data"][lid] = st["data"][lid] + [{"id": int(time.time() * 1000), "label": label, "checked": False}]
    st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}


def new_plan(st, name):
    lid = f"custom_{int(time.time() * 1000)}"
    st["registry"] = st["registry"] + [{"id": lid, "name": name, "isSystem": False}]
    st["data"][lid] = [{"id": 1, "label": "1. Nachos", "checked": False}, {"id": 2, "label": "[Bake]", "indent": True, "checked": False},
                       {"id": 3, "label": "corn chips", "indent": True, "checked": False}]
    st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}
    return lid


def new_plain(st, name):
    lid = f"custom_{int(time.time() * 1000) + 7}"
    st["registry"] = st["registry"] + [{"id": lid, "name": name, "isSystem": False}]
    st["data"][lid] = [{"id": 1, "label": "plain item", "checked": False}]
    st["list_ts"] = {**(st.get("list_ts") or {}), lid: future()}
    return lid


@pytest.mark.usefixtures("restore_boat")
class TestGalleyCrew:
    def test_my_roles_in_boats(self):
        set_roles(["Provision Manager"])
        r = requests.get(f"{BASE_URL}/api/me/boats", headers=h(FREE))
        assert r.status_code == 200
        shared = [b for b in r.json()["boats"] if b.get("owner_id") == "test-user-pro" and b.get("boat_id") == "main"]
        assert shared and shared[0]["my_roles"] == ["Provision Manager"]

    def test_galley_edits(self):
        set_roles(["Provision Manager"])
        st = crew_get()
        edit(st, "provisions", "TEST_GalleyProv")
        edit(st, "mealPlan", "TEST_GalleyMeal")
        edit(st, "myTodo", "TEST_GalleyTodo")
        plan = new_plan(st, "TEST_Crew Plan")
        plain = new_plain(st, "TEST_Crew Plain")
        crew_put(st)
        d = boat_doc()
        assert any(i["label"] == "TEST_GalleyProv" for i in d["data"]["provisions"])
        assert any(i["label"] == "TEST_GalleyMeal" for i in d["data"]["mealPlan"])
        assert not any(i["label"] == "TEST_GalleyTodo" for i in d["data"].get("myTodo", []))
        ids = {r["id"] for r in d["registry"]}
        assert plan in ids and d["data"][plan][0]["label"] == "1. Nachos"
        assert plain not in ids and plain not in d["data"]
        # Crew re-GET sees the new plan
        assert any(r["id"] == plan for r in crew_get()["registry"])

    def test_galley_edit_existing_crew_plan(self):
        set_roles(["Galley Lead / Chef"])
        st = crew_get()
        plan = [r["id"] for r in st["registry"] if r["name"] == "TEST_Crew Plan"]
        assert plan
        edit(st, plan[0], "TEST_ExtraIngredient")
        crew_put(st)
        assert any(i["label"] == "TEST_ExtraIngredient" for i in boat_doc()["data"][plan[0]])

    def test_no_role_ignored(self):
        set_roles([])
        st = crew_get()
        edit(st, "provisions", "TEST_NoRoleProv")
        edit(st, "mealPlan", "TEST_NoRoleMeal")
        plan = new_plan(st, "TEST_NoRole Plan")
        crew_put(st)
        d = boat_doc()
        assert not any(i["label"] == "TEST_NoRoleProv" for i in d["data"]["provisions"])
        assert not any(i["label"] == "TEST_NoRoleMeal" for i in d["data"]["mealPlan"])
        assert plan not in {r["id"] for r in d["registry"]}

    def test_no_role_ticks_still_work(self):
        set_roles([])
        st = crew_get()
        it = st["data"]["provisions"][0]
        want = not it.get("checked")
        st["data"]["provisions"][0] = {**it, "checked": want, "ts": future()}
        crew_put(st)
        assert bool(boat_doc()["data"]["provisions"][0].get("checked")) == want
