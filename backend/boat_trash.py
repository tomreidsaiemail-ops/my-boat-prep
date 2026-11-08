"""Deleted boats wait 7 days in the trash so a skipper can bring one back, crew and invites included."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api")
KEEP_DAYS = 7
BoatId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]


async def trash_boat(owner_id: str, boat_id: str):
    """Moves the boat and its pending invites into the trash before they're deleted."""
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0})
    invites = await db.crew_invites.find({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0}).to_list(500)
    await db.deleted_boats.delete_many({"owner_id": owner_id, "boat_id": boat_id})
    await db.deleted_boats.insert_one({"owner_id": owner_id, "boat_id": boat_id, "boat": doc, "invites": invites,
                                       "deleted_at": datetime.now(timezone.utc)})


def _cutoff():
    return datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)


@router.get("/me/deleted-boats")
async def deleted_boats(user: dict = Depends(get_current_user)):
    out = []
    async for d in db.deleted_boats.find({"owner_id": user["user_id"], "deleted_at": {"$gte": _cutoff()}}, {"_id": 0, "invites": 0}).sort("deleted_at", -1):
        at = d["deleted_at"].replace(tzinfo=timezone.utc)
        b = (d.get("boat") or {}).get("boat") or {}
        out.append({"boat_id": d["boat_id"], "vessel": b.get("vessel", ""), "make": b.get("make", ""), "model": b.get("model", ""),
                    "crew_count": len((d.get("boat") or {}).get("crew") or []),
                    "deleted_at": at.isoformat(), "expires_at": (at + timedelta(days=KEEP_DAYS)).isoformat()})
    return {"boats": out}


@router.post("/me/deleted-boats/{boat_id}/restore")
async def restore_boat(boat_id: BoatId, user: dict = Depends(get_current_user)):
    owner_id = user["user_id"]
    d = await db.deleted_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "deleted_at": {"$gte": _cutoff()}})
    if not d or not d.get("boat"):
        raise HTTPException(status_code=404, detail="That boat can no longer be brought back")
    if await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="That boat is already back")
    await db.user_boats.insert_one({**d["boat"], "owner_id": owner_id, "boat_id": boat_id, "updated_at": datetime.now(timezone.utc).isoformat()})
    for inv in d.get("invites") or []:
        if not await db.crew_invites.find_one({"token_hash": inv.get("token_hash")}, {"_id": 1}):
            await db.crew_invites.insert_one(inv)
    await db.deleted_boats.delete_one({"_id": d["_id"]})
    return {"ok": True, "boat_id": boat_id, "vessel": (d["boat"].get("boat") or {}).get("vessel", "")}
