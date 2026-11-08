"""Charters: the owner registers a charter skipper for a period, then hands over a clean copy of the boat.

The copy belongs to the charter skipper (so they can run it like a skipper: invite crew, change lists, add cupboards)
while the owner's own boat, and its crew, stay frozen read-only until the charter ends.
"""
import re
import uuid
from datetime import date, datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from crew import email_key, owned_boat
from db import db

router = APIRouter(prefix="/api")
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]

HANDOVER_LIST = re.compile(r"^\s*admin - charter lists to hand over\s*$", re.I)
TERMS_LIST = re.compile(r"^\s*admin - charter boat terms and conditions\s*$", re.I)
RESP_LIST = "charter - charter skipper responsibilities"
DEFAULT_HANDOVER = [
    "Leaving Dock", "Returning to Dock", "Arriving at Destination", "Safety", "Rigging Checks", "Route Planning", "Crew Prep",
    "Provisions", "Meal Plan", "Head (Toilet)", "My To Do List", "Ship's Log", "Grab Bag", "Mayday", "Pan-Pan", "Crew Roles",
    "First Aid Kit - basic for cruising", "First Aid Kit - advanced for long passages", "Disaster Strikes - Mast Fail",
]
DEFAULT_TERMS = [
    "I hold the qualifications and experience needed to skipper this boat in the waters and conditions of this charter.",
    "I am responsible for the safety of everyone on board, and will brief my crew on the safety equipment and emergency procedures.",
    "I will keep the Ship's Log up to date during the charter, and complete the return-to-dock checklist before handing the boat back.",
    "I will report any damage, breakage or loss to the owner as soon as possible, and add anything that needs fixing to the My To Do List.",
    "I will return the boat on the agreed date, clean, with the agreed fuel, water and gas levels.",
]
EMPTY_BOAT = ("route_start", "route_dest", "depart", "arrive", "weather", "skipper_phone", "shore_email")
STATE_KEYS = ("boat", "registry", "data", "areas", "template_versions", "list_ts", "sec_ts")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lstrip("*").strip()).lower()


def ymd(v: str) -> str:
    return date.fromisoformat(v).isoformat()


class CharterIn(BaseModel):
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def iso_day(cls, v):
        try:
            return ymd(v)
        except ValueError as e:
            raise ValueError("Use a date like 2027-01-01") from e


class TermsIn(BaseModel):
    ticked: List[str] = Field(default_factory=list, max_length=300)


def public(c: dict) -> dict:
    return {k: c.get(k) for k in ("charter_id", "boat_id", "vessel", "name", "email", "start", "end", "status", "created_at",
                                  "handed_at", "claimed_at", "terms_accepted_at", "returned_at", "deleted_at", "copy_boat_id")}


async def template_lines(pattern) -> Optional[List[str]]:
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": pattern.pattern, "$options": "i"}}, {"_id": 0, "items": 1})
    return [i.get("label", "").strip() for i in (tpl or {}).get("items") or [] if i.get("label", "").strip()] if tpl else None


def charter_copy(src: dict, names: set, c: dict) -> dict:
    """Only the hand-over lists (unticked), empty Ship's Log and To Do, empty cupboards, no routes, crew or invites."""
    keep = []
    for lst in src.get("registry") or []:
        n = norm(lst.get("name"))
        if lst.get("id") in ("shipsLog", "myTodo") or (lst.get("kind") != "maint" and (n.startswith("charter - ") or n in names)):
            keep.append(lst)
    ids = {lst["id"] for lst in keep}
    data = {k: ([] if k in ("shipsLog", "myTodo") else [{**i, "checked": False} for i in v]) for k, v in (src.get("data") or {}).items() if k in ids}
    boat = {**(src.get("boat") or {}), **{f: "" for f in EMPTY_BOAT}, "skipper": c["name"], "log_email": c["email"]}
    areas = [{**a, "items": []} for a in src.get("areas") or []]
    return {"boat": boat, "registry": keep, "data": data, "areas": areas, "template_versions": src.get("template_versions") or {},
            "list_ts": {}, "sec_ts": {}, "engine_log": [], "electrical_log": [], "rigging_log": [], "deleted_lists": [],
            "emergency_checked": {}, "list_hidden": []}


async def make_copy(c: dict, user_id: str):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"owner_id": user_id, "boat_id": c["copy_boat_id"], **c["copy_state"], "crew": [], "created_at": now, "updated_at": now, "synced_at": now,
           "charter": {"charter_id": c["charter_id"], "owner_id": c["owner_id"], "boat_id": c["boat_id"], "vessel": c["vessel"],
                       "start": c["start"], "end": c["end"], "owner_name": c.get("owner_name", "")}}
    await db.user_boats.update_one({"owner_id": user_id, "boat_id": c["copy_boat_id"]}, {"$setOnInsert": doc}, upsert=True)
    await db.charters.update_one({"charter_id": c["charter_id"]}, {"$set": {"copy_owner": user_id, "claimed_at": now}, "$unset": {"copy_state": ""}})


async def claim_charters(user: dict):
    """A charter skipper's copy appears as soon as the boat is handed over, the first time they log in with that email."""
    if not user.get("email"):
        return
    async for c in db.charters.find({"email_key": email_key(user["email"]), "status": "handed_over", "copy_owner": None}):
        await make_copy(c, user["user_id"])


@router.get("/charters")
async def list_charters(boat_id: BoatQ, user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    rows = await db.charters.find({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "copy_state": 0}).sort("start", -1).to_list(300)
    names = {norm(n) for n in (await template_lines(HANDOVER_LIST) or DEFAULT_HANDOVER)}
    src = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "registry": 1})
    lists = [lst["name"] for lst in (src or {}).get("registry") or []
             if lst.get("id") in ("shipsLog", "myTodo") or (lst.get("kind") != "maint" and (norm(lst["name"]).startswith("charter - ") or norm(lst["name"]) in names))]
    return {"charters": [public(c) for c in rows], "handover_lists": lists}


@router.post("/charters")
async def register_charter(payload: CharterIn, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, payload.boat_id)
    if payload.end < payload.start:
        raise HTTPException(status_code=400, detail="The charter has to end on or after its first day")
    clash = await db.charters.find_one({"owner_id": user["user_id"], "boat_id": payload.boat_id, "status": {"$in": ["registered", "handed_over"]},
                                        "start": {"$lte": payload.end}, "end": {"$gte": payload.start}}, {"_id": 0, "name": 1, "start": 1, "end": 1})
    if clash:
        raise HTTPException(status_code=409, detail=f"That overlaps {clash['name']}'s charter ({clash['start']} to {clash['end']})")
    c = {"charter_id": uuid.uuid4().hex, "owner_id": user["user_id"], "owner_name": user.get("name") or user.get("email", ""),
         "boat_id": payload.boat_id, "vessel": (doc.get("boat") or {}).get("vessel", ""),
         "name": payload.name.strip(), "email": payload.email.strip(), "email_key": email_key(payload.email),
         "start": payload.start, "end": payload.end, "status": "registered", "copy_owner": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.charters.insert_one(c)
    return public(c)


async def own_charter(user: dict, charter_id: str) -> dict:
    c = await db.charters.find_one({"charter_id": charter_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Charter not found")
    return c


@router.delete("/charters/{charter_id}")
async def remove_charter(charter_id: str, user: dict = Depends(get_current_user)):
    c = await own_charter(user, charter_id)
    if c["status"] != "registered":
        raise HTTPException(status_code=400, detail="Only a charter that hasn't been handed over can be removed")
    await db.charters.delete_one({"charter_id": charter_id})
    return {"ok": True}


@router.post("/charters/{charter_id}/handover")
async def hand_over(charter_id: str, user: dict = Depends(get_current_user)):
    c = await own_charter(user, charter_id)
    if c["status"] != "registered":
        raise HTTPException(status_code=400, detail="This charter has already been handed over")
    src = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": c["boat_id"]}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Boat not found")
    if src.get("charter_lock"):
        raise HTTPException(status_code=409, detail="This boat is already out on charter")
    names = {norm(n) for n in (await template_lines(HANDOVER_LIST) or DEFAULT_HANDOVER)}
    now = datetime.now(timezone.utc).isoformat()
    c.update({"status": "handed_over", "handed_at": now, "copy_boat_id": f"ch{charter_id[:12]}", "copy_state": charter_copy(src, names, c),
              "vessel": (src.get("boat") or {}).get("vessel", c.get("vessel", ""))})
    await db.charters.update_one({"charter_id": charter_id}, {"$set": {k: c[k] for k in ("status", "handed_at", "copy_boat_id", "copy_state", "vessel")}})
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": c["boat_id"]},
                                   {"$set": {"charter_lock": {"charter_id": charter_id, "name": c["name"], "email": c["email"], "start": c["start"], "end": c["end"]}}})
    skipper = await db.users.find_one({"email": {"$regex": f"^{re.escape(c['email'])}$", "$options": "i"}}, {"_id": 0, "user_id": 1})
    if skipper:
        await make_copy(c, skipper["user_id"])
    return public(await db.charters.find_one({"charter_id": charter_id}, {"_id": 0}))


async def my_charter(user: dict, boat_id: str) -> tuple[dict, dict]:
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "charter": 1, "registry": 1, "data": 1})
    if not doc or not doc.get("charter"):
        raise HTTPException(status_code=404, detail="Charter boat not found")
    c = await db.charters.find_one({"charter_id": doc["charter"]["charter_id"]}, {"_id": 0, "copy_state": 0})
    return doc, c or {}


@router.get("/charter-terms")
async def charter_terms(boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc, c = await my_charter(user, boat_id)
    resp = next((lst for lst in doc.get("registry") or [] if norm(lst.get("name")) == RESP_LIST), None)
    items = [{"id": str(i.get("id")), "label": i.get("label", "")} for i in (doc.get("data") or {}).get(resp["id"], [])] if resp else []
    return {"terms": await template_lines(TERMS_LIST) or DEFAULT_TERMS, "responsibilities": [i for i in items if i["label"].strip()],
            "accepted_at": c.get("terms_accepted_at"), "ticked": c.get("resp_ticked") or [], "start": c.get("start"), "end": c.get("end"),
            "owner_name": c.get("owner_name", ""), "vessel": c.get("vessel", "")}


@router.post("/charter-terms")
async def accept_charter_terms(boat_id: BoatQ, payload: TermsIn, user: dict = Depends(get_current_user)):
    terms = await charter_terms(boat_id, user)
    need = {i["id"] for i in terms["responsibilities"]}
    if not need.issubset(set(payload.ticked)):
        raise HTTPException(status_code=400, detail="Tick every charter skipper responsibility before you accept")
    doc, c = await my_charter(user, boat_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.charters.update_one({"charter_id": doc["charter"]["charter_id"]}, {"$set": {"terms_accepted_at": now, "resp_ticked": sorted(need)}})
    return {"accepted_at": now}
