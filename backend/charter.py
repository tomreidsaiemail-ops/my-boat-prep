"""Charters: the owner registers a charter skipper for a period, then hands over a clean copy of the boat.

The copy belongs to the charter skipper (so they can run it like a skipper: invite crew, change lists, add cupboards)
while the owner's own boat, and its crew, stay frozen read-only until the charter ends.
"""
import html
import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from crew import email_key, owned_boat
from db import db
from email_service import send_email
from features import require_feature

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
DEFAULT_IDS = ("leavingDock", "returningDock", "arrivingDest", "safety", "riggingChecks", "routeHazards", "crewPrep", "provisions", "mealPlan",
               "head", "engineService", "electricalService", "myTodo", "shipsLog", "grabBag", "mayDay", "panPan", "boatBudget")


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
    ticked: List[str] = Field(default_factory=list, max_length=1000)


def public(c: dict) -> dict:
    return {k: c.get(k) for k in ("charter_id", "boat_id", "vessel", "name", "email", "start", "end", "status", "created_at",
                                  "handed_at", "claimed_at", "terms_accepted_at", "returned_at", "delete_at", "deleted_at", "copy_boat_id", "walk_stops")}


async def template_lines(pattern) -> Optional[List[str]]:
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": pattern.pattern, "$options": "i"}}, {"_id": 0, "items": 1})
    return [i.get("label", "").strip() for i in (tpl or {}).get("items") or [] if i.get("label", "").strip()] if tpl else None


def stocked_areas(areas: list) -> list:
    """Every cupboard comes across with its contents, except Food & Drink cupboards (and the cupboards inside them), which are emptied."""
    by_id = {a.get("id"): a for a in areas}

    def fnd(a, seen=()):
        if a.get("food") or a.get("drinks"):
            return True
        parent = by_id.get(a.get("parent_id"))
        return bool(parent) and a.get("id") not in seen and fnd(parent, (*seen, a.get("id")))
    return [{**a, "items": []} if fnd(a) else a for a in areas]


def walk_stops(doc: dict) -> List[dict]:
    """Every labelled spot on every zone map: the charter skipper walks them all (no stops are skipped like for crew)."""
    names = {a.get("id"): a.get("name") for a in doc.get("areas") or []}
    return [{"id": f"{m['id']}:{p['id']}", "label": f"{m.get('name') or m.get('zone') or 'Zone map'}: {names.get(p.get('area_id')) or p.get('label')}"}
            for m in doc.get("zone_maps") or [] for p in m.get("pins") or []]


def charter_copy(src: dict, names: set, c: dict) -> dict:
    """Only the hand-over lists (unticked), empty Ship's Log and To Do, the zone maps and their colours, every cupboard (Food & Drink ones emptied), no routes, crew or invites."""
    keep = []
    for lst in src.get("registry") or []:
        n = norm(lst.get("name"))
        if lst.get("id") in ("shipsLog", "myTodo") or (lst.get("kind") != "maint" and (n.startswith("charter - ") or n in names)):
            keep.append(lst)
    ids = {lst["id"] for lst in keep}
    # Lists left behind stay gone on the copy, so the app doesn't add default or template copies of them back.
    gone = sorted({lst["id"] for lst in src.get("registry") or [] if lst["id"] not in ids} | {i for i in DEFAULT_IDS if i not in ids})
    data = {k: ([] if k in ("shipsLog", "myTodo") else [{**i, "checked": False} for i in v]) for k, v in (src.get("data") or {}).items() if k in ids}
    boat = {**(src.get("boat") or {}), **{f: "" for f in EMPTY_BOAT}, "skipper": c["name"], "log_email": c["email"]}
    areas = stocked_areas(src.get("areas") or [])
    return {"boat": boat, "registry": keep, "data": data, "areas": areas, "zone_maps": src.get("zone_maps") or [], "template_versions": src.get("template_versions") or {},
            "list_ts": {}, "sec_ts": {}, "engine_log": [], "electrical_log": [], "rigging_log": [], "deleted_lists": gone,
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
    await owned_boat(user, boat_id, allow_charter=True)
    now = datetime.now(timezone.utc).isoformat()
    async for c in db.charters.find({"owner_id": user["user_id"], "boat_id": boat_id, "status": "returned", "delete_at": {"$lte": now}}, {"_id": 0, "charter_id": 1, "delete_at": 1}):
        await db.user_boats.delete_many({"charter.charter_id": c["charter_id"]})
        await db.charters.update_one({"charter_id": c["charter_id"]}, {"$set": {"status": "deleted", "deleted_at": c["delete_at"]}})
    rows = await db.charters.find({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "copy_state": 0}).sort("start", -1).to_list(300)
    names = {norm(n) for n in (await template_lines(HANDOVER_LIST) or DEFAULT_HANDOVER)}
    src = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "registry": 1})
    lists = [lst["name"] for lst in (src or {}).get("registry") or []
             if lst.get("id") in ("shipsLog", "myTodo") or (lst.get("kind") != "maint" and (norm(lst["name"]).startswith("charter - ") or norm(lst["name"]) in names))]
    return {"charters": [public(c) for c in rows], "handover_lists": lists}


@router.post("/charters")
async def register_charter(payload: CharterIn, user: dict = Depends(get_current_user)):
    await require_feature(user, "charter")
    doc = await owned_boat(user, payload.boat_id, allow_charter=True)
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
    await require_feature(user, "charter")
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
    lock = {"charter_id": charter_id, "name": c["name"], "email": c["email"], "start": c["start"], "end": c["end"]}
    locked = await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": c["boat_id"], "charter_lock": None}, {"$set": {"charter_lock": lock}})
    if not locked.matched_count:
        raise HTTPException(status_code=409, detail="This boat is already out on charter")
    resp = next((lst for lst in src.get("registry") or [] if norm(lst.get("name")) == RESP_LIST), None)
    c.update({"status": "handed_over", "handed_at": now, "copy_boat_id": f"ch{charter_id[:12]}", "copy_state": charter_copy(src, names, c),
              "vessel": (src.get("boat") or {}).get("vessel", c.get("vessel", "")),
              "responsibilities": [{"id": str(i.get("id")), "label": i.get("label", "")} for i in (src.get("data") or {}).get(resp["id"], []) if i.get("label", "").strip()] if resp else []})
    await db.charters.update_one({"charter_id": charter_id}, {"$set": {k: c[k] for k in ("status", "handed_at", "copy_boat_id", "copy_state", "vessel", "responsibilities")}})
    skipper = await db.users.find_one({"email": {"$regex": f"^{re.escape(c['email'])}$", "$options": "i"}}, {"_id": 0, "user_id": 1})
    if skipper:
        await make_copy(c, skipper["user_id"])
    return public(await db.charters.find_one({"charter_id": charter_id}, {"_id": 0}))


async def my_charter(user: dict, boat_id: str) -> tuple[dict, dict]:
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "charter": 1, "areas": 1, "zone_maps": 1})
    if not doc or not doc.get("charter"):
        raise HTTPException(status_code=404, detail="Charter boat not found")
    c = await db.charters.find_one({"charter_id": doc["charter"]["charter_id"]}, {"_id": 0, "copy_state": 0})
    return doc, c or {}


@router.get("/charter-terms")
async def charter_terms(boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc, c = await my_charter(user, boat_id)
    return {"terms": await template_lines(TERMS_LIST) or DEFAULT_TERMS, "responsibilities": c.get("responsibilities") or [], "stops": walk_stops(doc),
            "accepted_at": c.get("terms_accepted_at"), "ticked": (c.get("resp_ticked") or []) + (c.get("walk_ticked") or []), "start": c.get("start"), "end": c.get("end"),
            "owner_name": c.get("owner_name", ""), "vessel": c.get("vessel", "")}


@router.post("/charter-terms")
async def accept_charter_terms(boat_id: BoatQ, payload: TermsIn, user: dict = Depends(get_current_user)):
    terms = await charter_terms(boat_id, user)
    if terms["accepted_at"]:
        return {"accepted_at": terms["accepted_at"]}
    need = {i["id"] for i in terms["responsibilities"]}
    if not need.issubset(set(payload.ticked)):
        raise HTTPException(status_code=400, detail="Tick every charter skipper responsibility before you accept")
    stops = terms["stops"]
    if not {s["id"] for s in stops}.issubset(set(payload.ticked)):
        raise HTTPException(status_code=400, detail="Tick every stop of the Zone Map Walk Through before you accept")
    doc, c = await my_charter(user, boat_id)
    if (doc["charter"] or {}).get("returned_at"):
        raise HTTPException(status_code=423, detail="This charter has ended, so the charter copy is read only")
    now = datetime.now(timezone.utc)
    await db.charters.update_one({"charter_id": doc["charter"]["charter_id"]}, {"$set": {
        "terms_accepted_at": now.isoformat(), "resp_ticked": sorted(need), "walk_ticked": [s["id"] for s in stops], "walk_stops": [s["label"] for s in stops]}})
    if stops:
        who = c.get("name") or user.get("name") or "the charter skipper"
        listed = "; ".join(s["label"] for s in stops)
        item = {"id": int(now.timestamp() * 1000), "checked": False, "ts": now.isoformat(),
                "label": f"Charter walkthrough signed off by {who} on {now.date().isoformat()} ({len(stops)} {'stop' if len(stops) == 1 else 'stops'}): {listed[:900]}"}
        await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id},
                                       {"$push": {"data.shipsLog": item, "pushed_items": {"list": "shipsLog", "item": item}}, "$set": {"updated_at": now.isoformat()}})
    return {"accepted_at": now.isoformat()}


KEEP_DAYS = 7


def charter_entries(items: list, name: str, taken: set) -> list:
    """The charter skipper's entries, labelled with their name, with ids that can't clash with the owner's own."""
    out = []
    for i in items or []:
        if not (i.get("label") or "").strip():
            continue
        iid = i.get("id")
        if iid is None or iid in taken:
            iid = int(datetime.now(timezone.utc).timestamp() * 1000)
            while iid in taken:
                iid += 1
        taken.add(iid)
        out.append({**i, "id": iid, "label": f"Charter skipper {name}: {i['label'].strip()}", "charter": name})
    return out


def thanks_html(c: dict, vessel: str) -> str:
    e = html.escape
    return (f"<div style=\"font-family:Arial,sans-serif;font-size:15px;color:#0b2545\"><p>Hi {e(c['name'])},</p>"
            f"<p>Thank you for skippering <b>{e(vessel)}</b> on your charter from {e(c['start'])} to {e(c['end'])}. "
            f"{e(c.get('owner_name') or 'The owner')} has ended the charter and your Ship's Log and To Do List are now with them.</p>"
            f"<p>You can still look at your charter copy of {e(vessel)} in My Boat Prep for {KEEP_DAYS} days. It is read only and is then deleted.</p>"
            "<p>Fair winds,<br/>My Boat Prep</p></div>")


@router.post("/charters/{charter_id}/return")
async def end_charter(charter_id: str, user: dict = Depends(get_current_user)):
    c = await own_charter(user, charter_id)
    if c["status"] != "handed_over":
        raise HTTPException(status_code=400, detail="Only a charter that is out can be ended")
    now = datetime.now(timezone.utc)
    copy = await db.user_boats.find_one({"owner_id": c.get("copy_owner"), "boat_id": c.get("copy_boat_id")}, {"_id": 0, "data.shipsLog": 1, "data.myTodo": 1}) if c.get("copy_owner") else None
    own = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": c["boat_id"]}, {"_id": 0, "data.shipsLog": 1, "data.myTodo": 1})
    taken = {i.get("id") for k in ("shipsLog", "myTodo") for i in ((own or {}).get("data") or {}).get(k) or []}
    got = {k: charter_entries(((copy or {}).get("data") or {}).get(k), c["name"], taken) for k in ("shipsLog", "myTodo")}
    push = {f"data.{k}": {"$each": v} for k, v in got.items() if v}
    pushed = [{"list": k, "item": i} for k, v in got.items() for i in v]
    if pushed:
        push["pushed_items"] = {"$each": pushed}
    upd = {"$unset": {"charter_lock": ""}, "$set": {"updated_at": now.isoformat()}}
    if push:
        upd["$push"] = push
    # Unlock and merge first (only while this charter holds the lock), so a failure part-way can simply be retried.
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": c["boat_id"], "charter_lock.charter_id": charter_id}, upd)
    done = await db.charters.update_one({"charter_id": charter_id, "status": "handed_over"},
                                        {"$set": {"status": "returned", "returned_at": now.isoformat(), "delete_at": (now + timedelta(days=KEEP_DAYS)).isoformat()},
                                         "$unset": {"copy_state": ""}})
    if not done.modified_count:
        raise HTTPException(status_code=400, detail="Only a charter that is out can be ended")
    if copy:
        await db.user_boats.update_one({"owner_id": c["copy_owner"], "boat_id": c["copy_boat_id"]},
                                       {"$set": {"charter.returned_at": now.isoformat(), "charter.delete_at": (now + timedelta(days=KEEP_DAYS)).isoformat(),
                                                 "charter_expires_at": now + timedelta(days=KEEP_DAYS)}})
    emailed = False
    try:
        await send_email(to=[c["email"]], subject=f"Thank you for skippering {c.get('vessel') or 'the boat'}", html=thanks_html(c, c.get("vessel") or "the boat"))
        emailed = True
    except Exception as e:  # The charter still ends if the email can't go.
        logging.getLogger(__name__).warning(f"Charter thank-you email failed: {e}")
    return {**public(await db.charters.find_one({"charter_id": charter_id}, {"_id": 0})),
            "log_entries": len(got["shipsLog"]), "todo_entries": len(got["myTodo"]), "emailed": emailed}
