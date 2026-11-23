import hashlib
import json
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from db import db

SPECIAL_LIST = "ADMIN - 2FA Special Users"
CODE_MINUTES = 15
CODE_TRIES = 5
RESEND_SECONDS = 60
CODES_PER_HOUR = 5
EMAIL = re.compile(r"[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+")


def _named() -> dict:
    return {"custom": True, "name": {"$regex": rf"^\s*{re.escape(SPECIAL_LIST)}\s*$", "$options": "i"}}


async def is_special(email: str) -> bool:
    """Emails on the admin list are treated as already 2FA verified."""
    doc = await db.list_templates.find_one(_named(), {"_id": 0, "items": 1})
    for i in (doc or {}).get("items") or []:
        m = EMAIL.search(str(i.get("label", "")))
        if m and m.group(0).lower() == email:
            return True
    return False


FIRST_TIME = "behave like first time"


async def behaves_first(email: str) -> bool:
    """A list line with ",Behave Like First Time" after the email: each time that user opens the app, it starts again as their first time."""
    email = (email or "").strip().lower()
    doc = await db.list_templates.find_one(_named(), {"_id": 0, "items": 1})
    for i in (doc or {}).get("items") or []:
        label = str(i.get("label", ""))
        m = EMAIL.search(label)
        if m and m.group(0).lower() == email and FIRST_TIME in " ".join(label.lower().split()):
            return True
    return False


def code_hash(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}".encode()).hexdigest()


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def seed_special_users():
    """One time per database: the preview users plus every user of this app, one line each."""
    if await db.migrations.find_one({"_id": "twofa_special_users_v1"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    emails = set(json.loads((Path(__file__).parent / "seed" / "twofa_preview_users.json").read_text()))
    emails |= {(u.get("email") or "").strip().lower() async for u in db.users.find({}, {"_id": 0, "email": 1}) if u.get("email")}
    doc = await db.list_templates.find_one(_named(), {"_id": 0, "items": 1})
    have = {m.group(0).lower() for i in (doc or {}).get("items") or [] if (m := EMAIL.search(str(i.get("label", ""))))}
    items = list((doc or {}).get("items") or []) + [{"label": e} for e in sorted(emails - have)]
    items = [{**i, "id": n + 1} for n, i in enumerate(items)]
    await db.list_templates.update_one(_named(), {"$set": {"name": SPECIAL_LIST, "items": items, "private": True, "updated_at": now, "updated_by": "system",
                                                           "description": "Emails here are treated as already 2FA verified. Everyone else confirms their email with a code when they create an account."},
                                                  "$setOnInsert": {"list_id": f"tpl_{uuid.uuid4().hex[:10]}", "created_at": now}}, upsert=True)
    await db.migrations.insert_one({"_id": "twofa_special_users_v1", "at": now})


def expiry(now: datetime) -> datetime:
    return now + timedelta(minutes=CODE_MINUTES)
