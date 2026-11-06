# Iteration 115: Users yesterday analytics, template list export/import, zone follow-ups
import io
import os
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"Cookie": "session_token=test_session_admin_1"}
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
TAG = uuid.uuid4().hex[:6]


def mongo(coro_fn):
    async def run():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        try:
            return await coro_fn(c[os.environ["DB_NAME"]])
        finally:
            c.close()
    return asyncio.run(run())


def midnights():
    t = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return t, t - timedelta(days=1)


def params():
    t, y = midnights()
    return {"since": t.isoformat(), "yesterday": y.isoformat()}


# ---------------- Users yesterday ----------------
SEEDED_ACT = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_activity():
    yield
    if SEEDED_ACT:
        mongo(lambda db: db.user_activity.delete_many({"_id": {"$in": SEEDED_ACT}}))
    mongo(lambda db: db.users.delete_many({"user_id": f"TEST_act_{TAG}"}))
    mongo(lambda db: db.user_sessions.delete_many({"session_token": f"TEST_act_sess_{TAG}"}))
    mongo(lambda db: db.user_activity.delete_many({"user_id": f"TEST_act_{TAG}"}))


def seed_act(user_id, first, last, hour):
    async def f(db):
        r = await db.user_activity.insert_one({"user_id": user_id, "hour": hour, "first": first.isoformat(), "last": last.isoformat(),
                                               "expires": datetime.now(timezone.utc) + timedelta(hours=2)})
        SEEDED_ACT.append(r.inserted_id)
    mongo(f)


class TestUsersYesterday:
    def test_non_admin_403(self):
        r = requests.get(f"{API}/admin/users-yesterday", params=params(), headers=PRO, timeout=30)
        assert r.status_code == 403

    def test_unauth_401(self):
        assert requests.get(f"{API}/admin/users-yesterday", params=params(), timeout=30).status_code == 401

    def test_seeded_activity_yesterday_with_last_seen_today(self):
        requests.get(f"{API}/auth/me", headers=FREE, timeout=30)  # free user last_seen is today
        t, y = midnights()
        seed_act("test-user-free", y + timedelta(hours=10), y + timedelta(hours=10, minutes=20), f"TEST_{TAG}_a")
        # boundary straddle: started before yesterday, last within yesterday
        seed_act("test-user-beta", y - timedelta(minutes=30), y + timedelta(minutes=5), f"TEST_{TAG}_b")
        r = requests.get(f"{API}/admin/users-yesterday", params=params(), headers=ADMIN, timeout=30)
        assert r.status_code == 200
        users = r.json()["users"]
        emails = [u["email"] for u in users]
        assert "test.user.free@example.com" in emails
        assert "test.user.beta@example.com" in emails
        row = next(u for u in users if u["email"] == "test.user.free@example.com")
        assert set(row) == {"name", "email", "role", "last_seen"}
        assert y.isoformat() <= row["last_seen"] < t.isoformat()
        assert row["role"] == "free"
        seen = [u["last_seen"] for u in users]
        assert seen == sorted(seen, reverse=True)
        assert len(set(emails)) == len(emails)

    def test_activity_outside_range_excluded(self):
        t, y = midnights()
        uid = "test-user-password-act"  # nonexistent user id -> must not crash
        seed_act(uid, y - timedelta(days=2), y - timedelta(days=2) + timedelta(minutes=5), f"TEST_{TAG}_c")
        r = requests.get(f"{API}/admin/users-yesterday", params=params(), headers=ADMIN, timeout=30)
        assert r.status_code == 200
        # activity in today only is excluded from yesterday
        seed_act("test-user-free", t + timedelta(minutes=1), t + timedelta(minutes=2), f"TEST_{TAG}_d")
        r2 = requests.get(f"{API}/admin/users-yesterday", params=params(), headers=ADMIN, timeout=30)
        row = next(u for u in r2.json()["users"] if u["email"] == "test.user.free@example.com")
        assert row["last_seen"] < t.isoformat()

    def test_analytics_count_matches(self):
        p = params()
        a = requests.get(f"{API}/admin/analytics", params=p, headers=ADMIN, timeout=60)
        assert a.status_code == 200
        g = a.json()["growth"]
        assert "users_today" in g
        u = requests.get(f"{API}/admin/users-yesterday", params=p, headers=ADMIN, timeout=30).json()["users"]
        assert g["users_yesterday"] == len(u)
        assert g["users_yesterday"] >= 2

    def test_missing_yesterday_param_defaults_24h(self):
        t, _ = midnights()
        r = requests.get(f"{API}/admin/users-yesterday", params={"since": t.isoformat()}, headers=ADMIN, timeout=30)
        assert r.status_code == 200
        assert "test.user.free@example.com" in [u["email"] for u in r.json()["users"]]

    def test_users_today_still_works(self):
        r = requests.get(f"{API}/admin/users-today", params={"since": midnights()[0].isoformat()}, headers=ADMIN, timeout=30)
        assert r.status_code == 200
        assert "tomreidsaiemail@gmail.com" in [u["email"] for u in r.json()["users"]]

    def test_mark_seen_upserts_activity(self):
        uid, tok = f"TEST_act_{TAG}", f"TEST_act_sess_{TAG}"
        now = datetime.now(timezone.utc)

        async def f(db):
            await db.users.insert_one({"user_id": uid, "email": f"test.user.act{TAG}@example.com", "name": "TEST Act", "picture": "", "role": "free",
                                       "created_at": now.isoformat()})
            await db.user_sessions.insert_one({"user_id": uid, "session_token": tok, "expires_at": now + timedelta(hours=1), "created_at": now})
        mongo(f)
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code == 200
        requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        docs = mongo(lambda db: db.user_activity.find({"user_id": uid}, {"_id": 0}).to_list(10))
        assert len(docs) == 1
        d = docs[0]
        assert d["hour"] == datetime.now(timezone.utc).strftime("%Y-%m-%dT%H") or d["hour"] == now.strftime("%Y-%m-%dT%H")
        assert d["first"] <= d["last"] and isinstance(d["expires"], datetime)


# ---------------- Template lists export / import ----------------
CREATED_LISTS = []
ORIG = {}


@pytest.fixture(scope="class")
def original():
    r = requests.get(f"{API}/admin/template-lists/export", headers=ADMIN, timeout=60)
    assert r.status_code == 200
    ORIG.update(r.json())
    yield ORIG
    for lid in CREATED_LISTS:
        requests.delete(f"{API}/admin/template-lists/{lid}", headers=ADMIN, timeout=30)
    # restore original state
    requests.post(f"{API}/admin/template-lists/import", json={**ORIG, "dry_run": False}, headers=ADMIN, timeout=60)


def imp(lists, dry=True, kind="my-boat-prep-template-lists"):
    return requests.post(f"{API}/admin/template-lists/import", json={"kind": kind, "lists": lists, "dry_run": dry}, headers=ADMIN, timeout=60)


def custom(name, labels, list_id=None, **kw):
    return {"list_id": list_id or f"TEST_{uuid.uuid4().hex[:8]}", "name": name, "custom": True, "description": kw.get("description", ""),
            "private": kw.get("private", True), "note": "", "items": [{"id": i + 1, "label": l} for i, l in enumerate(labels)]}


def admin_lists():
    r = requests.get(f"{API}/admin/template-lists", headers=ADMIN, timeout=30)
    assert r.status_code == 200
    return r.json()


class TestTemplateBackup:
    def test_export_shape(self, original):
        assert original["kind"] == "my-boat-prep-template-lists" and original["version"] == 1 and original["exported_at"]
        assert len(original["lists"]) == len(admin_lists())
        for l in original["lists"]:
            assert set(l) == {"list_id", "name", "custom", "description", "private", "note", "items", "created_at", "updated_at"}

    def test_non_admin_403(self, original):
        assert requests.get(f"{API}/admin/template-lists/export", headers=PRO, timeout=30).status_code == 403
        r = requests.post(f"{API}/admin/template-lists/import", json={"kind": "my-boat-prep-template-lists", "lists": [], "dry_run": True}, headers=PRO, timeout=30)
        assert r.status_code == 403

    def test_wrong_kind_400(self, original):
        r = imp([], kind="something-else")
        assert r.status_code == 400

    def test_roundtrip_dry_run_unchanged(self, original):
        r = imp(original["lists"])
        assert r.status_code == 200, r.text
        assert r.json()["dry_run"] is True
        assert all(l["action"] == "unchanged" for l in r.json()["lists"])

    def test_dry_run_plan_and_no_change(self, original):
        first = original["lists"][0]
        changed = {**first, "name": first["name"].upper(), "items": first["items"] + [{"id": "TESTx", "label": "TEST extra line"}]}
        lists = [changed, custom(f"TEST_New {TAG}", ["a", "b"]), custom("Safety", ["x"]), custom(f"TEST_Empty {TAG}", []),
                 custom(f"TEST_Dup {TAG}", ["a"]), custom(f"test_dup {TAG}", ["b"]),
                 {"list_id": "leavingDock", "name": "Leaving Dock", "custom": False, "items": [{"id": 1, "label": "Check weather"}]},
                 {"list_id": "notAList", "name": "Nope", "custom": False, "items": [{"id": 1, "label": "x"}]},
                 {"list_id": "mayDay", "name": "Mayday", "custom": False, "items": [{"id": 1, "label": "Mayday x3"}]}]
        r = imp(lists)
        assert r.status_code == 200, r.text
        acts = [(l["name"], l["action"], l.get("reason")) for l in r.json()["lists"]]
        print(acts)
        a = [x[1] for x in acts]
        assert a[0] == "overwrite"
        assert a[1] == "add" and r.json()["lists"][1]["items"] == 2
        assert a[2] == "skip" and acts[2][2]
        assert a[3] == "skip" and "no items" in acts[3][2]
        assert a[4] == "add" and a[5] == "skip" and "twice" in acts[5][2]
        assert a[6] in ("add", "overwrite") and acts[6][0] == "Leaving Dock"
        assert a[7] == "skip" and a[8] == "skip"
        # nothing changed
        r2 = requests.get(f"{API}/admin/template-lists/export", headers=ADMIN, timeout=60).json()
        assert [(l["list_id"], l["items"]) for l in r2["lists"]] == [(l["list_id"], l["items"]) for l in original["lists"]]

    def test_apply_add_overwrite_keep(self, original):
        before = admin_lists()
        # create a TEST list via the normal API then overwrite it from a "backup"
        c = requests.post(f"{API}/admin/template-lists", json={"name": f"TEST_Over {TAG}", "items": ["one", "two"], "private": True}, headers=ADMIN, timeout=30)
        assert c.status_code == 200, c.text
        over_id = c.json()["id"]
        CREATED_LISTS.append(over_id)
        free_id = f"TEST_{TAG}_keep"
        backup = [custom(f"test_over {TAG}".upper(), ["uno", "dos", "tres"], description="TEST desc", private=True),
                  custom(f"TEST_Added {TAG}", ["alpha"], list_id=free_id, private=True)]
        r = imp(backup, dry=False)
        assert r.status_code == 200, r.text
        assert [l["action"] for l in r.json()["lists"]] == ["overwrite", "add"]
        after = admin_lists()
        by_id = {l["id"]: l for l in after}
        assert free_id in by_id, "backup list_id not kept for added list"
        CREATED_LISTS.append(free_id)
        assert [i["label"] for i in by_id[over_id]["items"]] == ["uno", "dos", "tres"]
        assert by_id[over_id]["description"] == "TEST desc"
        assert by_id[over_id]["name"] == f"TEST_Over {TAG}"  # name kept
        assert {l["id"] for l in before} <= set(by_id)  # lists not in backup kept
        assert len(after) == len(before) + 2
        # second run is unchanged
        r2 = imp(backup)
        assert [l["action"] for l in r2.json()["lists"]] == ["unchanged", "unchanged"]

    def test_added_list_id_collision_gets_new_id(self, original):
        taken = original["lists"][0]["list_id"]
        r = imp([custom(f"TEST_Coll {TAG}", ["z"], list_id=taken)], dry=False)
        assert r.status_code == 200 and r.json()["lists"][0]["action"] == "add"
        new = next(l for l in admin_lists() if l["name"] == f"TEST_Coll {TAG}")
        CREATED_LISTS.append(new["id"])
        assert new["id"] != taken
        orig_first = next(l for l in admin_lists() if l["id"] == taken)
        assert orig_first["name"] == original["lists"][0]["name"]

    def test_empty_name_skipped(self, original):
        r = imp([custom("   ", ["z"])])
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            assert r.json()["lists"][0]["action"] == "skip", f"blank-named list would be added: {r.json()}"

    def test_restore_original_unchanged(self, original):
        r = imp(original["lists"])
        assert all(l["action"] == "unchanged" for l in r.json()["lists"])


# ---------------- Zone follow-ups ----------------
CREATED_MAPS = []


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (120, 90), (40, 140, 240)).save(b, "JPEG")
    return b.getvalue()


def zmaps():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    return next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])["zone_maps"]


def up(data=None, content=None, ctype="image/jpeg"):
    before = {m["id"] for m in zmaps()}
    r = requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.jpg", content if content is not None else jpeg(), ctype)}, data=data or {}, headers=PRO, timeout=60)
    new = [m for m in r.json().get("zone_maps", []) if m["id"] not in before] if r.status_code == 200 else []
    CREATED_MAPS.extend(m["id"] for m in new)
    return r, (new[0] if new else None)


def meta(mid, **body):
    return requests.put(f"{API}/boats/main/zone-maps/{mid}/meta", json=body, headers=PRO, timeout=30)


def free_colour(exclude=()):
    used = {m["colour"] for m in zmaps()} | set(exclude)
    for c in ["Silver", "Indigo", "Aqua", "Khaki", "Rust", "Crimson", "Plum", "Amber", "Violet", "Salmon"]:
        if c not in used:
            return c


@pytest.fixture(scope="class")
def zone_cleanup():
    yield
    for mid in CREATED_MAPS:
        requests.delete(f"{API}/boats/main/zone-maps/{mid}", headers=PRO, timeout=30)
    names = [m["name"] for m in zmaps()]
    assert "Galley" in names and "Galley 2" in names


@pytest.mark.usefixtures("zone_cleanup")
class TestZoneFollowups:
    def test_first_free_name(self):
        z, c = f"TZ{TAG}", free_colour()
        r1, a = up({"zone": z, "colour": c})
        assert r1.status_code == 200 and a["name"] == z
        r2, b = up({"zone": z, "colour": c})
        assert b["name"] == f"{z} 2"
        requests.delete(f"{API}/boats/main/zone-maps/{a['id']}", headers=PRO, timeout=30)
        r3, d = up({"zone": z, "colour": c})
        assert r3.status_code == 200 and d["name"] == z, d

    def test_clash_aft_cabin_manual_400(self):
        z = f"Aft{TAG}"
        c = free_colour()
        _, p = up()
        assert meta(p["id"], name=f"{z} cabin").status_code == 200
        assert meta(p["id"], colour=c).status_code == 200  # colour_manual
        r, _ = up({"zone": z, "colour": c})
        assert r.status_code == 400, r.text

    def test_clash_non_manual_recoloured_and_invalid_picture_no_recolour(self):
        z = f"Bft{TAG}"
        _, p = up()
        assert meta(p["id"], name=f"{z} cabin").status_code == 200
        c = next(m for m in zmaps() if m["id"] == p["id"])["colour"]
        # invalid picture -> 400 and no recolour
        r_bad = requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.txt", b"nope", "text/plain")}, data={"zone": z, "colour": c}, headers=PRO, timeout=30)
        assert r_bad.status_code == 400
        assert next(m for m in zmaps() if m["id"] == p["id"])["colour"] == c
        r, n = up({"zone": z, "colour": c})
        assert r.status_code == 200, r.text
        assert n["colour"] == c and n["name"] == z
        recol = next(m for m in zmaps() if m["id"] == p["id"])["colour"]
        assert recol != c and recol

    def test_numbered_name_exempt(self):
        z = f"Cft{TAG}"
        c = free_colour()
        _, p = up()
        meta(p["id"], name=f"{z} 3")
        meta(p["id"], colour=c)
        r, n = up({"zone": z, "colour": c})
        assert r.status_code == 200, r.text
        assert next(m for m in zmaps() if m["id"] == p["id"])["colour"] == c
