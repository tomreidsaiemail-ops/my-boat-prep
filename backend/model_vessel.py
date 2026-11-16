"""Model Vessel training copy ("clone on first login").

modelskipper@myboatprep.com keeps the master "Model Vessel". Every skipper gets a private copy (boat_id model_vessel)
at sign-in when they don't have one. Photos aren't copied: the copy points at the master's stored images, and deleting
one on the copy only removes the copy's reference (nothing in the app deletes stored images).
"""
import re
from datetime import datetime, timezone
from uuid import uuid4

from db import db

MASTER_EMAIL = "modelskipper@myboatprep.com"
MASTER_VESSEL = "Model Vessel"
MODEL_BOAT_ID = "model_vessel"
WIZARD_LIST = "Admin - Model Vessel - Basic Introduction Walkthrough"
OLD_WIZARD_LIST = "Admin - Model Vessel - wizard instructions"
WIZARD_STEPS = [
    'Click on Vessel, and then click on Additional Boat Details, you will notice that it says "Zone Map Schematic Done" in green, and then press Next',
    "Close Additional Boat Details, and click the Home Boat Inventory button, and then press Next",
    "Expand the ZONE MAPS with the down arrow icon, you will see this expand collapse icon a lot. Here it is hiding the Model Vessel's ZONE MAPs, but we want to see them. When you can see them press Next",
    'You will see that there are 3 zone map overviews. Click "Show" on the first one at the top, and then press Next.',
    "Scroll and make sure you can see the Model Vessel's yacht schematic, and scroll down to see all the coloured presets. All areas of the boat are colour cordinated, where Port and Starboard are involved these have a red and green theme. Scroll back up to the yacht schematic, and then press Next.",
    "Try moving either the name of the zone, like Galley, or the dot which marks the spot of say the galley",
]
# The skipper's copy starts with nobody else on board and nothing shared.
DROP = ("_id", "crew", "crew_roles", "crew_names", "shore", "tracking", "shore_plan", "charter", "charter_lock", "walk_stars", "log_sent", "invites")


async def _master():
    u = await db.users.find_one({"email": {"$regex": rf"^{re.escape(MASTER_EMAIL)}$", "$options": "i"}}, {"_id": 0, "user_id": 1})
    if not u:
        return None
    return await db.user_boats.find_one({"owner_id": u["user_id"], "boat.vessel": MASTER_VESSEL})


async def _skipper(user: dict) -> bool:
    if user.get("shore_only") or (user.get("email") or "").lower() == MASTER_EMAIL:
        return False
    owns = await db.user_boats.count_documents({"owner_id": user["user_id"], "model": {"$ne": True}})
    return bool(owns) or not await db.user_boats.find_one({"crew": user["user_id"]}, {"_id": 1})


async def ensure_model_vessel(user: dict, token: str | None):
    """Once per sign-in: a skipper without a Model Vessel gets a fresh copy of the master."""
    if token:
        s = await db.user_sessions.find_one_and_update({"session_token": token, "model_checked": {"$ne": True}}, {"$set": {"model_checked": True}})
        if not s:
            return
    uid = user["user_id"]
    if await db.user_boats.find_one({"owner_id": uid, "boat_id": MODEL_BOAT_ID}, {"_id": 1}) or not await _skipper(user):
        return
    master = await _master()
    if not master:
        return
    now = datetime.now(timezone.utc).isoformat()
    copy = {k: v for k, v in master.items() if k not in DROP}
    boat = dict(copy.get("boat") or {})
    boat["shore_email"] = ""
    copy.update({"owner_id": uid, "boat_id": MODEL_BOAT_ID, "boat": boat, "model": True, "crew": [], "created_at": now, "updated_at": now, "synced_at": now})
    await db.user_boats.update_one({"owner_id": uid, "boat_id": MODEL_BOAT_ID}, {"$setOnInsert": copy}, upsert=True)
    for coll, key in (("item_photos", "photo_id"), ("item_files", "file_id")):
        await db[coll].delete_many({"owner_id": uid, "boat_id": MODEL_BOAT_ID})
        docs = await db[coll].find({"owner_id": master["owner_id"], "boat_id": master["boat_id"], "is_deleted": False}, {"_id": 0}).to_list(2000)
        if docs:
            await db[coll].insert_many([{**d, "owner_id": uid, "boat_id": MODEL_BOAT_ID, "created_at": now} for d in docs])


def _named(name: str) -> dict:
    return {"custom": True, "name": {"$regex": rf"^\s*{re.escape(name)}\s*$", "$options": "i"}}


async def seed_wizard_list():
    now = datetime.now(timezone.utc).isoformat()
    if not await db.migrations.find_one({"_id": "model_vessel_wizard_rename"}):
        if not await db.list_templates.find_one(_named(WIZARD_LIST), {"_id": 1}):
            await db.list_templates.update_many(_named(OLD_WIZARD_LIST), {"$set": {"name": WIZARD_LIST, "updated_at": now}})
        await db.migrations.insert_one({"_id": "model_vessel_wizard_rename", "at": now})
    if await db.migrations.find_one({"_id": "model_vessel_wizard_list"}):
        return
    if not await db.list_templates.find_one(_named(WIZARD_LIST), {"_id": 1}):
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": WIZARD_LIST, "private": True,
                                            "description": "Model Vessel training window: one step per line, shown in order with Back and Next.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(WIZARD_STEPS)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "model_vessel_wizard_list", "at": now})
