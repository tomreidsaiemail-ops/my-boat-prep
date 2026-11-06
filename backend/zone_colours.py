import re
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user

router = APIRouter(prefix="/api")
# The sequence new zone map photos take their colour from; a boat can have 100 maps, so each gets its own.
PALETTE = ["Gold", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink", "Brown", "Gray", "Teal",
           "Maroon", "Navy", "Turquoise", "Lavender", "Magenta", "Lime", "Coral", "Olive", "Beige", "Red",
           "Light Red", "Lime Green", "Copper", "Emerald", "Peach", "Mint", "Tan", "Sepia", "Chartreuse", "Sky Blue",
           "Crimson", "Plum", "Amber", "Violet", "Salmon", "Silver", "Indigo", "Aqua", "Khaki", "Rust",
           "Mustard", "Cream", "Charcoal", "Rose", "Jade", "Cobalt", "Lilac", "Burgundy", "Ochre", "Slate",
           "Scarlet", "Cherry", "Ruby", "Wine", "Raspberry", "Fuchsia", "Hot Pink", "Blush", "Apricot", "Tangerine",
           "Pumpkin", "Terracotta", "Cinnamon", "Chocolate", "Mocha", "Caramel", "Honey", "Sand", "Ivory", "Lemon",
           "Butter", "Pistachio", "Sage", "Moss", "Forest Green", "Pine", "Seafoam", "Kelly Green", "Cyan", "Ice Blue",
           "Baby Blue", "Powder Blue", "Steel Blue", "Denim", "Royal Blue", "Sapphire", "Midnight", "Ocean", "Periwinkle", "Iris",
           "Amethyst", "Orchid", "Mauve", "Grape", "Eggplant", "Taupe", "Pewter", "Graphite", "Black", "White"]
ALIASES = {"grey": "gray", "oilve": "olive", "lightred": "light red", "limegreen": "lime green", "skyblue": "sky blue", "light grey": "gray", "light gray": "silver"}
PRESET_LIST = "Admin - Zone Map Predetermined Colours"
PRESET_LINES = ["Cockpit - Gold", "Saloon - Green", "Galley - Orange", "Nav station - Navy", "Forward cabin - Blue", "Aft cabin - Purple",
                "Heads - Teal", "Engine room - Red", "Lazarette - Brown", "Anchor locker - Gray", "Deck - Yellow", "Fridge - Turquoise"]
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
MapPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]


def colour_name(v: str) -> Optional[str]:
    low = re.sub(r"\s+", " ", str(v or "").strip().lower())
    low = ALIASES.get(low, low)
    return next((c for c in PALETTE if c.lower() == low), None)


def fill_colours(maps: list) -> list:
    """Every zone map photo gets a colour; photos without one take the next unused colour. Zone Map Overviews stay colourless."""
    used = {m.get("colour") for m in maps if colour_name(m.get("colour")) and m.get("kind") != "overview"}
    out = []
    for m in maps:
        if m.get("kind") == "overview":
            out.append({**m, "colour": ""})
            continue
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
        m = re.match(r"^\s*\*?\s*(.+?)\s*[-–:,=]\s*([A-Za-z]+(?: [A-Za-z]+)?)\s*\*?\s*$", str(i.get("label", "")))
        if m and colour_name(m.group(2)):
            pairs.append((m.group(1).strip("* ").lower(), colour_name(m.group(2))))
    return sorted(pairs, key=lambda p: -len(p[0]))


async def preset_for(name: str) -> Optional[str]:
    low = name.lower()
    return next((c for word, c in await presets() if word and word in low), None)


@router.get("/zone-colour-presets")
async def colour_presets(_: dict = Depends(get_current_user)):
    """The admin's predetermined colours as draggable squares for Zone Map Overviews, in list order."""
    doc = await db.list_templates.find_one({"name": {"$regex": f"^{re.escape(PRESET_LIST)}$", "$options": "i"}}, {"_id": 0, "items": 1})
    out = []
    for i in (doc or {}).get("items") or []:
        m = re.match(r"^\s*\*?\s*(.+?)\s*[-–:,=]\s*([A-Za-z]+(?: [A-Za-z]+)?)\s*\*?\s*$", str(i.get("label", "")))
        if m and colour_name(m.group(2)):
            out.append({"label": m.group(1).strip("* ")[:40], "colour": colour_name(m.group(2))})
    return {"presets": out}


class Swatch(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    colour: str = Field(max_length=20)
    label: str = Field(default="", max_length=40)


class SwatchesIn(BaseModel):
    swatches: List[Swatch] = Field(max_length=100)


@router.put("/boats/{boat_id}/zone-maps/{map_id}/swatches")
async def save_swatches(boat_id: BoatPath, map_id: MapPath, payload: SwatchesIn, user: dict = Depends(get_current_user)):
    from inventory import boat_maps
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    out = []
    seen = set()
    for s in payload.swatches:
        colour = colour_name(s.colour)
        if not colour:
            raise HTTPException(status_code=400, detail="Please use one of the zone map colours")
        tag = (s.label.strip() or colour).lower()
        if tag in seen:
            raise HTTPException(status_code=400, detail=f"{s.label.strip() or colour} is already on this plan. Each colour goes on once.")
        seen.add(tag)
        out.append({**s.model_dump(), "colour": colour, "label": s.label.strip()})
    res = await db.user_boats.update_one({**key, "zone_maps": {"$elemMatch": {"id": map_id, "kind": "overview"}}}, {"$set": {"zone_maps.$.swatches": out}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Zone Map Overview not found")
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}))}


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
        if me.get("kind") == "overview":
            raise HTTPException(status_code=400, detail="Zone Map Overviews don't have a colour. Drag colours onto the plan instead.")
        colour = colour_name(payload.colour)
        if not colour:
            raise HTTPException(status_code=400, detail="Please pick one of the 100 zone map colours")
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
