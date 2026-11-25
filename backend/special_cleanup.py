import re
from datetime import datetime, timezone
from db import db
from model_vessel import MODEL_BOAT_ID
from templates import TEMPLATE_LISTS
from twofa import EMAIL, _named

# Lists no longer used: off every boat and out of the template library.
GONE = {"plan your trip - inventory your boat", "plan your trip - email crew"}
# Everything taken off or replaced is copied here first, so it can be put back.
BACKUP = "cleanup_backups"
# Lists the sync leaves alone: the skipper's own records, and MAYDAY / PAN-PAN (they follow their ADMIN templates at sign-in).
SKIP = {"shipsLog", "myTodo", "mayDay", "panPan"}
CREW_ROLES = re.compile(r"^\s*crew roles\s*$", re.I)


def _fresh(t: dict, now: str) -> list:
    """A boat's copy of the admin list, unticked (Crew Roles lines marked * start ticked, as on a new boat)."""
    star = bool(CREW_ROLES.match(t.get("name") or ""))
    out = []
    for i in t.get("items") or []:
        i = {k: v for k, v in i.items() if k not in ("checked", "ts")}
        if star and re.match(r"^\s*\*", str(i.get("label", ""))):
            out.append({**i, "label": re.sub(r"^\s*\*\s*", "", i["label"]), "checked": True, "ts": now})
        else:
            out.append({**i, "checked": False, "ts": now})
    return out


async def remove_gone_lists(now: str, dry: bool = False) -> dict:
    tpls = [t async for t in db.list_templates.find({"custom": True}, {"_id": 0, "list_id": 1, "name": 1}) if (t.get("name") or "").strip().lower() in GONE]
    boats = 0
    async for b in db.user_boats.find({"registry.name": {"$regex": r"^\s*plan your trip - ", "$options": "i"}},
                                      {"_id": 1, "owner_id": 1, "boat_id": 1, "registry": 1, "data": 1, "deleted_lists": 1, "sec_ts": 1, "list_ts": 1, "template_versions": 1}):
        gone = {r.get("id") for r in b.get("registry") or [] if (r.get("name") or "").strip().lower() in GONE}
        if not gone:
            continue
        boats += 1
        if dry:
            continue
        await db[BACKUP].insert_one({"kind": "removed_lists", "at": now, "owner_id": b.get("owner_id"), "boat_id": b.get("boat_id"),
                                     "registry": [r for r in b["registry"] if r.get("id") in gone], "data": {i: (b.get("data") or {}).get(i) for i in gone}})
        sets = {"registry": [r for r in b["registry"] if r.get("id") not in gone],
                "deleted_lists": sorted(set(b.get("deleted_lists") or []) | gone),
                "list_ts": {k: v for k, v in (b.get("list_ts") or {}).items() if k not in gone},
                "template_versions": {k: v for k, v in (b.get("template_versions") or {}).items() if k not in gone},
                "sec_ts": {**(b.get("sec_ts") or {}), "registry": now, "deleted_lists": now, "template_versions": now}, "updated_at": now}
        await db.user_boats.update_one({"_id": b["_id"]}, {"$set": sets, "$unset": {f"data.{i}": "" for i in gone}})
    if not dry:
        for t in tpls:
            full = await db.list_templates.find_one({"list_id": t["list_id"], "custom": True}, {"_id": 0})
            await db[BACKUP].insert_one({"kind": "removed_template", "at": now, "template": full})
            await db.list_templates.delete_one({"list_id": t["list_id"], "custom": True})
    return {"boats": boats, "templates": len(tpls)}


async def sync_special_users(now: str, dry: bool = False) -> dict:
    """Every list on the 2FA special users' boats (not the Model Vessel) that has a newer admin version is replaced with it."""
    doc = await db.list_templates.find_one(_named(), {"_id": 0, "items": 1})
    emails = {m.group(0).lower() for i in (doc or {}).get("items") or [] if (m := EMAIL.search(str(i.get("label", ""))))}
    uids = [u["user_id"] async for u in db.users.find({"email": {"$in": sorted(emails)}}, {"_id": 0, "user_id": 1})]
    templates = {t["list_id"]: t async for t in db.list_templates.find({"private": {"$ne": True}}, {"_id": 0})}
    boats = lists = 0
    async for b in db.user_boats.find({"owner_id": {"$in": uids}, "boat_id": {"$ne": MODEL_BOAT_ID}},
                                      {"_id": 1, "owner_id": 1, "boat_id": 1, "registry": 1, "data": 1, "list_ts": 1, "template_versions": 1, "sec_ts": 1}):
        tv, lts, data = dict(b.get("template_versions") or {}), dict(b.get("list_ts") or {}), {}
        for r in b.get("registry") or []:
            lid = r.get("id")
            t = templates.get(lid)
            if not t or lid in SKIP or not (t.get("custom") or lid in TEMPLATE_LISTS) or (t.get("updated_at") or "") <= (tv.get(lid) or ""):
                continue
            if any(str(i.get("label", "")).startswith("TEST_") for i in t.get("items") or []):
                continue
            data[f"data.{lid}"], tv[lid], lts[lid] = _fresh(t, now), t["updated_at"], now
        if not data:
            continue
        boats, lists = boats + 1, lists + len(data)
        if not dry:
            await db[BACKUP].insert_one({"kind": "synced_lists", "at": now, "owner_id": b.get("owner_id"), "boat_id": b.get("boat_id"),
                                         "data": {k[5:]: (b.get("data") or {}).get(k[5:]) for k in data}, "template_versions": b.get("template_versions") or {}})
            await db.user_boats.update_one({"_id": b["_id"]}, {"$set": {**data, "template_versions": tv, "list_ts": lts, "updated_at": now,
                                                                       "sec_ts": {**(b.get("sec_ts") or {}), "template_versions": now}}})
    return {"users": len(uids), "boats": boats, "lists": lists}


async def cleanup_special_users():
    """Runs once (preview now, the live site when next published): removes the unused Plan your trip lists everywhere,
    then brings the 2FA special users' lists up to the latest admin versions."""
    if await db.migrations.find_one({"_id": "special_users_cleanup_v1"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    gone = await remove_gone_lists(now)
    synced = await sync_special_users(now)
    await db.migrations.insert_one({"_id": "special_users_cleanup_v1", "at": now, "removed": gone, "synced": synced})
