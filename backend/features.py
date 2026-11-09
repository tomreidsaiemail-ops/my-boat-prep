"""Admin - disabled features: each line is "<Feature name>; <emails it's enabled for>" (or "enabled for nobody").
A feature with no line is on for everyone."""
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api")
LIST_NAME = "Admin - disabled features"
DESCRIPTION = ("Features switched off while they're being improved. One line per feature: \"<Feature name>; enabled for nobody\", "
               "or list the emails that can use it, e.g. \"Speak Button Feature; user1@gmail.com, user2@gmail.com\". Delete a line to turn that feature on for everyone.")
EMAIL = re.compile(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")


def same_email(e: str) -> str:
    """Lower-cased; Gmail ignores dots and +tags, so j.smith+boat@gmail.com is jsmith@gmail.com."""
    local, _, domain = e.strip().lower().partition("@")
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.split("+", 1)[0].replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def feature_key(name: str):
    n = name.lower()
    if "charter" in n:
        return "charter"
    if "speak" in n:
        return "speak"
    if "sync" in n or ("cupboard" in n and "magic" in n):
        return "sync_stores"
    return None


async def disabled_features(user: dict) -> list:
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(LIST_NAME)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    me = same_email(user.get("email") or "")
    off = set()
    for i in (tpl or {}).get("items") or []:
        label = i.get("label") or ""
        key = feature_key(EMAIL.sub("", label).partition(";")[0])
        # Emails count wherever they are on the line, so "Feature: a@b.com" or "Feature - a@b.com" still work.
        if key and me not in {same_email(e) for e in EMAIL.findall(label)}:
            off.add(key)
    return sorted(off)


async def require_feature(user: dict, key: str):
    if key in await disabled_features(user):
        raise HTTPException(status_code=403, detail="This feature is switched off for now")


@router.get("/me/features")
async def my_features(user: dict = Depends(get_current_user)):
    return {"disabled": await disabled_features(user)}


# Features added after the list was first seeded: each row is added once on deploy (the admin can then edit or delete it).
LATER_ROWS = [("disabled_feature_charter", "charter", "Charter Registrations Feature; enabled for nobody")]


async def seed_later_rows():
    now = datetime.now(timezone.utc).isoformat()
    for mig, key, label in LATER_ROWS:
        if await db.migrations.find_one({"_id": mig}):
            continue
        q = {"custom": True, "name": {"$regex": rf"^\s*{re.escape(LIST_NAME)}\s*$", "$options": "i"}}
        tpl = await db.list_templates.find_one(q, {"_id": 0, "items": 1})
        if tpl is None:
            await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": LIST_NAME, "private": True,
                                                "description": DESCRIPTION, "items": [{"id": 1, "label": label}], "created_at": now, "updated_at": now, "updated_by": "system"})
        elif not any(feature_key((i.get("label") or "").partition(";")[0]) == key for i in tpl.get("items") or []):
            nid = max([int(i["id"]) for i in tpl.get("items") or [] if str(i.get("id", "")).isdigit()] or [0]) + 1
            await db.list_templates.update_one(q, {"$push": {"items": {"id": nid, "label": label}}, "$set": {"updated_at": now}})
        await db.migrations.insert_one({"_id": mig, "at": now})
