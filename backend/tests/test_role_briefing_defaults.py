# Default Role Briefings in admin "Crew Roles" template (iteration 119): migration, admin PUT push, keep-own/blank, versions, export/import
# NOTE: mutates the shared Crew Roles template + every boat's Crew Roles list. Back up and restore around it (see /tmp/bk119 in iteration_119).
import os
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
LID = "tpl_test67crew"
TRIM = ("Watch out for the boom at all times! Re trimming, put 3 to 4 wraps clockwise on the drum, keep your thumbs out and palms facing the winch, "
        "and hold the tail clear of the pinch area without wrapping it around your hand or body.")


def mongo(coro_fn):
    async def run():
        db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
        return await coro_fn(db)
    return asyncio.run(run())


def tpl():
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN)
    assert r.status_code == 200
    return next(t for t in r.json() if t["id"] == LID)


def pro_items():
    r = requests.get(f"{BASE_URL}/api/me/boat", headers=PRO, params={"boat_id": "main"})
    assert r.status_code == 200
    return {i["label"]: i for i in r.json()["data"][LID]}, r.json()


def put_tpl(briefs):
    t = tpl()
    items = [{"label": i["label"], "indent": bool(i.get("indent")), **({"briefing": briefs[i["label"]]} if briefs.get(i["label"]) else {})} for i in t["items"]]
    return requests.put(f"{BASE_URL}/api/admin/template-lists/{LID}", headers=ADMIN, json={"name": t["name"], "description": t["description"], "items": items})


class TestMigration:
    def test_template_has_trim_briefings(self):
        it = {i["label"]: i for i in tpl()["items"]}
        assert it["Port Trim"]["briefing"] == TRIM
        assert it["Starboard Trim"]["briefing"] == TRIM
        assert "briefing" not in it["Helm"]

    def test_pro_boat_has_trim_briefings(self):
        it, _ = pro_items()
        assert it["Port Trim"]["briefing"] == TRIM
        assert it["Starboard Trim"]["briefing"] == TRIM


class TestAdminPush:
    def test_push_respects_own_and_blank(self):
        # skipper's own briefing on Helm, blanked Navigator
        async def setup(db):
            b = await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
            items = [{**i, "briefing": "TEST_own helm"} if i["label"] == "Helm" else {**i, "briefing": ""} if i["label"] == "Navigator" else i for i in b["data"][LID]]
            await db.user_boats.update_one({"_id": b["_id"]}, {"$set": {f"data.{LID}": items}})
        mongo(setup)
        before_tv = pro_items()[1]["template_versions"].get(LID)
        assert before_tv == tpl()["updated_at"], "pro boat should start up to date"
        briefs = {"Port Trim": TRIM, "Starboard Trim": TRIM, "Mainsheet": "TEST_ mainsheet brief", "Helm": "TEST_ admin helm", "*Navigator": "TEST_ admin nav"}
        r = put_tpl(briefs)
        assert r.status_code == 200, r.text
        it = {i["label"]: i for i in r.json()["items"]}
        assert it["Mainsheet"]["briefing"] == "TEST_ mainsheet brief"
        assert it["Port Trim"]["briefing"] == TRIM
        new_updated = r.json()["updated_at"]
        assert tpl()["items"] == r.json()["items"]
        pi, state = pro_items()
        assert pi["Mainsheet"]["briefing"] == "TEST_ mainsheet brief"
        assert pi["Helm"]["briefing"] == "TEST_own helm"
        assert pi["Navigator"]["briefing"] == ""
        assert pi["Port Trim"]["briefing"] == TRIM
        assert state["template_versions"].get(LID) == new_updated, "briefing-only change must keep boat up to date"

    def test_briefing_too_long(self):
        t = tpl()
        items = [{"label": i["label"], "indent": bool(i.get("indent")), **({"briefing": "x" * 1001} if i["label"] == "Helm" else {})} for i in t["items"]]
        r = requests.put(f"{BASE_URL}/api/admin/template-lists/{LID}", headers=ADMIN, json={"name": t["name"], "items": items})
        assert r.status_code == 422

    def test_non_admin_forbidden(self):
        r = requests.put(f"{BASE_URL}/api/admin/template-lists/{LID}", headers=PRO, json={"name": "Crew Roles", "items": ["a"]})
        assert r.status_code in (401, 403)


class TestBackup:
    def test_export_carries_briefing(self):
        r = requests.get(f"{BASE_URL}/api/admin/template-lists/export", headers=ADMIN)
        assert r.status_code == 200
        lst = next(x for x in r.json()["lists"] if x["list_id"] == LID)
        assert {i["label"]: i.get("briefing") for i in lst["items"]}["Port Trim"] == TRIM

    def test_import_dry_run_unchanged(self):
        exp = requests.get(f"{BASE_URL}/api/admin/template-lists/export", headers=ADMIN).json()
        crew = [x for x in exp["lists"] if x["list_id"] == LID]
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json={"kind": exp["kind"], "lists": crew, "dry_run": True})
        assert r.status_code == 200, r.text
        assert r.json()["lists"][0]["action"] == "unchanged", f"re-importing a fresh export should be unchanged, got {r.json()['lists'][0]}"
