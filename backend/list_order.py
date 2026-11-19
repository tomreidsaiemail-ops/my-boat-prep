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
