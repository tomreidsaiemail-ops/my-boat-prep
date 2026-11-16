"""Model Vessel training copy ("clone on first login").

modelskipper@myboatprep.com keeps the master "Model Vessel". Every skipper gets a private copy (boat_id model_vessel)
at sign-in when they don't have one. Photos aren't copied: the copy points at the master's stored images, and deleting
one on the copy only removes the copy's reference (nothing in the app deletes stored images).
"""
import json
import re
from pathlib import Path
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


# Skippers' copies show this make and model; Magic still works from the master's real boat.
COVER_MAKE, COVER_MODEL = "Myboatprep", "XYZ1"


async def real_make_model(make: str, model: str) -> tuple[str, str]:
    """The Model Vessel's cover make/model become the master's real ones when Magic generates maintenance lists or zone schematics."""
    if (make.strip().lower(), model.strip().lower()) != (COVER_MAKE.lower(), COVER_MODEL.lower()):
        return make, model
    b = ((await _master()) or {}).get("boat") or {}
    return (b.get("make") or make, b.get("model") or model)


def cover_text(obj, make: str, model: str):
    """Magic replies for the Model Vessel: the master's real make/model shown as the cover ones (strings inside lists and dicts too)."""
    if isinstance(obj, str):
        for real, cover in ((f"{make} {model}", f"{COVER_MAKE} {COVER_MODEL}"), (model, COVER_MODEL), (make, COVER_MAKE)):
            if real.strip():
                obj = re.sub(re.escape(real.strip()), cover, obj, flags=re.I)
        return obj
    if isinstance(obj, list):
        return [cover_text(x, make, model) for x in obj]
    if isinstance(obj, dict):
        return {k: cover_text(v, make, model) for k, v in obj.items()}
    return obj


async def cover_copies():
    """One time: Model Vessel copies made before the cover make/model show it too."""
    if await db.migrations.find_one({"_id": "model_vessel_cover_make_v2"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    # Stamped now, so a phone still holding the old make/model takes the cover ones on its next sync.
    await db.user_boats.update_many({"boat_id": MODEL_BOAT_ID, "model": True}, {"$set": {"boat.make": COVER_MAKE, "boat.model": COVER_MODEL,
                                                                                          "boat_ts.make": now, "boat_ts.model": now, "updated_at": now}})
    await db.migrations.insert_one({"_id": "model_vessel_cover_make_v2", "at": now})


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
    boat.update({"shore_email": "", "make": COVER_MAKE, "model": COVER_MODEL})
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


async def seed_wizards():
    """Model Vessel wizards as written in preview. The first run replaces the live copies; a wizard added later is added once if missing.
    Admin edits (and deletions) after that are kept."""
    now = datetime.now(timezone.utc).isoformat()
    first = not await db.migrations.find_one({"_id": "model_vessel_wizards_v2"})
    for w in json.loads((Path(__file__).parent / "seed" / "model_vessel_wizards.json").read_text()):
        mid = f"model_vessel_wizard:{w['name'].lower()}"
        if not first and await db.migrations.find_one({"_id": mid}):
            continue
        items = [{"id": n + 1, "label": t} for n, t in enumerate(w["items"])]
        if first or not await db.list_templates.find_one(_named(w["name"]), {"_id": 1}):
            await db.list_templates.update_one(_named(w["name"]), {"$set": {"name": w["name"], "description": w["description"], "items": items, "private": True, "updated_at": now, "updated_by": "system"},
                                                                   "$setOnInsert": {"list_id": f"tpl_{uuid4().hex[:10]}", "created_at": now}}, upsert=True)
        await db.migrations.update_one({"_id": mid}, {"$set": {"at": now}}, upsert=True)
    if first:
        await db.migrations.insert_one({"_id": "model_vessel_wizards_v2", "at": now})
