# Model Vessel walkthrough progress (wizards event/mine), analytics tutorials, and Copy/Paste list import flow
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
KIND = "my-boat-prep-template-lists"
CREATED = []


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    _clear_free()
    yield
    _clear_free()
    for lid in CREATED:
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{lid}", headers=ADMIN)


def _clear_free():
    # only the free test user's walkthrough progress, created by this test
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]].wizard_progress.delete_many({"user_id": "test-user-free"})


def _tut(title):
    r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=ADMIN)
    assert r.status_code == 200
    return r.json()["tutorials"], next((t for t in r.json()["tutorials"] if t["title"].lower() == title), None)


# Wizard events
class TestWizards:
    def test_auth_required(self):
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": "x", "event": "open"}).status_code == 401
        assert requests.get(f"{BASE_URL}/api/wizards/mine").status_code == 401

    def test_validation(self):
        r = requests.post(f"{BASE_URL}/api/wizards/event", headers=FREE, json={"wizard": "crew registration and invites", "event": "bogus"})
        assert r.status_code == 422
        r = requests.post(f"{BASE_URL}/api/wizards/event", headers=FREE, json={"wizard": "", "event": "open"})
        assert r.status_code == 422

    def test_open_then_finish_flow(self):
        key = "crew registration and invites"
        _, before = _tut(key)
        assert before is not None
        r = requests.post(f"{BASE_URL}/api/wizards/event", headers=FREE, json={"wizard": key, "event": "open"})
        assert r.status_code == 200 and r.json()["ok"] is True
        mine = requests.get(f"{BASE_URL}/api/wizards/mine", headers=FREE).json()
        assert key not in mine["finished"]
        _, t1 = _tut(key)
        assert t1["opens"] == before["opens"] + 1
        assert t1["first_at"]
        requests.post(f"{BASE_URL}/api/wizards/event", headers=FREE, json={"wizard": "  Crew Registration and Invites ", "event": "open"})
        requests.post(f"{BASE_URL}/api/wizards/event", headers=FREE, json={"wizard": key, "event": "finish"})
        mine = requests.get(f"{BASE_URL}/api/wizards/mine", headers=FREE).json()
        assert key in mine["finished"]
        _, t2 = _tut(key)
        assert t2["opens"] == before["opens"] + 2  # finish doesn't increment opens
        assert t2["users"] == max(before["users"], 1) or t2["users"] == before["users"] + 1
        assert t2["finished"] >= 1
        assert t2["first_at"] == t1["first_at"]  # first_at kept

    def test_analytics_tutorials_shape(self):
        tuts, _ = _tut("x")
        assert len(tuts) >= 2
        assert tuts[0]["title"].lower() == "basic introduction walkthrough"
        for t in tuts:
            assert set(t) >= {"title", "users", "opens", "finished", "first_at"}

    def test_analytics_admin_only(self):
        assert requests.get(f"{BASE_URL}/api/admin/analytics", headers=PRO).status_code == 403


# Copy list -> Paste list (import endpoint)
class TestCopyPaste:
    def test_copy_paste_overwrite_and_add(self):
        name = f"TEST_Copy {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, json={"name": name, "description": "d", "items": ["One", "Two"]})
        assert r.status_code == 200, r.text
        t = r.json()
        CREATED.append(t["id"])
        copied = {"kind": KIND, "version": 1, "lists": [{"list_id": t["id"], "name": t["name"], "custom": True, "description": t["description"], "private": bool(t["private"]), "note": "", "items": t["items"], "created_at": t.get("created_at") or ""}]}
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json={**copied, "dry_run": True})
        assert r.status_code == 200, r.text
        assert r.json()["lists"][0]["action"] == "unchanged"
        # edit -> overwrite
        copied["lists"][0]["items"] = copied["lists"][0]["items"] + [{"id": "i_test3", "label": "Three"}]
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json={**copied, "dry_run": False})
        assert r.status_code == 200, r.text
        assert r.json()["lists"][0]["action"] == "overwrite"
        lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
        got = next(x for x in lists if x["id"] == t["id"])
        assert [i["label"] for i in got["items"]] == ["One", "Two", "Three"]
        # rename -> add
        copied["lists"][0]["name"] = name + " B"
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json={**copied, "dry_run": False})
        assert r.json()["lists"][0]["action"] == "add"
        lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
        b = next(x for x in lists if x["name"] == name + " B")
        CREATED.append(b["id"])
        assert len(b["items"]) == 3

    def test_crew_roles_copy_unchanged(self):
        lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
        t = next(x for x in lists if x["name"] == "Crew Roles")
        copied = {"kind": KIND, "lists": [{"list_id": t["id"], "name": t["name"], "custom": True, "description": t.get("description") or "", "private": bool(t["private"]), "note": "", "items": t["items"], "created_at": t.get("created_at") or ""}], "dry_run": True}
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json=copied)
        assert r.status_code == 200, r.text
        assert r.json()["lists"][0]["action"] == "unchanged"

    def test_bad_kind(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists/import", headers=ADMIN, json={"kind": "nope", "lists": [], "dry_run": True})
        assert r.status_code == 400
