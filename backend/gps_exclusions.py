import re
import time
from datetime import datetime, timezone
from uuid import uuid4

from crew import email_key
from db import db

# Private admin list: people on it may broadcast GPS to shore contacts from land (testing), bypassing the land filter.
EXCLUDE_LIST = "Admin - GPS broadcast exclusion users"
DEFAULT_EMAILS = ["tomreidsemail@gmail.com", "tomreidsgameremail@gmail.com"]
_cache = {"at": 0.0, "keys": set()}


async def excluded(email: str) -> bool:
    if time.monotonic() - _cache["at"] > 60:
        doc = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(EXCLUDE_LIST)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
        _cache.update(at=time.monotonic(), keys={email_key(i["label"]) for i in (doc or {}).get("items") or [] if "@" in (i.get("label") or "")})
    return email_key(email or "") in _cache["keys"]


async def seed_exclusions():
    """Runs once: adds the private exclusion list with the two testing accounts."""
    if await db.migrations.find_one({"_id": "gps_exclusion_list"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(EXCLUDE_LIST)}\s*$", "$options": "i"}}, {"_id": 1}):
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": EXCLUDE_LIST, "private": True,
                                            "description": "One email per line. These people can broadcast GPS positions to shore contacts even on land (for testing); everyone else is only tracked on the water.",
                                            "items": [{"id": n + 1, "label": e} for n, e in enumerate(DEFAULT_EMAILS)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "gps_exclusion_list", "at": now})
