import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Response, UploadFile
from db import db
from auth import get_current_user
from photos import APP_NAME, MAX_BYTES, TYPES, get_object, put_object

router = APIRouter(prefix="/api")

MAX_AREA_PHOTOS = 80
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
PhotoPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
OwnerQ = Annotated[Optional[str], Query(max_length=80)]


def _used(doc: dict) -> set:
    return {(a.get("photo") or {}).get("id") for a in doc.get("areas") or [] if isinstance(a.get("photo"), dict)}


@router.post("/boats/{boat_id}/area-photos")
async def add_area_photo(boat_id: BoatPath, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """One photo for a cupboard (e.g. the engine bay). The cupboard keeps {id, v}; photos no cupboard uses are pruned after a day."""
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "areas": 1, "area_photos": 1})
    if doc is None:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP picture")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That picture is too big (max 3 MB)")
    now = datetime.now(timezone.utc)
    used, cutoff = _used(doc), (now - timedelta(days=1)).isoformat()
    keep = [p for p in doc.get("area_photos") or [] if p["id"] in used or p.get("created_at", "") > cutoff]
    if len(keep) >= MAX_AREA_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Each boat can have up to {MAX_AREA_PHOTOS} cupboard photos. Remove one first.")
    pid = str(uuid.uuid4())
    path = f"{APP_NAME}/boat-area-photos/{user['user_id']}/{pid}.{TYPES[file.content_type]}"
    try:
        await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't save the picture right now, please try again")
    keep.append({"id": pid, "path": path, "content_type": file.content_type, "created_at": now.isoformat()})
    await db.user_boats.update_one(key, {"$set": {"area_photos": keep}})
    return {"photo": {"id": pid, "v": now.isoformat()}}


@router.get("/boats/{boat_id}/area-photos/{photo_id}")
async def get_area_photo(boat_id: BoatPath, photo_id: PhotoPath, owner: OwnerQ = None, user: dict = Depends(get_current_user)):
    query = {"owner_id": owner or user["user_id"], "boat_id": boat_id}
    if owner and owner != user["user_id"]:
        query["crew"] = user["user_id"]
    doc = await db.user_boats.find_one(query, {"_id": 0, "area_photos": 1})
    p = next((p for p in (doc or {}).get("area_photos") or [] if p["id"] == photo_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="No cupboard photo")
    try:
        data = await asyncio.to_thread(get_object, p["path"])
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't load the picture")
    return Response(content=data, media_type=p["content_type"], headers={"Cache-Control": "private, max-age=604800"})
