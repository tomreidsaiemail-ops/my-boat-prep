import re
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user

router = APIRouter(prefix="/api")
# The sequence new zone map photos take their colour from; a boat can have 20 maps, so each gets its own.
PALETTE = ["Gold", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink", "Brown", "Gray", "Teal",
           "Maroon", "Navy", "Turquoise", "Lavender", "Magenta", "Lime", "Coral", "Olive", "Beige", "Red"]
PRESET_LIST = "Admin - Zone Map Predetermined Colours"
PRESET_LINES = ["Cockpit - Gold", "Saloon - Green", "Galley - Orange", "Nav station - Navy", "Forward cabin - Blue", "Aft cabin - Purple",
                "Heads - Teal", "Engine room - Red", "Lazarette - Brown", "Anchor locker - Gray", "Deck - Yellow", "Fridge - Turquoise"]
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
MapPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]


def colour_name(v: str) -> Optional[str]:
    return next((c for c in PALETTE if c.lower() == str(v or "").strip().lower().replace("grey", "gray")), None)


def fill_colours(maps: list) -> list:
    """Every map gets a colour; maps without one take the next unused colour in the sequence."""
    used = {m.get("colour") for m in maps if colour_name(m.get("colour"))}
    out = []
    for m in maps:
        if not colour_name(m.get("colour")):
            free = next((c for c in PALETTE if c not in used), PALETTE[0])
            used.add(free)
            m = {**m, "colour": free}
        out.append(m)
    return out


def next_colour(maps: list) -> str:
    used = {m.get("colour") for m in fill_colours(maps)}
    return next((c for c in PALETTE if c not in used), PALETTE[0])


async def presets() -> list:
    """(word, colour) pairs from the admin list, longest words first so 'Forward cabin' beats 'cabin'."""
    doc = await db.list_templates.find_one({"name": {"$regex": f"^{re.escape(PRESET_LIST)}$", "$options": "i"}}, {"_id": 0, "items": 1})
    pairs = []
    for i in (doc or {}).get("items") or []:
        m = re.match(r"^\s*\*?\s*(.+?)\s*[-–:,=]\s*([A-Za-z]+)\s*\*?\s*$", str(i.get("label", "")))
        if m and colour_name(m.group(2)):
            pairs.append((m.group(1).strip("* ").lower(), colour_name(m.group(2))))
    return sorted(pairs, key=lambda p: -len(p[0]))


async def preset_for(name: str) -> Optional[str]:
    low = name.lower()
    return next((c for word, c in await presets() if word and word in low), None)


class MapMetaIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=60)
    colour: Optional[str] = Field(default=None, max_length=20)


@router.put("/boats/{boat_id}/zone-maps/{map_id}/meta")
async def save_map_meta(boat_id: BoatPath, map_id: MapPath, payload: MapMetaIn, user: dict = Depends(get_current_user)):
    from inventory import boat_maps
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})
    maps = fill_colours((doc or {}).get("zone_maps") or [])
    me = next((m for m in maps if m["id"] == map_id), None)
    if not me:
        raise HTTPException(status_code=404, detail="Zone map not found")
    others = {m.get("colour"): m for m in maps if m["id"] != map_id}
    label = lambda m: (m.get("name") or "another zone map")  # noqa: E731
    if payload.colour is not None:
        colour = colour_name(payload.colour)
        if not colour:
            raise HTTPException(status_code=400, detail="Please pick one of the 20 zone map colours")
        if colour in others:
            raise HTTPException(status_code=400, detail=f"{colour} is already used by {label(others[colour])}. Each zone map needs its own colour.")
        me.update({"colour": colour, "colour_manual": True})
    if payload.name is not None:
        me["name"] = re.sub(r"\s+", " ", payload.name).strip()
        preset = await preset_for(me["name"]) if me["name"] and not me.get("colour_manual") else None
        if preset and preset not in others:
            me["colour"] = preset
    me["meta_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_boats.update_one(key, {"$set": {"zone_maps": [me if m["id"] == map_id else m for m in maps]}})
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}))}


async def seed_colour_presets():
    """One-off: the admin list of predetermined zone map colours, private to admins and editable in Admin."""
    if await db.migrations.find_one({"_id": "zone_colour_presets"}):
        return
    if not await db.list_templates.find_one({"name": {"$regex": f"^{re.escape(PRESET_LIST)}$", "$options": "i"}}):
        now = datetime.now(timezone.utc).isoformat()
        from uuid import uuid4
        await db.list_templates.insert_one({
            "list_id": f"tpl_{uuid4().hex[:10]}", "name": PRESET_LIST, "custom": True, "private": True, "description": "Zone map names containing a word here start with its colour. One per line, e.g. Cockpit - Gold.",
            "items": [{"id": n + 1, "label": line} for n, line in enumerate(PRESET_LINES)], "updated_at": now, "created_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "zone_colour_presets", "at": datetime.now(timezone.utc).isoformat()})
