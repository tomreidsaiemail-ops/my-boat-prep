# Crew Roles picks: admin template '*' defaults, Racing Roles migration, GET /boats/{id}/crew role_options, invites with roles
import os
import copy
import asyncio
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
H = {"Authorization": "Bearer test_session_pro_1"}
OWNER, BOAT = "test-user-pro", "main"


def run(coro):
    async def wrap():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        return await coro(db)
    return asyncio.run(wrap())


def crew_list_id():
    async def f(db):
        b = await db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, "registry": 1})
        return next((l["id"] for l in b.get("registry") or [] if l["name"].strip().lower() == "crew roles"), None)
    return run(f)


def get_items(lid):
    async def f(db):
        b = await db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"_id": 0, f"data.{lid}": 1})
        return ((b or {}).get("data") or {}).get(lid)
    return run(f)


def set_items(lid, items):
    async def f(db):
        await db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": {f"data.{lid}": items}})
    return run(f)


def role_opts():
    r = requests.get(f"{BASE_URL}/api/boats/{BOAT}/crew", headers=H, timeout=20)
    assert r.status_code == 200
    return r.json()["role_options"]


@pytest.fixture(scope="module")
def saved_items():
    lid = crew_list_id()
    if not lid:
        pytest.skip("Pro boat has no Crew Roles list (open the app once to add it)")
    orig = copy.deepcopy(get_items(lid))
    yield lid, orig
    set_items(lid, orig)


# Migration: Racing Roles inserted after Safety & Emergency, once
def test_template_racing_roles_once():
    async def f(db):
        return await db.list_templates.find_one({"custom": True, "name": {"$regex": "^crew roles$", "$options": "i"}}, {"_id": 0, "items": 1})
    items = run(f)["items"]
    labels = [i["label"] for i in items]
    heads = [i["label"] for i in items if not i.get("indent")]
    assert sum("racing roles" in l.lower() for l in labels) == 1
    assert heads.index("3. Racing Roles") == heads.index("2. Safety & Emergency") + 1
    k = labels.index("3. Racing Roles")
    assert labels[k + 1:k + 6] == ["Port Trim", "Starboard Trim", "Mainsheet", "Helm", "Foredeck (headsail/spinnaker)"]
    assert all(i.get("indent") for i in items[k + 1:k + 6])


def test_migration_marker():
    async def f(db):
        return await db.migrations.find_one({"_id": "crew_racing_roles"})
    assert run(f) is not None


# role_options: ticked only, no headings, no '*'
def test_role_options_ticked_only(saved_items):
    lid, orig = saved_items
    items = copy.deepcopy(orig)
    for i in items:
        i["checked"] = i["label"].lstrip("*") in ("Skipper", "Helm")
    set_items(lid, items)
    opts = role_opts()
    assert "Skipper" in opts and "Helm" in opts
    assert "Cook" not in opts and "Navigator" not in opts
    assert not any(o.startswith("*") for o in opts)
    assert not any("Sailing" in o or "Racing Roles" in o for o in opts)


def test_role_options_none_ticked_all(saved_items):
    lid, orig = saved_items
    items = [{**i, "checked": False} for i in orig]
    set_items(lid, items)
    opts = role_opts()
    for r in ["Skipper", "Navigator", "Cook", "First Aider", "MOB Spotter", "Port Trim", "Helm", "Foredeck (headsail/spinnaker)"]:
        assert r in opts
    assert not any("Safety" in o for o in opts)


def test_role_options_not_capped(saved_items):
    lid, orig = saved_items
    items = [{**i, "checked": False} for i in orig]
    nid = 1000
    items += [{"id": nid, "label": "TEST_Extra"}] + [{"id": nid + k + 1, "label": f"TEST_Role {k}", "indent": True, "checked": True} for k in range(15)]
    set_items(lid, items)
    opts = role_opts()
    assert len(opts) >= 15
    assert "TEST_Role 14" in opts


# Invite with roles then cancel
def test_invite_roles_and_cancel(saved_items):
    r = requests.post(f"{BASE_URL}/api/boats/{BOAT}/invites", headers=H, timeout=30,
                      json={"email": "qa-crew@example.com", "roles": ["Helm", "Skipper"], "notes": "TEST_ race", "send_email": False})
    assert r.status_code in (200, 201), r.text
    crew = requests.get(f"{BASE_URL}/api/boats/{BOAT}/crew", headers=H, timeout=20).json()
    inv = [i for i in crew["invites"] if i["email"] == "qa-crew@example.com"]
    assert inv and inv[0]["roles"] == ["Helm", "Skipper"]
    for i in inv:
        d = requests.delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{i['invite_id']}", headers=H, timeout=20)
        assert d.status_code == 200
    crew = requests.get(f"{BASE_URL}/api/boats/{BOAT}/crew", headers=H, timeout=20).json()
    assert not [i for i in crew["invites"] if i["email"] == "qa-crew@example.com"]
