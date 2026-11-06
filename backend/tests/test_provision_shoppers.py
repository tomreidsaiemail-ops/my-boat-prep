# Iteration 122: Provisions shoppers - invite_html/shopping_html, InviteIn.shopping, POST /boats/{id}/crew/shopping, galley crew shopper sync
import os
import sys
import time
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
sys.path.insert(0, '/app/backend')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
PRO, FREE, BETA = "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
CREW_Q = {"boat_id": "main", "owner": "test-user-pro"}
FIELDS = ("data", "list_ts", "crew_roles", "updated_at")


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


def boat_doc():
    return mongo(lambda db: db.user_boats.find_one(KEY, {"_id": 0}))


def future(sec=60):
    return (datetime.now(timezone.utc) + timedelta(seconds=sec)).isoformat().replace("+00:00", "Z")


CREATED_INVITES = []


@pytest.fixture(scope="module", autouse=True)
def restore_boat():
    snap = boat_doc()
    yield
    mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {k: snap.get(k) for k in FIELDS if k in snap}}))
    if "crew_roles" not in snap:
        mongo(lambda db: db.user_boats.update_one(KEY, {"$unset": {"crew_roles": ""}}))
    for iid in CREATED_INVITES:
        mongo(lambda db, iid=iid: db.crew_invites.delete_one({"invite_id": iid}))


# ---- unit: html builders ----
class TestHtml:
    def test_shopping_html(self):
        from crew import shopping_html
        out = shopping_html(["Milk", "<b>Eggs</b>"])
        assert "Food to bring on board" in out
        assert "<li>Milk</li>" in out and "&lt;b&gt;Eggs&lt;/b&gt;" in out
        assert shopping_html([]) == ""

    def test_invite_html_with_and_without_shopping(self):
        from crew import invite_html
        withs = invite_html("Skip", "Boaty", "a@b.com", "https://x/", ["Helm"], "Race", {}, "Ann", ["Bread", "Cheese"])
        assert "Food to bring on board" in withs and "<li>Bread</li>" in withs and "<li>Cheese</li>" in withs
        assert withs.index("Your role") < withs.index("Food to bring") < withs.index("Planned voyage")
        without = invite_html("Skip", "Boaty", "a@b.com", "https://x/", ["Helm"], "Race", {}, "Ann")
        assert "Food to bring" not in without


# ---- POST /boats/{id}/invites accepts shopping (beta owner, send_email false) ----
class TestInviteShopping:
    def test_invite_accepts_shopping(self):
        email = f"test_shop_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST Shopper", "email": email, "roles": [], "notes": "",
                          "shopping": ["Milk", "Bread"], "send_email": False}, headers=h(BETA))
        if r.status_code == 429:
            pytest.skip("daily invite limit")
        assert r.status_code == 200, r.text
        CREATED_INVITES.append(r.json()["invite_id"])
        assert r.json()["name"] == "TEST Shopper"

    def test_invite_shopping_item_too_long_422(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST X", "email": "test_x@example.com", "shopping": ["x" * 201], "send_email": False}, headers=h(BETA))
        assert r.status_code == 422


# ---- POST /boats/{id}/crew/shopping ----
class TestSendShopping:
    def test_crew_member_200(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "test.user.free@example.com", "name": "TEST Free Crew", "items": ["TEST_Milk"]},
                          headers=h(PRO), timeout=40)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

    def test_crew_member_case_insensitive_email(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "TEST.User.Free@Example.com", "name": "", "items": ["TEST_Eggs"]},
                          headers=h(PRO), timeout=40)
        assert r.status_code == 200, r.text

    def test_pending_invite_200(self):
        iid = str(uuid.uuid4())
        email = f"test_pending_{iid[:6]}@example.com"
        now = datetime.now(timezone.utc)
        mongo(lambda db: db.crew_invites.insert_one({"invite_id": iid, "token_hash": "x", "owner_id": "test-user-pro", "boat_id": "main", "email": email,
                                                     "email_key": email, "name": "TEST Pending", "roles": [], "created_at": now.isoformat(),
                                                     "expires_at": (now + timedelta(days=7)).isoformat()}))
        CREATED_INVITES.append(iid)
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": email, "name": "TEST Pending", "items": ["TEST_Cheese"]}, headers=h(PRO), timeout=40)
        assert r.status_code == 200, r.text

    def test_stranger_404(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "stranger_xyz@example.com", "items": ["Milk"]}, headers=h(PRO))
        assert r.status_code == 404
        assert "crew" in r.json()["detail"].lower()

    def test_empty_items_422(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "test.user.free@example.com", "items": []}, headers=h(PRO))
        assert r.status_code == 422

    def test_non_owner_404(self):
        # free user is crew on pro's boat but owns its own "main" without that crew -> 404
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "test.user.pro@example.com", "items": ["Milk"]}, headers=h(FREE))
        assert r.status_code in (403, 404)

    def test_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "a@b.com", "items": ["Milk"]})
        assert r.status_code == 401


# ---- crew sync: galley crew may set shopper on Provisions; others can't ----
def crew_get():
    r = requests.get(f"{BASE_URL}/api/me/boat", params=CREW_Q, headers=h(FREE))
    assert r.status_code == 200, r.text
    return r.json()


def crew_put(st):
    body = {k: st.get(k) for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "electrical_log", "rigging_log", "deleted_lists",
                                   "emergency_checked", "list_hidden", "template_versions", "sec_ts", "list_ts", "areas") if st.get(k) is not None}
    r = requests.put(f"{BASE_URL}/api/me/boat", params=CREW_Q, json=body, headers=h(FREE))
    assert r.status_code == 200, r.text


def set_roles(roles):
    mongo(lambda db: db.user_boats.update_one(KEY, {"$set": {"crew_roles.test-user-free": roles}}))


class TestGalleyShopperSync:
    def test_galley_crew_sets_shopper(self):
        set_roles(["Provision Manager"])
        st = crew_get()
        items = st["data"]["provisions"]
        target = next(i for i in items if not i.get("checked"))
        st["data"]["provisions"] = [{**i, "shopper": "TEST Free Crew"} if i["id"] == target["id"] else i for i in items]
        st["list_ts"] = {**(st.get("list_ts") or {}), "provisions": future()}
        crew_put(st)
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") == "TEST Free Crew"

    def test_no_role_crew_cannot_set_shopper(self):
        set_roles(["Helm"])
        st = crew_get()
        items = st["data"]["provisions"]
        target = [i for i in items if not i.get("checked")][-1]
        st["data"]["provisions"] = [{**i, "shopper": "TEST NoRole"} if i["id"] == target["id"] else i for i in items]
        st["list_ts"] = {**(st.get("list_ts") or {}), "provisions": future(120)}
        crew_put(st)
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") != "TEST NoRole"


# ---- Iteration 123: item-level edits by galley crew without a list_ts bump ----
def _edit(st, target_id, **fields):
    st["data"]["provisions"] = [{**i, **fields, "ts": future()} if i["id"] == target_id else i for i in st["data"]["provisions"]]
    return st


class TestGalleyItemEditNoListTs:
    def test_shopper_only_edit_persists(self):
        set_roles(["Provision Manager"])
        st = crew_get()
        lts_before = (st.get("list_ts") or {}).get("provisions")
        target = [i for i in st["data"]["provisions"] if not i.get("checked")][0]
        crew_put(_edit(st, target["id"], shopper="TEST Item Shopper"))
        doc = boat_doc()
        saved = next(i for i in doc["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") == "TEST Item Shopper"
        assert doc["list_ts"].get("provisions") == lts_before

    def test_text_edit_persists(self):
        set_roles(["Galley Lead"])
        st = crew_get()
        target = [i for i in st["data"]["provisions"] if not i.get("checked")][1]
        crew_put(_edit(st, target["id"], label="TEST_Edited label"))
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("label") == "TEST_Edited label"

    def test_older_item_ts_ignored(self):
        set_roles(["Chef"])
        st = crew_get()
        target = [i for i in st["data"]["provisions"] if not i.get("checked")][0]
        st["data"]["provisions"] = [{**i, "shopper": "TEST Stale", "ts": "2000-01-01T00:00:00.000Z"} if i["id"] == target["id"] else i for i in st["data"]["provisions"]]
        crew_put(st)
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") != "TEST Stale"

    def test_no_add_delete_without_list_ts(self):
        set_roles(["Provision Manager"])
        st = crew_get()
        before = [i["id"] for i in boat_doc()["data"]["provisions"]]
        items = st["data"]["provisions"]
        st["data"]["provisions"] = items[1:] + [{"id": 999999123, "label": "TEST_Added", "checked": False, "ts": future()}]
        crew_put(st)
        after = [i["id"] for i in boat_doc()["data"]["provisions"]]
        assert after == before

    def test_no_role_item_edit_ignored(self):
        set_roles(["Helm"])
        st = crew_get()
        target = [i for i in st["data"]["provisions"] if not i.get("checked")][-1]
        crew_put(_edit(st, target["id"], shopper="TEST NoRole2", label="TEST_NoRole label"))
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") != "TEST NoRole2" and saved.get("label") != "TEST_NoRole label"

    def test_no_role_crew_empty_roles_ignored(self):
        mongo(lambda db: db.user_boats.update_one(KEY, {"$unset": {"crew_roles.test-user-free": ""}}))
        st = crew_get()
        target = [i for i in st["data"]["provisions"] if not i.get("checked")][-1]
        crew_put(_edit(st, target["id"], shopper="TEST NoRole3"))
        saved = next(i for i in boat_doc()["data"]["provisions"] if i["id"] == target["id"])
        assert saved.get("shopper") != "TEST NoRole3"


class TestShoppingBlank:
    @pytest.mark.parametrize("items", [["  "], ["", "   "], ["\t"]])
    def test_blank_items_422(self, items):
        r = requests.post(f"{BASE_URL}/api/boats/main/crew/shopping", json={"email": "test.user.free@example.com", "items": items}, headers=h(PRO))
        assert r.status_code == 422, r.text
