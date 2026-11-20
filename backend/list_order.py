"""One-time reorder of the Trip Planning lines in the private admin list "Admin - List Categories"."""
import re
from datetime import datetime, timezone

from db import db

MIG = "trip_planning_order_2026_06"
ORDER = ["route planning", "leaving dock", "arriving at destination", "returning to dock", "crew roles", "crew prep"]
COLOUR = re.compile(r"^\*\s*[a-z ]+?\s*\*$", re.I)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").replace("\u2019", "'")).strip().lower()


def reorder(items: list) -> list:
    labels = [str(i.get("label") or "").strip() for i in items]
    heads = [k for k in range(len(items)) if k + 1 < len(items) and COLOUR.match(labels[k + 1]) and not COLOUR.match(labels[k])]
    start = next((k for k in heads if "trip planning" in _norm(labels[k])), None)
    if start is None:
        return items
    end = next((k for k in heads if k > start), len(items))
    body = items[start + 2:end]
    rank = lambda i: ORDER.index(_norm(i.get("label"))) if _norm(i.get("label")) in ORDER else len(ORDER)  # noqa: E731
    return items[:start + 2] + sorted(body, key=rank) + items[end:]


async def reorder_trip_planning_once():
    if await db.migrations.find_one({"_id": MIG}):
        return
    q = {"custom": True, "private": True, "name": {"$regex": r"^\s*admin - list categories\s*$", "$options": "i"}}
    doc = await db.list_templates.find_one(q, {"_id": 0, "items": 1})
    if doc:
        await db.list_templates.update_one(q, {"$set": {"items": reorder(doc.get("items") or []), "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.migrations.insert_one({"_id": MIG, "at": datetime.now(timezone.utc).isoformat()})


async def rename_trip_planning_once():
    """Route Planning (and its "Route Planning - 2" copies) became Trip Planning on every boat and invite."""
    mig = "trip_planning_rename_2026_06"
    if await db.migrations.find_one({"_id": mig}):
        return
    old = re.compile(r"^\s*route planning\b", re.I)
    async for d in db.user_boats.find({"registry.name": {"$regex": r"^\s*route planning\b", "$options": "i"}}, {"_id": 1, "registry": 1}):
        reg = [{**r, "name": old.sub("Trip Planning", r.get("name") or "")} if old.match(r.get("name") or "") else r for r in d.get("registry") or []]
        await db.user_boats.update_one({"_id": d["_id"]}, {"$set": {"registry": reg}})
    async for i in db.crew_invites.find({"trip_name": {"$regex": r"^\s*route planning\b", "$options": "i"}}, {"_id": 1, "trip_name": 1}):
        await db.crew_invites.update_one({"_id": i["_id"]}, {"$set": {"trip_name": old.sub("Trip Planning", i["trip_name"])}})
    await db.migrations.insert_one({"_id": mig, "at": datetime.now(timezone.utc).isoformat()})


async def rename_trip_archives_once():
    """Archived trips keep their names too: "Route Planning..." became "Trip Planning..."."""
    mig = "trip_planning_rename_archives_2026_06"
    if await db.migrations.find_one({"_id": mig}):
        return
    old = re.compile(r"^\s*route planning\b", re.I)
    fix = lambda n: old.sub("Trip Planning", n) if isinstance(n, str) and old.match(n) else n  # noqa: E731
    async for a in db.trip_archives.find({"$or": [{"name": {"$regex": r"^\s*route planning\b", "$options": "i"}},
                                                  {"invites.trip_name": {"$regex": r"^\s*route planning\b", "$options": "i"}}]}, {"_id": 1, "name": 1, "invites": 1}):
        invites = [{**i, "trip_name": fix(i.get("trip_name"))} if isinstance(i, dict) else i for i in a.get("invites") or []]
        await db.trip_archives.update_one({"_id": a["_id"]}, {"$set": {"name": fix(a.get("name")), "invites": invites}})
    await db.migrations.insert_one({"_id": mig, "at": datetime.now(timezone.utc).isoformat()})
