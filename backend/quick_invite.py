import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from auth import get_current_user, require_premium
from crew import DEFAULT_TRIP, BoatPath, TripId, email_key, owned_boat, trips_of

router = APIRouter(prefix="/api")
QUICK = "quick"


class QuickIn(BaseModel):
    entry_id: str = Field(min_length=1, max_length=64)
    trip_id: TripId = DEFAULT_TRIP
    trip_name: str = Field(default="", max_length=80)
    roles: List[str] = Field(default_factory=list, max_length=10)
    walk_skip: Optional[List[Annotated[str, Field(max_length=120)]]] = Field(default=None, max_length=600)


def _rsvp_field(trip: str, uid: str) -> str:
    return f"rsvp.{uid}" if trip == DEFAULT_TRIP else f"trip_rsvp.{trip}.{uid}"


async def apply_quick(owner_id: str, boat_id: str, doc: dict, uid: str, name: str, trip: str, roles: list, invited_at: str, walk_skip: list | None = None):
    """Adds the person to the crew (or to another trip) as if they'd joined and said I'm in."""
    now = datetime.now(timezone.utc).isoformat()
    own_walk = {f"walk_skip_crew.{uid}": walk_skip} if walk_skip is not None else {}
    rsvp = {"status": "in", "at": now, "by": QUICK}
    key = {"owner_id": owner_id, "boat_id": boat_id}
    if uid in (doc.get("crew") or []):
        trips = list(dict.fromkeys([*trips_of(doc, uid), trip]))
        update = {"$set": {f"crew_trips.{uid}": trips, _rsvp_field(trip, uid): rsvp, **own_walk}}
        if roles:
            update["$addToSet"] = {f"crew_roles.{uid}": {"$each": roles}}
    else:
        update = {"$addToSet": {"crew": uid}, "$set": {f"crew_trips.{uid}": [trip], _rsvp_field(trip, uid): rsvp, f"crew_roles.{uid}": roles,
                                                       f"crew_joined.{uid}": {"invited_at": invited_at, "joined_at": now, "quick": True},
                                                       **({f"crew_names.{uid}": name} if name else {}), **own_walk},
                  "$unset": {f"agreements.{uid}": "", **({} if own_walk else {f"walk_skip_crew.{uid}": ""})}}
    await db.user_boats.update_one(key, update)


async def _user_for(email: str):
    return await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}, {"_id": 0, "user_id": 1})


@router.post("/boats/{boat_id}/quick-invite")
async def quick_invite(boat_id: BoatPath, payload: QuickIn, user: dict = Depends(require_premium)):
    doc = await owned_boat(user, boat_id)
    entry = await db.crew_register.find_one({"owner_id": user["user_id"], "entry_id": payload.entry_id, "kind": "crew"}, {"_id": 0})
    if not entry or not (entry.get("email") or "").strip():
        raise HTTPException(status_code=400, detail="Pick a registered crew member with an email address")
    email, name = entry["email"].strip().lower(), (entry.get("name") or "").strip()[:80]
    key = email_key(email)
    if key == email_key(user["email"]):
        raise HTTPException(status_code=400, detail="That's your own email address")
    trip_name = payload.trip_name.strip() or "Route Planning"
    roles = [r.strip()[:40] for r in payload.roles if r.strip()]
    walk = list(dict.fromkeys(payload.walk_skip)) if payload.walk_skip is not None else None
    now = datetime.now(timezone.utc)
    pending = await db.crew_invites.find({"owner_id": user["user_id"], "boat_id": boat_id, "email_key": key, "declined_at": None,
                                          "expires_at": {"$gt": now.isoformat()}}, {"_id": 0, "invite_id": 1, "trip_id": 1, "trip_name": 1, "quick": 1}).to_list(20)
    same = [p for p in pending if (p.get("trip_id") or DEFAULT_TRIP) == payload.trip_id]
    if any(p.get("quick") for p in same):
        raise HTTPException(status_code=400, detail=f"{name or email} is already Quick Invited to {trip_name}")
    other = next((p for p in pending if not p.get("quick") and (p.get("trip_id") or DEFAULT_TRIP) != payload.trip_id), None)
    if other:
        raise HTTPException(status_code=409, detail=f"{name or email} has yet to respond to the first join request ({other.get('trip_name') or 'Route Planning'}). Once they join, you can ask them to join another trip.")
    found = await _user_for(email)
    if found and found["user_id"] in (doc.get("crew") or []) and payload.trip_id in trips_of(doc, found["user_id"]):
        raise HTTPException(status_code=400, detail=f"{name or email} is already crew on {trip_name}")
    await db.crew_invites.delete_many({"invite_id": {"$in": [p["invite_id"] for p in same]}})
    if found:
        await apply_quick(user["user_id"], boat_id, doc, found["user_id"], name, payload.trip_id, roles, now.isoformat(), walk)
        return {"joined": True}
    # Not signed up yet: they join the moment they first sign in with this email.
    await db.crew_invites.insert_one({"invite_id": str(uuid.uuid4()), "owner_id": user["user_id"], "boat_id": boat_id, "email": email,
                                      "email_key": key, "name": name, "roles": roles, "trip_id": payload.trip_id, "trip_name": trip_name,
                                      "quick": True, "declined_at": None, "created_at": now.isoformat(), **({"walk_skip": walk} if walk is not None else {}),
                                      "expires_at": (now + timedelta(days=365)).isoformat()})
    return {"joined": False}


async def claim_quick(user: dict):
    """Quick Invites waiting for this person's first sign-in."""
    invs = await db.crew_invites.find({"email_key": email_key(user.get("email") or ""), "quick": True, "owner_id": {"$ne": user["user_id"]},
                                       "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 0}).to_list(20)
    for inv in invs:
        doc = await db.user_boats.find_one({"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]}, {"_id": 0, "crew": 1, "crew_trips": 1})
        if doc:
            await apply_quick(inv["owner_id"], inv["boat_id"], doc, user["user_id"], inv.get("name") or "", inv.get("trip_id") or DEFAULT_TRIP,
                              inv.get("roles") or [], inv.get("created_at") or "", inv.get("walk_skip"))
        await db.crew_invites.delete_one({"invite_id": inv["invite_id"]})
