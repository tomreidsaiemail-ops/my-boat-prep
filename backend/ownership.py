"""Transfer ownership: a buyer asks for a boat (by its name and the seller's email), the seller prepares it and sells it.

The buyer gets the boat with its cupboards, maintenance and a redacted Ship's Log; crew, trips, shore contacts,
the watch rota, Food & Drink contents and the Transfer ownership checklist stay behind, and the seller's copy goes.
"""
import html
import logging
import re
import uuid
import random
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

from auth import get_current_user
from charter import EMPTY_BOAT, stocked_areas
from crew import email_key, owned_boat
from db import db
from email_service import send_email
from handover import handover_pack
from urls import PUBLIC_APP_URL

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]

LIST_ID = "transferOwnership"
LIST_NAME = "Admin - Transfer ownership"
REDACTED = "XXXXXXXXXX"
CHECKLIST = (
    "Gather maintenance logs and manuals; clear any outstanding finance on any securities register if that exists; "
    "ensure the boat trailer has a current fitness certificate and registration if that is applicable; empty all food from fridges, pantries, and lockers; "
    "remove all personal items; remove all toiletries from heads and cabins; prepare a written Sale and Purchase Agreement listing all included gear and electronics; "
    "arrange a buyer inspection or sea trial; confirm cleared funds in your bank account before handover; "
    "complete the necessary transport authority change of registered person documentation for any trailer; "
    "transfer or cancel vessel registration with the appropriate national authorities and update other national authorities and registers; "
    "transfer or deregister any distress beacon (EPIRB/PLB) and release the VHF MMSI number; transfer or terminate berth or mooring licences; "
    "and cancel your marine insurance once ownership passes."
)
NOT_NAMES = {"crew", "the", "skipper", "captain", "mate", "test", "boat", "owner", "shore", "contact"}
# Copied to the buyer; everything else on the boat (crew, trips, shore contacts, rota, tracking, distress) stays behind.
KEEP = ("data", "registry", "deleted_lists", "engine_log", "electrical_log", "rigging_log", "areas", "zone_maps", "area_photos", "photo",
        "template_versions", "list_hidden", "walk_skip", "walk_stars")
GONE_WITH_BOAT = ("crew_invites", "shore_invites", "track_points", "trip_archives", "walkthroughs", "briefing_reads", "zone_searches")


def checklist_lines() -> List[str]:
    out = []
    for part in CHECKLIST.split(";"):
        t = re.sub(r"^and\s+", "", part.strip()).rstrip(".").strip()
        if t:
            out.append(t[0].upper() + t[1:])
    return out


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def is_trip(lst: dict) -> bool:
    return lst.get("id") == "routeHazards" or bool(lst.get("trip")) or bool(re.match(r"^(route|trip) planning\b", lst.get("name") or "", re.I))


def is_crew_prep_copy(lst: dict) -> bool:
    return bool(re.match(r"^crew prep\s*-\s*\S", lst.get("name") or "", re.I))


def redactor(names: set, emails: set):
    terms = {e.strip().lower() for e in emails if e and "@" in e}
    for n in names:
        n = re.sub(r"\s+", " ", str(n or "")).strip()
        if len(n) < 2:
            continue
        terms.add(n.lower())
        first = n.split(" ")[0]
        if len(first) >= 3 and first.lower() not in NOT_NAMES:
            terms.add(first.lower())
    if not terms:
        return lambda s: s
    rx = re.compile(r"(?<![\w@.])(" + "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)) + r")(?![\w@])", re.I)
    return lambda s: rx.sub(REDACTED, s)


def redact_item(item, scrub):
    if isinstance(item, str):
        return scrub(item)
    if isinstance(item, list):
        return [redact_item(x, scrub) for x in item]
    if isinstance(item, dict):
        return {k: (v if k in ("id", "ts", "at", "checked") else redact_item(v, scrub)) for k, v in item.items()}
    return item


async def crew_people(owner_id: str, boat_id: str, doc: dict) -> tuple[set, set]:
    names, emails = set((doc.get("crew_names") or {}).values()), set()
    uids = list(doc.get("crew") or []) + list((doc.get("crew_names") or {}).keys()) + list((doc.get("shore") or {}).keys())
    async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "name": 1, "email": 1}):
        names.add(u.get("name") or "")
        emails.add(u.get("email") or "")
    for coll, q in ((db.crew_invites, {"owner_id": owner_id, "boat_id": boat_id}), (db.shore_invites, {"owner_id": owner_id, "boat_id": boat_id}),
                    (db.crew_register, {"owner_id": owner_id}), (db.charters, {"owner_id": owner_id, "boat_id": boat_id})):
        async for r in coll.find(q, {"_id": 0, "name": 1, "email": 1, "nok_name": 1, "nok_email": 1}):
            names.update({r.get("name") or "", r.get("nok_name") or ""})
            emails.update({r.get("email") or "", r.get("nok_email") or ""})
    for s in (doc.get("shore") or {}).values():
        if isinstance(s, dict):
            names.add(s.get("name") or "")
            emails.add(s.get("email") or "")
    return {n for n in names if n}, {e for e in emails if e}


def buyer_copy(src: dict, buyer: dict, scrub) -> dict:
    keep, dropped = [], []
    for lst in src.get("registry") or []:
        gone = lst.get("id") == LIST_ID or is_crew_prep_copy(lst) or (is_trip(lst) and lst.get("id") != "routeHazards")
        (dropped if gone else keep).append(lst)
    gone_ids = {lst.get("id") for lst in dropped}
    data = {k: v for k, v in (src.get("data") or {}).items() if k not in gone_ids}
    if "shipsLog" in data:
        data["shipsLog"] = [redact_item(i, scrub) for i in data["shipsLog"] or []]
    if "routeHazards" in data:
        data["routeHazards"] = [{**i, "checked": False} for i in data["routeHazards"] or []]
    boat = {**(src.get("boat") or {}), **{f: "" for f in EMPTY_BOAT}, "trips": [], "skipper": buyer.get("name") or "",
            "log_email": buyer.get("email") or "", "shore_enabled": False}
    now = datetime.now(timezone.utc).isoformat()
    return {**{k: src[k] for k in KEEP if src.get(k) is not None}, "boat": boat, "registry": keep, "data": data,
            "areas": stocked_areas(src.get("areas") or []), "deleted_lists": sorted(set(src.get("deleted_lists") or []) | {lst["id"] for lst in dropped}),
            "list_ts": {}, "sec_ts": {}, "boat_ts": {}, "emergency_checked": {}, "crew": [], "created_at": now, "updated_at": now, "synced_at": now,
            "transferred": {"vessel": boat.get("vessel", ""), "at": now}}


class RequestIn(BaseModel):
    boat_name: str = Field(min_length=1, max_length=80)
    owner_email: str = Field(min_length=3, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailIn(BaseModel):
    items: List[str] = Field(default_factory=list, max_length=200)


class SellIn(BaseModel):
    checklist_received: bool
    exported: bool
    request_id: Optional[str] = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    tz: str = Field(default="", max_length=60)


async def pending_requests(user: dict, vessel: str) -> list:
    if not user.get("email") or not norm(vessel):
        return []
    return await db.ownership_requests.find({"owner_key": email_key(user["email"]), "boat_key": norm(vessel), "status": "pending"},
                                            {"_id": 0}).sort("created_at", 1).to_list(50)


def sold_when(tz_name: str) -> str:
    try:
        tz = ZoneInfo(tz_name) if tz_name else timezone.utc
    except (KeyError, ValueError):
        tz = timezone.utc
    return datetime.now(tz).strftime("%a %-d %b %Y, %H:%M")


async def tell_others(others: list, vessel: str):
    """Buyers who weren't picked hear the boat went to someone else; their requests are removed."""
    for r in others:
        await db.ownership_requests.delete_one({"request_id": r["request_id"]})
        try:
            await send_email(to=[r["buyer_email"]], subject=f"{vessel}: ownership went to another buyer",
                             html=f"<p>Hi {html.escape(r.get('buyer_name') or 'there')},</p><p>The owner of {html.escape(vessel)} has transferred it to another buyer on "
                                  "My Boat Prep, so your Request Ownership Transfer has been removed.</p>")
        except Exception:  # noqa: BLE001 - the sale is done; one missed courtesy email mustn't undo it
            log.exception("Couldn't tell an unpicked buyer")


@router.post("/ownership/requests")
async def request_transfer(payload: RequestIn, user: dict = Depends(get_current_user)):
    if email_key(payload.owner_email) == email_key(user.get("email") or ""):
        raise HTTPException(status_code=400, detail="That's your own email. Enter the current owner's email.")
    q = {"buyer_id": user["user_id"], "owner_key": email_key(payload.owner_email), "boat_key": norm(payload.boat_name), "status": "pending"}
    now = datetime.now(timezone.utc).isoformat()
    await db.ownership_requests.update_one(q, {"$set": {"boat_name": payload.boat_name.strip(), "owner_email": payload.owner_email.strip(), "buyer_email": user.get("email") or "",
                                                        "buyer_name": user.get("name") or "", "updated_at": now},
                                               "$setOnInsert": {"request_id": uuid.uuid4().hex, "created_at": now}}, upsert=True)
    return {"ok": True}


@router.get("/ownership/requests")
async def my_requests(user: dict = Depends(get_current_user)):
    rows = await db.ownership_requests.find({"buyer_id": user["user_id"]}, {"_id": 0, "request_id": 1, "boat_name": 1, "owner_email": 1, "status": 1, "created_at": 1}).sort("created_at", -1).to_list(50)
    return {"requests": rows}


@router.get("/ownership/checklist")
async def checklist(_: dict = Depends(get_current_user)):
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(LIST_NAME)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    lines = [i.get("label", "").strip() for i in (tpl or {}).get("items") or [] if i.get("label", "").strip()]
    return {"items": lines or checklist_lines()}


@router.get("/ownership/status")
async def status(boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    rows = await pending_requests(user, (doc.get("boat") or {}).get("vessel", ""))
    return {"requests": [{k: r.get(k) for k in ("request_id", "buyer_name", "buyer_email", "created_at")} for r in rows]}


@router.post("/ownership/email-checklist")
async def email_checklist(payload: EmailIn, boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    vessel = (doc.get("boat") or {}).get("vessel") or "your boat"
    rows = [str(i).strip()[:400] for i in payload.items if str(i).strip()] or (await checklist(user))["items"]
    e = html.escape
    body = (f"<p>Here is your Transfer Ownership checklist for {e(vessel)}.</p><ol>" + "".join(f"<li>{e(r)}</li>" for r in rows) + "</ol>"
            "<p>When you have it, tick <b>Transfer Ownership checklist received</b> in the Transfer ownership list in My Boat Prep.</p>"
            "<p>This checklist is deleted when the boat is transferred. The new owner will not see it.</p>")
    sent = await send_email(to=[user["email"]], subject=f"Transfer Ownership Checklist: {vessel}", html=body)
    return {"ok": True, "to": user["email"], "training": sent is None}


@router.post("/ownership/sell")
async def sell(payload: SellIn, boat_id: BoatQ, user: dict = Depends(get_current_user)):
    if not (payload.checklist_received and payload.exported):
        raise HTTPException(status_code=400, detail="Tick Transfer Ownership checklist received and Export and save all lists for your records first.")
    await owned_boat(user, boat_id)
    src = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0})
    if src.get("model") or (src.get("charter") or {}).get("charter_id"):
        raise HTTPException(status_code=400, detail="This boat can't be transferred")
    vessel = (src.get("boat") or {}).get("vessel", "")
    reqs = await pending_requests(user, vessel)
    if not reqs:
        raise HTTPException(status_code=409, detail="The new owner hasn't requested this boat yet. Ask them to use Request Ownership Transfer... with this boat's name and your email.")
    req = next((r for r in reqs if r["request_id"] == payload.request_id), None) if payload.request_id else (reqs[0] if len(reqs) == 1 else None)
    if not req:
        raise HTTPException(status_code=409, detail="More than one person has asked for this boat. Pick the new owner first.")
    buyer = await db.users.find_one({"user_id": req["buyer_id"]}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})
    if not buyer or buyer["user_id"] == user["user_id"]:
        raise HTTPException(status_code=409, detail="The new owner's account can't be found")
    names, emails = await crew_people(user["user_id"], boat_id, src)
    new_id = f"b{uuid.uuid4().hex[:10]}"
    when = sold_when(payload.tz)
    copy = buyer_copy(src, buyer, redactor(names, emails))
    stamp = int(datetime.now(timezone.utc).timestamp() * 1000) * 1000 + random.randint(0, 999)
    copy["data"]["shipsLog"] = [*(copy["data"].get("shipsLog") or []),
                                {"id": stamp, "label": f"Boat sold to new owner on {when}", "checked": False, "ts": datetime.now(timezone.utc).isoformat()}]
    await db.user_boats.insert_one({"owner_id": buyer["user_id"], "boat_id": new_id, **copy})
    for coll in (db.item_photos, db.item_files):
        await coll.update_many({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"owner_id": buyer["user_id"], "boat_id": new_id}})
    now = datetime.now(timezone.utc).isoformat()
    # The seller's copy is kept on the transfer record (out of sight) before it leaves their boats.
    await db.boat_transfers.insert_one({"transfer_id": uuid.uuid4().hex, "seller_id": user["user_id"], "boat_id": boat_id, "vessel_key": norm(vessel),
                                        "buyer_id": buyer["user_id"], "new_boat_id": new_id, "at": now, "seller_copy": src})
    await db.user_boats.delete_one({"owner_id": user["user_id"], "boat_id": boat_id})
    for name in GONE_WITH_BOAT:
        await db[name].delete_many({"owner_id": user["user_id"], "boat_id": boat_id})
    await db.ownership_requests.update_one({"request_id": req["request_id"]}, {"$set": {"status": "done", "done_at": now, "new_boat_id": new_id}})
    msg = f"{vessel or 'A boat'} is now yours. {user.get('name') or 'The previous owner'} transferred it to you on My Boat Prep."
    await db.user_notices.insert_one({"notice_id": uuid.uuid4().hex, "user_id": buyer["user_id"], "title": "Boat transferred to you", "text": msg,
                                      "boat_id": new_id, "seen": False, "created_at": now})
    try:
        subject, body = await handover_pack(copy, user.get("name") or "The previous owner", when, PUBLIC_APP_URL)
        await send_email(to=[buyer["email"]], subject=subject, html=body)
    except Exception:  # noqa: BLE001 - the transfer itself is done; the in-app message still tells them
        log.exception("Handover pack email to the new owner failed")
    await tell_others([r for r in reqs if r["request_id"] != req["request_id"]], vessel or "the boat")
    return {"ok": True, "buyer_email": buyer["email"], "buyer_name": buyer.get("name") or ""}


@router.get("/me/notices")
async def notices(user: dict = Depends(get_current_user)):
    rows = await db.user_notices.find({"user_id": user["user_id"], "seen": False}, {"_id": 0}).sort("created_at", 1).to_list(20)
    return {"notices": rows}


@router.post("/me/notices/{notice_id}/seen")
async def notice_seen(notice_id: Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")], user: dict = Depends(get_current_user)):
    await db.user_notices.update_one({"notice_id": notice_id, "user_id": user["user_id"]}, {"$set": {"seen": True}})
    return {"ok": True}


async def was_transferred(owner_id: str, boat_id: str, vessel: str) -> bool:
    """A seller's other phone mustn't bring a sold boat back by syncing its old copy."""
    return bool(norm(vessel)) and bool(await db.boat_transfers.find_one({"seller_id": owner_id, "boat_id": boat_id, "vessel_key": norm(vessel)}, {"_id": 1}))


async def seed_transfer_list():
    if await db.migrations.find_one({"_id": "transfer_ownership_list"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(LIST_NAME)}\s*$", "$options": "i"}}, {"_id": 1}):
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid.uuid4().hex[:10]}", "custom": True, "name": LIST_NAME, "private": True,
                                            "description": "Checklist the seller gets in their Transfer ownership list (and by email). One step per line.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(checklist_lines())], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "transfer_ownership_list", "at": now})
