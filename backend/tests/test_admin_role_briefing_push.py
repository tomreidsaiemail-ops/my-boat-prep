# Admin Crew Roles save pushes new Default Role Briefings to boats still on an earlier default (bug: admin updates not reaching skippers)
import copy
import json
import os

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
BETA = {"Authorization": "Bearer test_session_beta_1"}
LIST_ID = "tpl_9f5620bc49"
ROLE = "Helm"
ADD = "\n- TEST admin update line."
CUSTOM = "- TEST_ skipper-written helm briefing, keep me."


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def crew_lid(b):
    return next(r["id"] for r in b["registry"] if r.get("name", "").strip().lower() == "crew roles")


def boat(db, uid):
    return db.user_boats.find_one({"user_id": uid, "boat_id": "main"}) or db.user_boats.find_one({"owner_id": uid, "boat_id": "main"})


def role_item(db, uid):
    b = boat(db, uid)
    return next(i for i in b["data"][crew_lid(b)] if i["label"].strip() == ROLE)


def set_role(db, uid, item):
    b = boat(db, uid)
    lid = crew_lid(b)
    items = [item if i["label"].strip() == ROLE else i for i in b["data"][lid]]
    db.user_boats.update_one({"_id": b["_id"]}, {"$set": {f"data.{lid}": items}})


def put_tpl(tpl, items):
    lines = [{"label": i["label"], "indent": bool(i.get("indent")), "briefing": i.get("briefing")} for i in items]
    r = requests.put(f"{BASE_URL}/api/admin/template-lists/{LIST_ID}", headers=ADMIN, timeout=60,
                     json={"name": tpl["name"], "description": tpl.get("description", ""), "items": lines, "note": "TEST role briefing push"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def state(db):
    tpl = db.list_templates.find_one({"list_id": LIST_ID}, {"_id": 0})
    json.dump(tpl, open("/tmp/tpl_9f5620bc49_backup.json", "w"), default=str)
    orig = {u: copy.deepcopy(role_item(db, u)) for u in ("test-user-beta", "test-admin-1", "test-user-free", "test-user-pro")}
    default = next(i["briefing"] for i in tpl["items"] if i["label"].strip() == ROLE)
    assert orig["test-user-beta"]["briefing"] == default, "beta must start on admin default"
    # Setup: admin boat blanked, free boat skipper-written
    set_role(db, "test-admin-1", {**orig["test-admin-1"], "briefing": ""})
    set_role(db, "test-user-free", {**orig["test-user-free"], "briefing": CUSTOM})
    yield {"tpl": tpl, "orig": orig, "default": default}
    # Teardown: restore template text exactly + boats
    cur = db.list_templates.find_one({"list_id": LIST_ID}, {"_id": 0})
    if next(i.get("briefing") for i in cur["items"] if i["label"].strip() == ROLE) != default:
        put_tpl(cur, tpl["items"])
    set_role(db, "test-admin-1", orig["test-admin-1"])
    set_role(db, "test-user-free", orig["test-user-free"])


class TestAdminRolePush:
    def test_admin_save_pushes_new_default(self, db, state):
        new_items = [{**i, "briefing": i["briefing"] + ADD} if i["label"].strip() == ROLE else i for i in state["tpl"]["items"]]
        out = put_tpl(state["tpl"], new_items)
        assert next(i["briefing"] for i in out["items"] if i["label"].strip() == ROLE) == state["default"] + ADD
        beta = role_item(db, "test-user-beta")
        assert beta["briefing"] == state["default"] + ADD
        assert beta.get("ts") != state["orig"]["test-user-beta"].get("ts")
        # via API as the skipper
        r = requests.get(f"{BASE_URL}/api/me/boat", headers=BETA, timeout=30)
        assert r.status_code == 200
        d = r.json()
        lid = crew_lid(d)
        assert next(i for i in d["data"][lid] if i["label"].strip() == ROLE)["briefing"].endswith("- TEST admin update line.")

    def test_skipper_written_untouched(self, db, state):
        assert role_item(db, "test-user-free")["briefing"] == CUSTOM
        assert role_item(db, "test-user-pro")["briefing"] == state["orig"]["test-user-pro"]["briefing"]
        assert role_item(db, "test-user-pro").get("ts") == state["orig"]["test-user-pro"].get("ts")

    def test_blank_stays_blank(self, db, state):
        assert role_item(db, "test-admin-1")["briefing"] == ""

    def test_restore_follows_back(self, db, state):
        cur = db.list_templates.find_one({"list_id": LIST_ID}, {"_id": 0})
        put_tpl(cur, state["tpl"]["items"])
        after = db.list_templates.find_one({"list_id": LIST_ID}, {"_id": 0})
        assert [(i["label"], i.get("briefing")) for i in after["items"]] == [(i["label"], i.get("briefing")) for i in state["tpl"]["items"]]
        assert role_item(db, "test-user-beta")["briefing"] == state["default"]
        assert role_item(db, "test-user-free")["briefing"] == CUSTOM
        assert role_item(db, "test-admin-1")["briefing"] == ""
        assert role_item(db, "test-user-pro")["briefing"] == state["orig"]["test-user-pro"]["briefing"]
