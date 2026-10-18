import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional
import requests
from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Response, UploadFile
from db import db
from auth import get_current_user

router = APIRouter(prefix="/api")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "myboatprep"
MAX_BYTES = 3 * 1024 * 1024
TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _request(method: str, path: str, **kw):
    for attempt in (0, 1):
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(force=attempt == 1), **kw.pop("headers", {})}, timeout=60, **kw)
        if resp.status_code != 404 or attempt:
            resp.raise_for_status()
            return resp


def put_object(path: str, data: bytes, content_type: str) -> dict:
    return _request("PUT", path, headers={"Content-Type": content_type}, data=data).json()


def get_object(path: str) -> bytes:
    return _request("GET", path).content


@router.post("/boats/{boat_id}/photo")
async def upload_photo(boat_id: BoatPath, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    if not await db.user_boats.find_one(key, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP photo")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That photo is too big (max 3 MB)")
    path = f"{APP_NAME}/boat-photos/{user['user_id']}/{uuid.uuid4()}.{TYPES[file.content_type]}"
    try:
        result = await asyncio.to_thread(put_object, path, data, file.content_type)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Couldn't save the photo, please try again")
    photo = {"path": result["path"], "content_type": file.content_type, "updated_at": datetime.now(timezone.utc).isoformat(), "is_deleted": False}
    await db.user_boats.update_one(key, {"$set": {"photo": photo}})
    return {"photo_v": photo["updated_at"]}


@router.delete("/boats/{boat_id}/photo")
async def remove_photo(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"photo.is_deleted": True}})
    return {"ok": True}


@router.get("/boats/{boat_id}/photo")
async def get_photo(boat_id: BoatPath, owner: Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")] = None, user: dict = Depends(get_current_user)):
    query = {"owner_id": owner or user["user_id"], "boat_id": boat_id}
    if owner and owner != user["user_id"]:
        query["crew"] = user["user_id"]
    doc = await db.user_boats.find_one(query, {"_id": 0, "photo": 1})
    photo = (doc or {}).get("photo")
    if not photo or photo.get("is_deleted"):
        raise HTTPException(status_code=404, detail="No photo")
    try:
        data = await asyncio.to_thread(get_object, photo["path"])
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Couldn't load the photo")
    return Response(content=data, media_type=photo["content_type"], headers={"Cache-Control": "private, max-age=604800"})
