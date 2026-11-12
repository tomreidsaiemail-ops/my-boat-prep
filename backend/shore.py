import asyncio
import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Annotated, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from crew import email_key, owned_boat
from db import db
from email_service import send_email
from gps_exclusions import excluded
from land import on_water
from urls import public_base

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

PING_MIN = 60
ONLINE_GRACE = timedelta(minutes=PING_MIN + 5)
ALERT_AFTER = timedelta(minutes=2 * PING_MIN + 5)
KEEP = timedelta(days=30)
Owner = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
KeyPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def status_of(t: dict | None) -> dict:
    """online, offline (missed the hourly ping), waiting (no position yet) or off."""
    t = t or {}
    if not t.get("on") and t.get("arrived_at"):
        return {"state": "arrived", "last_at": t.get("last_at"), "arrived_at": t["arrived_at"], "arrived_pos": t.get("arrived_pos")}
    if not t.get("on"):
        return {"state": "off", "last_at": t.get("last_at")}
    last = t.get("last_at")
    ashore = t.get("ashore_at")
    if ashore and (not last or ashore > last) and _now() - datetime.fromisoformat(ashore) <= ONLINE_GRACE:
        return {"state": "ashore", "last_at": last, "ashore_at": ashore}
    if not last:
        return {"state": "waiting", "last_at": None}
    gap = _now() - datetime.fromisoformat(last)
    return {"state": "online" if gap <= ONLINE_GRACE else "offline", "last_at": last, "minutes": int(gap.total_seconds() // 60)}


def tracking_brief(d: dict) -> dict:
    t = d.get("tracking") or {}
    return {"on": bool(t.get("on")), "trip_id": t.get("trip_id")}


async def ensure_indexes():
    await db.track_points.create_index([("trip_id", 1), ("at", 1)], unique=True)
    await db.track_points.create_index("exp", expireAfterSeconds=0)
    await db.user_boats.create_index("shore_ids")
    await db.shore_invites.create_index("token_hash")
    await db.shore_invites.create_index("email_key")


# ---------- Skipper: shore contacts and the tracking switch ----------

class ShoreInviteIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=3, max_length=120)
    send_email: bool = True


class TrackingIn(BaseModel):
    on: bool


def _contacts(doc: dict) -> list:
    return [{"key": uid, "name": c.get("name", ""), "email": c.get("email", ""), "status": "joined", "joined_at": c.get("joined_at")}
            for uid, c in (doc.get("shore") or {}).items()]


@router.get("/boats/{boat_id}/shore")
async def get_shore(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "boat_id": 1, "shore": 1, "tracking": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    invites = await db.shore_invites.find({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "token_hash": 0}).sort("created_at", 1).to_list(50)
    out = _contacts(doc) + [{"key": i["invite_id"], "name": i["name"], "email": i["email"], "status": "invited", "created_at": i["created_at"]} for i in invites]
    return {"contacts": out, "tracking": {**(doc.get("tracking") or {}), **status_of(doc.get("tracking"))}}


def _invite_html(skipper: str, vessel: str, name: str, link: str) -> str:
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<h2 style="margin:0 0 12px">Hi {escape(name)}, you\'re {escape(vessel)}\'s shore contact</h2>'
            f'<p>{escape(skipper)} has asked you to keep an eye on <b>{escape(vessel)}</b> from shore. '
            'Sign in to see the boat\'s path on a map, where it is now, and whether it\'s online.</p>'
            f'<p><a href="{escape(link)}" style="display:inline-block;background:#0f2a4a;color:#fff;padding:12px 20px;border-radius:8px;'
            'text-decoration:none;font-weight:bold">Open the shore contact page</a></p>'
            '<p style="font-size:13px;color:#475569">Positions are sent while My Boat Prep is open on a phone aboard. '
            'If the boat misses its hourly check-in, the page shows it as offline.</p></div>')


@router.post("/boats/{boat_id}/shore/invites")
async def invite_shore(boat_id: BoatPath, payload: ShoreInviteIn, request: Request, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    email, name = payload.email.strip(), payload.name.strip()
    key = email_key(email)
    if "@" not in key or "." not in key.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid email")
    if key == email_key(user["email"]):
        raise HTTPException(status_code=400, detail="That's your own email. Invite someone ashore.")
    if any(email_key(c.get("email", "")) == key for c in (doc.get("shore") or {}).values()):
        raise HTTPException(status_code=400, detail=f"{email} is already a shore contact for this boat")
    token = secrets.token_urlsafe(32)
    now = _now()
    await db.shore_invites.delete_many({"owner_id": user["user_id"], "boat_id": boat_id, "email_key": key})
    await db.shore_invites.insert_one({"invite_id": str(uuid.uuid4()), "token_hash": _hash(token), "owner_id": user["user_id"], "boat_id": boat_id,
                                       "email": email, "email_key": key, "name": name, "created_at": now.isoformat(), "expires_at": (now + timedelta(days=30)).isoformat()})
    link = f"{public_base(request)}/shore/join/{token}"
    vessel = (doc.get("boat") or {}).get("vessel") or "the boat"
    sent = False
    if payload.send_email:
        try:
            sent = bool(await send_email(to=[email], subject=f"You're the shore contact for {vessel}", html=_invite_html(user.get("name") or user["email"], vessel, name, link)))
        except Exception as e:  # noqa: BLE001
            log.warning("Shore invite email failed: %s", e)
    return {"link": link, "emailed": sent}


@router.delete("/boats/{boat_id}/shore/contacts/{key}")
async def remove_shore(boat_id: BoatPath, key: KeyPath, user: dict = Depends(get_current_user)):
    res = await db.shore_invites.delete_one({"owner_id": user["user_id"], "boat_id": boat_id, "invite_id": key})
    if not res.deleted_count:
        await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$unset": {f"shore.{key}": ""}, "$pull": {"shore_ids": key}})
    return {"ok": True}


@router.put("/boats/{boat_id}/shore/tracking")
async def set_tracking(boat_id: BoatPath, payload: TrackingIn, user: dict = Depends(get_current_user)):
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "boat_id": 1, "tracking": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    t = doc.get("tracking") or {}
    if payload.on and not t.get("on"):
        trip = str(uuid.uuid4())
        t = {"on": True, "trip_id": trip, "started_at": _now().isoformat(), "started_by": user["user_id"],
             "trip_ids": ([trip] + (t.get("trip_ids") or []))[:10]}
    elif not payload.on:
        t = {**t, "on": False, "ended_at": _now().isoformat()}
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"tracking": t}})
    return {**t, **status_of(t)}


def _nz(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(timezone(timedelta(hours=12))).strftime("%d %b %H:%M")


def _map_link(pos: dict | None) -> str:
    return f"https://www.google.com/maps?q={pos['lat']:.5f},{pos['lon']:.5f}" if pos and pos.get("lat") is not None else ""


def _arrived_html(vessel: str, skipper: str, at: str, pos: dict | None) -> str:
    link = _map_link(pos)
    where = f'<p>Last position: <a href="{link}">{pos["lat"]:.4f}, {pos["lon"]:.4f}</a></p>' if link else ""
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<h2 style="margin:0 0 12px;color:#047857">{escape(vessel)} has arrived safely</h2>'
            f'<p>{escape(skipper)} marked the trip as finished at <b>{escape(_nz(at))} (NZ time)</b>. Position sharing has stopped.</p>{where}</div>')


@router.post("/boats/{boat_id}/shore/arrived")
async def arrived_safely(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    """Skipper's one tap: ends the trip and tells every shore contact the boat arrived safely."""
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "boat_id": 1, "boat.vessel": 1, "tracking": 1, "shore": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    t = doc.get("tracking") or {}
    if not t.get("on"):
        raise HTTPException(status_code=400, detail="Position sharing isn't on, so there's no trip to finish")
    now = _now().isoformat()
    t = {**t, "on": False, "ended_at": now, "arrived_at": now, "arrived_pos": t.get("last")}
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"tracking": t}})
    vessel = (doc.get("boat") or {}).get("vessel") or "The boat"
    to = [c["email"] for c in (doc.get("shore") or {}).values() if c.get("email")]
    emailed = False
    if to:
        try:
            await send_email(to=to, subject=f"{vessel} has arrived safely", html=_arrived_html(vessel, user.get("name") or user["email"], now, t.get("arrived_pos")))
            emailed = True
        except Exception as e:  # noqa: BLE001
            log.warning("Arrived email failed for %s/%s: %s", user["user_id"], boat_id, e)
    return {**t, **status_of(t), "emailed": emailed, "told": len(to)}


# ---------- Phones aboard: positions ----------

class PointIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    at: int = Field(gt=1_600_000_000_000, lt=4_000_000_000_000)
    acc: float | None = Field(default=None, ge=0, le=100000)
    kind: Literal["start", "move", "ping"] = "move"


class PointsIn(BaseModel):
    owner_id: str = Field(default="", max_length=80)
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    trip_id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    points: List[PointIn] = Field(min_length=1, max_length=500)


@router.post("/track/points")
async def add_points(payload: PointsIn, user: dict = Depends(get_current_user)):
    owner = payload.owner_id or user["user_id"]
    q = {"owner_id": owner, "boat_id": payload.boat_id}
    if owner != user["user_id"]:
        q["crew"] = user["user_id"]
    doc = await db.user_boats.find_one(q, {"_id": 0, "boat_id": 1, "tracking": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're not aboard this boat any more")
    t = doc.get("tracking") or {}
    if payload.trip_id not in (t.get("trip_ids") or []):
        return {"saved": 0, "tracking": tracking_brief(doc)}
    now = _now()
    # Land filter: only positions on the water are logged, unless the sender is on the admin exclusion list.
    points = payload.points if await excluded(user.get("email")) else [p for p in payload.points if await on_water(p.lat, p.lon)]
    latest = max(payload.points, key=lambda p: p.at)
    ashore = latest not in points
    rows = [{"owner_id": owner, "boat_id": payload.boat_id, "trip_id": payload.trip_id, "lat": round(p.lat, 6), "lon": round(p.lon, 6),
             "at": datetime.fromtimestamp(min(p.at, now.timestamp() * 1000) / 1000, timezone.utc).isoformat(), "acc": p.acc, "kind": p.kind,
             "by": user["user_id"], "exp": now + KEEP} for p in points]
    saved = 0
    if rows:
        try:
            res = await db.track_points.insert_many(rows, ordered=False)
            saved = len(res.inserted_ids)
        except Exception as e:  # noqa: BLE001  duplicates from a re-sent queue are fine
            saved = getattr(e, "details", {}).get("nInserted", 0)
    if t.get("on") and payload.trip_id == t.get("trip_id"):
        upd = {"$set": {}, "$unset": {"tracking.alerted_at": ""}}
        last = max(rows, key=lambda r: r["at"]) if rows else None
        if last and (not t.get("last_at") or last["at"] > t["last_at"]):
            upd["$set"].update({"tracking.last_at": last["at"], "tracking.last": {"lat": last["lat"], "lon": last["lon"]}})
        if ashore:
            upd["$set"]["tracking.ashore_at"] = now.isoformat()  # still heard from, just not logged
        else:
            upd["$unset"]["tracking.ashore_at"] = ""
        await db.user_boats.update_one(q, {k: v for k, v in upd.items() if v})
    return {"saved": saved, "ashore": ashore, "tracking": tracking_brief(doc)}


# ---------- Shore contact ----------

class JoinIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)


class HomeIn(BaseModel):
    home: Literal["shore", "app"]


@router.post("/shore/join")
async def join_shore(payload: JoinIn, user: dict = Depends(get_current_user)):
    inv = await db.shore_invites.find_one({"token_hash": _hash(payload.token)}, {"_id": 0})
    if not inv or inv["expires_at"] < _now().isoformat():
        raise HTTPException(status_code=400, detail="This shore contact invite has expired or was cancelled. Ask the skipper for a new one.")
    if email_key(inv["email"]) != email_key(user["email"]):
        raise HTTPException(status_code=403, detail=f"This invite was sent to {inv['email']}. Sign in with that email to accept it.")
    if not await _accept(inv, user):
        raise HTTPException(status_code=404, detail="That boat isn't on My Boat Prep any more. Ask the skipper for a new invite.")
    return {"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]}


async def _accept(inv: dict, user: dict) -> bool:
    """Links the user to the invited boat as its shore contact (one user can watch several boats)."""
    contact = {"name": inv["name"] or user.get("name", ""), "email": user["email"], "joined_at": _now().isoformat()}
    res = await db.user_boats.update_one({"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]},
                                         {"$set": {f"shore.{user['user_id']}": contact}, "$addToSet": {"shore_ids": user["user_id"]}})
    await db.shore_invites.delete_one({"invite_id": inv["invite_id"]})
    if not res.matched_count:
        return False
    # Someone who isn't a skipper (no named boat) or crew anywhere is shore-only: they just get the monitoring page.
    # Existing skippers and crew keep their full app and open the map from the account menu.
    uid = user["user_id"]
    skipper = await db.user_boats.find_one({"owner_id": uid, "boat.vessel": {"$nin": ["", None]}}, {"_id": 1})
    crew = await db.user_boats.find_one({"crew": uid}, {"_id": 1})
    only = not skipper and not crew
    await db.users.update_one({"user_id": uid}, {"$set": {"shore_contact": True, "shore_only": only, **({"home": "shore"} if only else {})}})
    return True


async def claim_pending(user: dict) -> bool:
    """Accepts shore invites sent to this email, so a shore contact who just logs in (without the link) is set up too."""
    invs = await db.shore_invites.find({"email_key": email_key(user.get("email", "")), "expires_at": {"$gt": _now().isoformat()}}, {"_id": 0}).to_list(20)
    got = [await _accept(inv, user) for inv in invs]
    return any(got)


@router.put("/shore/home")
async def set_home(payload: HomeIn, user: dict = Depends(get_current_user)):
    if payload.home == "app" and user.get("shore_only"):
        raise HTTPException(status_code=403, detail="Shore contacts only have the monitoring page")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"home": payload.home}})
    return {"home": payload.home}


@router.post("/shore/own-boat")
async def own_boat(user: dict = Depends(get_current_user)):
    """A shore-only contact can start their own boat; the map still opens first when they sign in."""
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"shore_only": False, "home": "shore"}})
    return {"shore_only": False, "home": "shore"}


@router.get("/shore/boats")
async def watched_boats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    # Boats this user watches, plus a skipper's own named boats (not for shore-only users).
    q = {"shore_ids": uid} if user.get("shore_only") else {"$or": [{"shore_ids": uid}, {"owner_id": uid, "boat.vessel": {"$nin": ["", None]}}]}
    docs = await db.user_boats.find(q, {"_id": 0, "owner_id": 1, "boat_id": 1, "boat.vessel": 1, "tracking": 1, "distress.state": 1, "distress.kind": 1}).to_list(50)
    owners = {u["user_id"]: u for u in await db.users.find({"user_id": {"$in": [d["owner_id"] for d in docs]}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(50)}
    docs.sort(key=lambda d: (d["owner_id"] != uid, ((d.get("boat") or {}).get("vessel") or "").lower()))
    return {"boats": [{"owner_id": d["owner_id"], "boat_id": d["boat_id"], "vessel": (d.get("boat") or {}).get("vessel") or "Boat", "mine": d["owner_id"] == uid,
                       "skipper": (owners.get(d["owner_id"]) or {}).get("name") or (owners.get(d["owner_id"]) or {}).get("email", ""),
                       "status": status_of(d.get("tracking")), "alert": d.get("distress") if (d.get("distress") or {}).get("state") == "active" else None} for d in docs]}


@router.get("/shore/track")
async def watched_track(owner_id: Owner, boat_id: BoatQ, user: dict = Depends(get_current_user)):
    q = {"owner_id": owner_id, "boat_id": boat_id}
    if owner_id != user["user_id"] or user.get("shore_only"):
        q["shore_ids"] = user["user_id"]
    doc = await db.user_boats.find_one(q, {"_id": 0, "boat_id": 1, "boat.vessel": 1, "tracking": 1, "distress": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer a shore contact for this boat")
    t = doc.get("tracking") or {}
    pts = []
    if t.get("trip_id"):
        pts = await db.track_points.find({"trip_id": t["trip_id"]}, {"_id": 0, "lat": 1, "lon": 1, "at": 1, "kind": 1}).sort("at", 1).to_list(5000)
    return {"vessel": (doc.get("boat") or {}).get("vessel") or "Boat", "status": status_of(t), "started_at": t.get("started_at") if t.get("on") else None, "arrived_at": t.get("arrived_at"),
            "ended_at": t.get("ended_at"), "points": pts, "alert": doc.get("distress")}


# ---------- Cron: email shore contacts after two missed hourly pings ----------

def _skipper_alert_html(vessel: str, last: str | None, started: str | None, told: list) -> str:
    when = _nz(last or started) if (last or started) else "unknown"
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<h2 style="margin:0 0 12px">{escape(vessel)} missed 2 hourly check-ins: your shore contacts were told</h2>'
            f'<p>My Boat Prep hasn\'t had a position from <b>{escape(vessel)}</b> since <b>{escape(when)} (NZ time)</b>, so we emailed '
            f'{escape(", ".join(told))}.</p>'
            '<p>If all is well, open My Boat Prep on a phone aboard so positions start again, and let your shore contacts know. '
            'Tap "Arrived safely" when the trip is over.</p></div>')


def _alert_html(vessel: str, last: str | None, started: str | None) -> str:
    when = datetime.fromisoformat(last or started).astimezone(timezone(timedelta(hours=12))).strftime("%d %b %H:%M") if (last or started) else "unknown"
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<h2 style="margin:0 0 12px">{escape(vessel)} has missed 2 hourly check-ins</h2>'
            f'<p>My Boat Prep hasn\'t had a position from <b>{escape(vessel)}</b> since <b>{escape(when)} (NZ time)</b>.</p>'
            '<p>This often just means no phone signal, or the app isn\'t open on a phone aboard. '
            'Try calling the skipper. If you\'re worried about their safety, contact the Coastguard or emergency services.</p></div>')


async def check_missed():
    cut = (_now() - ALERT_AFTER).isoformat()
    docs = await db.user_boats.find({"tracking.on": True, "tracking.alerted_at": {"$exists": False}, "shore_ids.0": {"$exists": True},
                                     "$and": [{"$or": [{"tracking.last_at": {"$lt": cut}}, {"tracking.last_at": {"$exists": False}, "tracking.started_at": {"$lt": cut}}]},
                                              {"$or": [{"tracking.ashore_at": {"$exists": False}}, {"tracking.ashore_at": {"$lt": cut}}]}]},
                                    {"_id": 0, "owner_id": 1, "boat_id": 1, "boat.vessel": 1, "tracking": 1, "shore": 1}).to_list(500)
    for d in docs:
        res = await db.user_boats.update_one({"owner_id": d["owner_id"], "boat_id": d["boat_id"], "tracking.alerted_at": {"$exists": False}},
                                             {"$set": {"tracking.alerted_at": _now().isoformat()}})
        if not res.modified_count:
            continue
        vessel = (d.get("boat") or {}).get("vessel") or "The boat"
        to = [c["email"] for c in (d.get("shore") or {}).values() if c.get("email")]
        try:
            await send_email(to=to, subject=f"{vessel} has missed 2 hourly check-ins", html=_alert_html(vessel, d["tracking"].get("last_at"), d["tracking"].get("started_at")))
        except Exception as e:  # noqa: BLE001
            log.warning("Shore alert email failed for %s/%s: %s", d["owner_id"], d["boat_id"], e)
        skipper = await db.users.find_one({"user_id": d["owner_id"]}, {"_id": 0, "email": 1})
        if skipper and skipper.get("email") and to:
            told = [c.get("name") or c["email"] for c in (d.get("shore") or {}).values() if c.get("email")]
            try:
                await send_email(to=[skipper["email"]], subject=f"{vessel} missed 2 check-ins: shore contacts were told",
                                 html=_skipper_alert_html(vessel, d["tracking"].get("last_at"), d["tracking"].get("started_at"), told))
            except Exception as e:  # noqa: BLE001
                log.warning("Skipper alert email failed for %s/%s: %s", d["owner_id"], d["boat_id"], e)


@router.post("/cron/shore-check")
async def cron_shore_check(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("authorization", "")
    secret = os.environ["WEBHOOK_CRON_SECRET"]
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("x-webhook-id") or body.get("run_id") or str(uuid.uuid4())
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"ok": True}
    await db.cron_runs.insert_one({"run_id": run_id, "at": _now().isoformat()})
    asyncio.create_task(check_missed())
    from trip_summary import send_due  # noqa: PLC0415
    asyncio.create_task(send_due())
    return {"ok": True}
