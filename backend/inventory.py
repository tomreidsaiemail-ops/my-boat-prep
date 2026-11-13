import re
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, Response, UploadFile
from pydantic import BaseModel, Field, field_validator
from db import db
from auth import get_current_user, require_admin, require_premium
from photos import APP_NAME, MAX_BYTES, TYPES, get_object, put_object
from zone_colours import PALETTE, colour_name, fill_colours, next_colour

router = APIRouter(prefix="/api")
INVENTORY_ID = "boatInventory"
MAX_BOAT_MAPS = 100
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
MapPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
OwnerQ = Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


async def _read_picture(file: UploadFile) -> bytes:
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP picture")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That picture is too big (max 3 MB)")
    return data


def boat_maps(doc: dict) -> list:
    return [{"id": m["id"], "v": m.get("updated_at", ""), "pins": m.get("pins") or [], "name": m.get("name", ""), "colour": m.get("colour", ""),
             "kind": m.get("kind", "photo"), "swatches": m.get("swatches") or [], "zone": m.get("zone", ""), "comment": m.get("comment", ""),
             "source_url": m.get("source_url", ""), "source_title": m.get("source_title", "")}
            for m in fill_colours(doc.get("zone_maps") or [])]


class ZonePin(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    label: str = Field(min_length=1, max_length=60)
    area_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_.-]{1,60}$")

    @field_validator("label")
    @classmethod
    def label_text(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Each label needs a name")
        return v.strip()


class ZonePinsIn(BaseModel):
    pins: List[ZonePin] = Field(max_length=60)
    comment: Optional[str] = Field(default=None, max_length=500)

    @field_validator("pins")
    @classmethod
    def unique_ids(cls, v: list) -> list:
        if len({p.id for p in v}) != len(v):
            raise ValueError("Each label needs its own id")
        return v


@router.put("/boats/{boat_id}/zone-maps/{map_id}/pins")
async def save_map_pins(boat_id: BoatPath, map_id: MapPath, payload: ZonePinsIn, user: dict = Depends(get_current_user)):
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    pins = [p.model_dump() for p in payload.pins]
    update = {"zone_maps.$.pins": pins}
    if payload.comment is not None:
        update["zone_maps.$.comment"] = payload.comment.strip()
    res = await db.user_boats.update_one({**key, "zone_maps.id": map_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Zone map not found")
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}))}


@router.post("/boats/{boat_id}/zone-maps")
async def add_boat_map(boat_id: BoatPath, file: UploadFile = File(...), zone: str = Form(default="", max_length=40), colour: str = Form(default="", max_length=20),
                       kind: str = Form(default="", pattern=r"^(overview)?$"), user: dict = Depends(require_premium)):
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})
    if doc is None:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    if len(doc.get("zone_maps") or []) >= MAX_BOAT_MAPS:
        raise HTTPException(status_code=400, detail=f"Each boat can have up to {MAX_BOAT_MAPS} zone maps. Remove one first.")
    maps = fill_colours(doc.get("zone_maps") or [])
    zone = " ".join(zone.split())
    zone_colour = colour_name(colour) if zone else None
    if zone and not zone_colour:
        raise HTTPException(status_code=400, detail="Please use one of the zone map colours")
    clash = None
    if zone_colour:
        same_name = re.compile(rf"^{re.escape(zone.lower())}( \d+)?$")
        clash = next((m for m in maps if m.get("kind") != "overview" and m.get("colour") == zone_colour
                      and (m.get("zone") or "").lower() != zone.lower() and not same_name.match((m.get("name") or "").lower())), None)
        if clash and (clash.get("zone") or clash.get("colour_manual")):
            raise HTTPException(status_code=400, detail=f"{zone_colour} is already used by {clash.get('name') or 'another zone map'}. Rename or recolour that photo first.")
    data = await _read_picture(file)
    map_id = str(uuid.uuid4())
    path = f"{APP_NAME}/boat-zone-maps/{user['user_id']}/{map_id}.{TYPES[file.content_type]}"
    try:
        await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't save the picture right now, please try again")
    if clash:
        used = {m.get("colour") for m in maps} | {zone_colour}
        free = next((c for c in PALETTE if c not in used), PALETTE[0])
        await db.user_boats.update_one({**key, "zone_maps.id": clash["id"]}, {"$set": {"zone_maps.$.colour": free}})
    entry = {"id": map_id, "path": path, "content_type": file.content_type, "updated_at": datetime.now(timezone.utc).isoformat(), "name": "", "colour": next_colour(doc.get("zone_maps") or [])}
    if zone_colour:
        names = {(m.get("name") or "").lower() for m in maps}
        name = next(n for n in [zone, *(f"{zone} {k}" for k in range(2, MAX_BOAT_MAPS + 2))] if n.lower() not in names)
        entry.update({"name": name, "colour": zone_colour, "colour_manual": True, "zone": zone})
    if kind == "overview":  # The skipper's own schematic or photo, used as a Zone Map Overview after the existing ones.
        n = sum(1 for m in maps if m.get("kind") == "overview")
        entry.update({"kind": "overview", "swatches": [], "name": f"My zone map overview{f' {n + 1}' if n else ''}"})
    res = await db.user_boats.update_one({**key, f"zone_maps.{MAX_BOAT_MAPS - 1}": {"$exists": False}}, {"$push": {"zone_maps": entry}})
    if not res.modified_count:
        raise HTTPException(status_code=400, detail=f"Each boat can have up to {MAX_BOAT_MAPS} zone maps. Remove one first.")
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}))}


@router.delete("/boats/{boat_id}/zone-maps/{map_id}")
async def remove_boat_map(boat_id: BoatPath, map_id: MapPath, user: dict = Depends(get_current_user)):
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    await db.user_boats.update_one(key, {"$pull": {"zone_maps": {"id": map_id}}})
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}) or {})}


@router.get("/boats/{boat_id}/zone-maps/{map_id}")
async def get_boat_map(boat_id: BoatPath, map_id: MapPath, owner: OwnerQ = None, user: dict = Depends(get_current_user)):
    query = {"owner_id": owner or user["user_id"], "boat_id": boat_id}
    if owner and owner != user["user_id"]:
        query["crew"] = user["user_id"]
    doc = await db.user_boats.find_one(query, {"_id": 0, "zone_maps": 1})
    m = next((m for m in (doc or {}).get("zone_maps") or [] if m["id"] == map_id), None)
    if not m:
        raise HTTPException(status_code=404, detail="No zone map")
    try:
        data = await asyncio.to_thread(get_object, m["path"])
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't load the picture")
    return Response(content=data, media_type=m["content_type"], headers={"Cache-Control": "private, max-age=604800"})


async def _setting(key: str) -> dict:
    return await db.app_settings.find_one({"key": key}, {"_id": 0}) or {}


@router.get("/inventory/shared")
async def inventory_shared(_: dict = Depends(get_current_user)):
    zone = await _setting("zone_map")
    defaults = await _setting("area_defaults")
    return {"zone_map_v": zone.get("updated_at") if zone.get("path") else None, "area_defaults": defaults.get("names", [])}


@router.get("/inventory/zone-map")
async def get_zone_map(_: dict = Depends(get_current_user)):
    zone = await _setting("zone_map")
    if not zone.get("path"):
        raise HTTPException(status_code=404, detail="No zone map yet")
    data = await asyncio.to_thread(get_object, zone["path"])
    return Response(content=data, media_type=zone["content_type"], headers={"Cache-Control": "private, max-age=604800"})


@router.post("/admin/inventory/zone-map")
async def upload_zone_map(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP picture")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That picture is too big (max 3 MB)")
    path = f"{APP_NAME}/zone-map/{uuid.uuid4()}.{TYPES[file.content_type]}"
    try:
        await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't save the picture right now, please try again")
    now = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one({"key": "zone_map"}, {"$set": {"path": path, "content_type": file.content_type, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"zone_map_v": now}


@router.delete("/admin/inventory/zone-map")
async def remove_zone_map(_: dict = Depends(require_admin)):
    await db.app_settings.update_one({"key": "zone_map"}, {"$unset": {"path": ""}})
    return {"zone_map_v": None}


class AreaDefaultsIn(BaseModel):
    names: List[str] = Field(max_length=200)

    @field_validator("names")
    @classmethod
    def tidy(cls, v: List[str]) -> List[str]:
        out, seen = [], set()
        for n in v:
            n = n.strip()[:120]
            if n and n.lower() not in seen:
                seen.add(n.lower())
                out.append(n)
        return out


@router.put("/admin/inventory/area-defaults")
async def save_area_defaults(payload: AreaDefaultsIn, admin: dict = Depends(require_admin)):
    if not payload.names:
        raise HTTPException(status_code=400, detail="Add at least one cupboard or locker before publishing")
    now = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one({"key": "area_defaults"}, {"$set": {"names": payload.names, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"area_defaults": payload.names, "updated_at": now}


def inventory_list_for_pdf(areas: list, registry: list = (), data: dict = None) -> dict:
    items = []
    names = {a.get("id"): a.get("name", "") for a in areas or []}
    # Folders and boxes (sub-areas) follow the cupboard they live in.
    ordered = [x for a in areas or [] if not a.get("parent_id") for x in [a, *[s for s in areas if s.get("parent_id") == a.get("id")]]]
    ordered += [a for a in areas or [] if a not in ordered]
    for a in ordered:
        where = f"{names[a['parent_id']]} › {a.get('name', '')}" if a.get("parent_id") in names else a.get("name", "")
        for i in a.get("items", []):
            items.append({"label": f"{where}: {i.get('name', '')} x{i.get('qty', 1)}{' (removed for now)' if i.get('removed') else ''}", "checked": bool(i.get("removed")), "flagged": False})
        for lst in registry:
            for i in (data or {}).get(lst.get("id"), []):
                if i.get("area") == a.get("id"):
                    items.append({"label": f"{where}: {lst.get('name', '')} - {i.get('label', '')}", "checked": bool(i.get("checked")), "flagged": False})
    return {"name": "Boat Inventory", "items": items}
