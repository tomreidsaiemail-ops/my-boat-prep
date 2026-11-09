"""Admin - disabled features: each line is "<Feature name>; <emails it's enabled for>" (or "enabled for nobody").
A feature with no line is on for everyone."""
import re

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api")
LIST_NAME = "Admin - disabled features"
EMAIL = re.compile(r"[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+")


def feature_key(name: str):
    n = name.lower()
    if "speak" in n:
        return "speak"
    if "cupboard" in n and "magical" in n:
        return "sync_stores"
    return None


async def disabled_features(user: dict) -> list:
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(LIST_NAME)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    me = (user.get("email") or "").strip().lower()
    off = set()
    for i in (tpl or {}).get("items") or []:
        name, _, who = (i.get("label") or "").partition(";")
        key = feature_key(name)
        if key and me not in {e.lower() for e in EMAIL.findall(who)}:
            off.add(key)
    return sorted(off)


async def require_feature(user: dict, key: str):
    if key in await disabled_features(user):
        raise HTTPException(status_code=403, detail="This feature is switched off for now")


@router.get("/me/features")
async def my_features(user: dict = Depends(get_current_user)):
    return {"disabled": await disabled_features(user)}
