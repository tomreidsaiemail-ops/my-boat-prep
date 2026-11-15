import asyncio
import uuid
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, Path, Response, UploadFile
from db import db
from auth import get_current_user
from photos import APP_NAME, MAX_BYTES, TYPES, get_object, put_object

router = APIRouter(prefix="/api/crew-photo")
UserPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


@router.post("")
async def set_my_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """A crew member's photo of themselves, shown on their crew card to the skipper and that boat's crew."""
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP picture")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That picture is too big (max 3 MB)")
    path = f"{APP_NAME}/crew-photos/{user['user_id']}/{uuid.uuid4()}.{TYPES[file.content_type]}"
    try:
        await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't save the picture right now, please try again")
    v = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"photo": {"path": path, "content_type": file.content_type, "v": v}}})
    return {"photo_v": v}


@router.delete("")
async def remove_my_photo(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"photo": ""}})
    return {"ok": True}


async def shares_boat(me: str, other: str) -> bool:
    """The skipper and crew of one boat can see each other's photos."""
    return bool(await db.user_boats.find_one({"$or": [{"owner_id": me, "crew": other}, {"owner_id": other, "crew": me}, {"crew": {"$all": [me, other]}}]}, {"_id": 1}))


@router.get("/{user_id}")
async def get_photo(user_id: UserPath, user: dict = Depends(get_current_user)):
    if user_id != user["user_id"] and not await shares_boat(user["user_id"], user_id):
        raise HTTPException(status_code=404, detail="No crew photo")
    p = ((await db.users.find_one({"user_id": user_id}, {"_id": 0, "photo": 1})) or {}).get("photo")
    if not p:
        raise HTTPException(status_code=404, detail="No crew photo")
    try:
        data = await asyncio.to_thread(get_object, p["path"])
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't load the picture")
    return Response(content=data, media_type=p["content_type"], headers={"Cache-Control": "private, max-age=604800"})


async def photo_versions(user_ids: list) -> dict:
    return {u["user_id"]: u["photo"]["v"] async for u in db.users.find({"user_id": {"$in": [i for i in user_ids if i]}, "photo.v": {"$exists": True}}, {"_id": 0, "user_id": 1, "photo.v": 1})}


async def photo_versions_by_email(emails: list) -> dict:
    keys = [e.lower() for e in emails if e]
    return {u["email"].lower(): u["photo"]["v"] async for u in db.users.find({"email": {"$in": keys}, "photo.v": {"$exists": True}}, {"_id": 0, "email": 1, "photo.v": 1})}
