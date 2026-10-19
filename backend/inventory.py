import asyncio
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, field_validator
from db import db
from auth import get_current_user, require_admin
from photos import APP_NAME, MAX_BYTES, TYPES, get_object, put_object

router = APIRouter(prefix="/api")
INVENTORY_ID = "boatInventory"


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


def inventory_list_for_pdf(areas: list) -> dict:
    items = []
    for a in areas or []:
        for i in a.get("items", []):
            items.append({"label": f"{a.get('name', '')}: {i.get('name', '')} x{i.get('qty', 1)}", "checked": bool(i.get("onboard")), "flagged": False})
    return {"name": "Boat Inventory", "items": items}
