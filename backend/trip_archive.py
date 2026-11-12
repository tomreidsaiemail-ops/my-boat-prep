import json
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from crew import DEFAULT_TRIP, notes_key, owned_boat, trips_of
from db import db
from trip_summary import schedule
from urls import public_base

router = APIRouter(prefix="/api")
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
ArchivePath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
TripId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,60}$")]
MEMBER_FIELDS = ("crew_roles", "crew_names", "crew_joined", "agreements", "walk_skip_crew")
MAX_POINTS = 5000


class Window(BaseModel):
    start: datetime | None = None
    end: datetime | None = None


class ArchiveIn(BaseModel):
    trip_id: TripId
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    items: List[Dict[str, Any]] = Field(default_factory=list, max_length=2000)
    details: Dict[str, Any] = Field(default_factory=dict)
    depart_at: str = Field(default="", max_length=40)
    finish_at: str = Field(default="", max_length=40)
    window: Window = Field(default_factory=Window)
    email_shore: bool = True
    email_crew: bool = True


class RestoreIn(BaseModel):
    to_trip_id: TripId


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _nm(a: dict, b: dict) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 3440.065 * 2 * math.asin(math.sqrt(h))


def _invite_q(owner: str, boat_id: str, trip: str) -> dict:
    q = {"owner_id": owner, "boat_id": boat_id}
    return {**q, "$or": [{"trip_id": trip}, {"trip_id": {"$exists": False}}, {"trip_id": None}]} if trip == DEFAULT_TRIP else {**q, "trip_id": trip}


def _rsvp_key(trip: str, uid: str) -> str:
    return f"rsvp.{uid}" if trip == DEFAULT_TRIP else f"trip_rsvp.{trip}.{uid}"


async def _path(owner: str, boat_id: str, w: Window) -> list:
    end = w.end + timedelta(hours=12) if w.end else _now()
    start = w.start - timedelta(hours=12) if w.start else end - timedelta(days=7)
    q = {"owner_id": owner, "boat_id": boat_id, "at": {"$gte": start.isoformat(), "$lte": min(end, _now()).isoformat()}}
    return await db.track_points.find(q, {"_id": 0, "lat": 1, "lon": 1, "at": 1, "kind": 1}).sort("at", 1).to_list(MAX_POINTS)


def _stats(items: list, crew: list, invites: list, path: list) -> dict:
    dist = sum(_nm(a, b) for a, b in zip(path, path[1:]))
    return {"ticked": sum(1 for i in items if i.get("checked")), "total": len(items), "crew": len(crew), "invites": len(invites),
            "points": len(path), "distance_nm": round(dist, 1), "tracked_from": path[0]["at"] if path else None, "tracked_to": path[-1]["at"] if path else None}


def _summary(a: dict) -> dict:
    return {k: a.get(k) for k in ("archive_id", "trip_id", "name", "archived_at", "depart_at", "finish_at", "stats")} | {
        "route_start": (a.get("details") or {}).get("route_start", ""), "route_dest": (a.get("details") or {}).get("route_dest", ""),
        "crew_names": [c.get("name") for c in a.get("crew") or [] if c.get("name")]}


@router.post("/boats/{boat_id}/trip-archives")
async def archive_trip(boat_id: BoatPath, payload: ArchiveIn, request: Request, user: dict = Depends(get_current_user)):
    if len(json.dumps(payload.model_dump(mode="json"), default=str)) > 1_500_000:
        raise HTTPException(status_code=413, detail="This trip is too big to archive")
    uid, trip = user["user_id"], payload.trip_id
    doc = await owned_boat(user, boat_id)
    walk = (await db.user_boats.find_one({"owner_id": uid, "boat_id": boat_id}, {"_id": 0, "walk_skip_crew": 1}) or {}).get("walk_skip_crew") or {}
    doc = {**doc, "walk_skip_crew": walk}
    key = {"owner_id": uid, "boat_id": boat_id}
    sets, unsets, pulls, crew = {}, {notes_key(trip): ""}, [], []
    for m in [m for m in doc.get("crew") or [] if trip in trips_of(doc, m)]:
        rs = (doc.get("rsvp") or {}).get(m) if trip == DEFAULT_TRIP else ((doc.get("trip_rsvp") or {}).get(trip) or {}).get(m)
        rest = [t for t in trips_of(doc, m) if t != trip]
        crew.append({"user_id": m, "name": (doc.get("crew_names") or {}).get(m, ""), "roles": (doc.get("crew_roles") or {}).get(m) or [], "rsvp": rs,
                     "removed": not rest, "fields": {f: (doc.get(f) or {}).get(m) for f in MEMBER_FIELDS} if not rest else {}})
        unsets[_rsvp_key(trip, m)] = ""
        if rest:
            sets[f"crew_trips.{m}"] = rest
        else:
            pulls.append(m)
            unsets.update({f"{f}.{m}": "" for f in (*MEMBER_FIELDS, "crew_trips")})
    names = {u["user_id"]: u.get("name") or u.get("email", "") for u in await db.users.find({"user_id": {"$in": [c["user_id"] for c in crew]}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(200)}
    for c in crew:
        c["name"] = c["name"] or names.get(c["user_id"], "Crew")
    invites = await db.crew_invites.find(_invite_q(uid, boat_id, trip), {"_id": 0}).to_list(200)
    path = await _path(uid, boat_id, payload.window)
    archive = {"archive_id": str(uuid.uuid4()), "owner_id": uid, "boat_id": boat_id, "trip_id": trip, "name": payload.name.strip(), "description": payload.description,
               "archived_at": _now().isoformat(), "depart_at": payload.depart_at, "finish_at": payload.finish_at, "items": payload.items, "details": payload.details,
               "notes": (doc.get("voyage_notes") if trip == DEFAULT_TRIP else (doc.get("trip_notes") or {}).get(trip)) or "",
               "crew": crew, "invites": invites, "path": path, "stats": _stats(payload.items, crew, invites, path),
               "summary": {"due_at": _now().isoformat(), "shore": payload.email_shore, "crew": payload.email_crew, "base": public_base(request)}}
    await db.trip_archives.insert_one(dict(archive))
    update = {"$unset": unsets, **({"$set": sets} if sets else {}), **({"$pull": {"crew": {"$in": pulls}}} if pulls else {})}
    await db.user_boats.update_one(key, update)
    if invites:
        await db.crew_invites.delete_many({"invite_id": {"$in": [i["invite_id"] for i in invites]}})
    schedule(archive["archive_id"])
    return _summary(archive)


@router.get("/boats/{boat_id}/trip-archives")
async def list_archives(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    docs = await db.trip_archives.find({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "items": 0, "path": 0, "invites": 0, "crew": 0}).sort("archived_at", -1).to_list(500)
    return {"archives": [_summary(d) for d in docs]}


async def _get(user: dict, boat_id: str, archive_id: str) -> dict:
    doc = await db.trip_archives.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "archive_id": archive_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="That archived trip isn't here any more")
    return doc


@router.get("/boats/{boat_id}/trip-archives/{archive_id}")
async def get_archive(boat_id: BoatPath, archive_id: ArchivePath, user: dict = Depends(get_current_user)):
    a = await _get(user, boat_id, archive_id)
    return {**_summary(a), "description": a.get("description", ""), "items": a["items"], "details": a["details"], "notes": a.get("notes", ""), "path": a["path"],
            "crew": [{"name": c["name"], "roles": c["roles"], "rsvp": (c.get("rsvp") or {}).get("status") if isinstance(c.get("rsvp"), dict) else c.get("rsvp")} for c in a["crew"]],
            "invites": [{"name": i.get("name", ""), "email": i.get("email", "")} for i in a.get("invites") or []]}


@router.post("/boats/{boat_id}/trip-archives/{archive_id}/restore")
async def restore_archive(boat_id: BoatPath, archive_id: ArchivePath, payload: RestoreIn, user: dict = Depends(get_current_user)):
    a = await _get(user, boat_id, archive_id)
    doc = await owned_boat(user, boat_id)
    to = payload.to_trip_id
    sets, adds = {notes_key(to): a.get("notes", "")} if a.get("notes") else {}, []
    for c in a["crew"]:
        m = c["user_id"]
        if c.get("removed") and m not in (doc.get("crew") or []):
            adds.append(m)
            sets.update({f"{f}.{m}": v for f, v in (c.get("fields") or {}).items() if v is not None})
            sets[f"crew_trips.{m}"] = [to]
        else:
            sets[f"crew_trips.{m}"] = list(dict.fromkeys([*trips_of(doc, m), to]))
        if c.get("rsvp"):
            sets[_rsvp_key(to, m)] = c["rsvp"]
    update = {**({"$set": sets} if sets else {}), **({"$addToSet": {"crew": {"$each": adds}}} if adds else {})}
    if update:
        await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, update)
    taken = {i["email_key"] for i in await db.crew_invites.find({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "email_key": 1}).to_list(500) if i.get("email_key")}
    back = [{**i, "trip_id": to} for i in a.get("invites") or [] if i.get("email_key") not in taken]
    if back:
        await db.crew_invites.insert_many([dict(i) for i in back])
    await db.trip_archives.delete_one({"archive_id": archive_id})
    return {"trip_id": a["trip_id"], "to_trip_id": to, "name": a["name"], "description": a.get("description", ""), "items": a["items"], "details": a["details"],
            "crew": len(a["crew"]), "invites": len(back)}


@router.delete("/boats/{boat_id}/trip-archives/{archive_id}")
async def delete_archive(boat_id: BoatPath, archive_id: ArchivePath, user: dict = Depends(get_current_user)):
    res = await db.trip_archives.delete_one({"owner_id": user["user_id"], "boat_id": boat_id, "archive_id": archive_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="That archived trip isn't here any more")
    return {"ok": True}


async def ensure_indexes():
    await db.trip_archives.create_index([("owner_id", 1), ("boat_id", 1), ("archived_at", -1)])
    await db.trip_archives.create_index("archive_id", unique=True)
    await db.trip_maps.create_index("key", unique=True)
    await db.trip_maps.create_index("at", expireAfterSeconds=2 * 365 * 24 * 3600)
