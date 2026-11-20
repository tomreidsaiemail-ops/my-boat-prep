from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user, signed_in_user
from db import db

router = APIRouter(prefix="/api")
OLD_LIST = "Admin - GPS broadcast exclusion users"


def excluded(user: dict) -> bool:
    """My Settings > Privacy Settings: this person broadcasts to their shore contact even on or near land."""
    return bool((user.get("privacy") or {}).get("ignore_300"))


class PrivacyIn(BaseModel):
    ignore_300: bool


@router.put("/me/privacy")
async def set_privacy(p: PrivacyIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"privacy.ignore_300": p.ignore_300, "privacy.ignore_300_at": now}})
    return await signed_in_user(user["user_id"])


class FeaturesIn(BaseModel):
    show_sundowners: bool


@router.put("/me/features")
async def set_features(f: FeaturesIn, user: dict = Depends(get_current_user)):
    """My Settings > Feature Settings, for this person on every boat."""
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"features.show_sundowners": f.show_sundowners}})
    return await signed_in_user(user["user_id"])


class PrefsIn(BaseModel):
    tide_datum: Literal["CD", "MSL"]


@router.put("/me/preferences")
async def set_preferences(p: PrefsIn, user: dict = Depends(get_current_user)):
    """My Settings > User Preferences: tide heights above Chart Datum (default) or from Mean Sea Level."""
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"prefs.tide_datum": p.tide_datum}})
    return await signed_in_user(user["user_id"])


async def seed_exclusions():
    """Runs once: the admin exclusion list is replaced by each person's own privacy setting."""
    if await db.migrations.find_one({"_id": "gps_exclusion_list_removed"}):
        return
    await db.list_templates.delete_many({"custom": True, "name": {"$regex": rf"^\s*{OLD_LIST}\s*$", "$options": "i"}})
    await db.migrations.insert_one({"_id": "gps_exclusion_list_removed", "at": datetime.now(timezone.utc).isoformat()})
