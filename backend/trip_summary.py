import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from html import escape
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Response
from staticmap import CircleMarker, Line, StaticMap

from db import db
from email_service import send_email
from shore import _nz

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
DELAY = timedelta(minutes=3)
MapKey = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{20,60}$")]


def _render(path: list) -> bytes:
    m = StaticMap(640, 400, padding_x=30, padding_y=30, url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  headers={"User-Agent": "MyBoatPrep/1.0 trip summary"})
    pts = [(p["lon"], p["lat"]) for p in path]
    if len(pts) > 1:
        m.add_line(Line(pts, "#0f2a4a", 4))
    m.add_marker(CircleMarker(pts[0], "white", 12))
    m.add_marker(CircleMarker(pts[0], "#0f2a4a", 6))
    m.add_marker(CircleMarker(pts[-1], "#f97316", 12))
    buf = BytesIO()
    m.render().convert("RGB").save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


@router.get("/trip-map/{key}.jpg")
async def trip_map(key: MapKey):
    doc = await db.trip_maps.find_one({"key": key}, {"_id": 0, "png": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    return Response(content=bytes(doc["png"]), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000"})


def _day(v: str) -> str:
    try:
        return datetime.fromisoformat(v).strftime("%a %d %b %Y %H:%M")
    except (TypeError, ValueError):
        return ""


def _html(a: dict, skipper: str, map_url: str) -> str:
    s, d = a.get("stats") or {}, a.get("details") or {}
    route = " → ".join(x for x in (d.get("route_start"), d.get("route_dest")) if x)
    rows = [("Route", route), ("Departure", _day(a.get("depart_at", ""))), ("Estimated finish", _day(a.get("finish_at", ""))),
            ("Distance tracked", f'{s.get("distance_nm", 0)} nm' if s.get("points") else "No GPS path shared"),
            ("Tracked", f'{_nz(s["tracked_from"])} to {_nz(s["tracked_to"])} (NZ time)' if s.get("tracked_from") else ""),
            ("Checklist", f'{s.get("ticked", 0)} of {s.get("total", 0)} ticked'),
            ("Crew", ", ".join(c.get("name", "") for c in a.get("crew") or []) or "None")]
    table = "".join(f'<tr><td style="padding:4px 12px 4px 0;color:#475569">{k}</td><td style="padding:4px 0"><b>{escape(v)}</b></td></tr>' for k, v in rows if v)
    img = f'<p><img src="{escape(map_url)}" width="560" alt="Map of the route" style="max-width:100%;border:2px solid #0f2a4a;border-radius:8px"/></p>' if map_url else ""
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:600px">'
            f'<h2 style="margin:0 0 8px">{escape(a["name"])}: trip wrap-up</h2>'
            f'<p style="margin:0 0 12px">{escape(skipper)} has finished and archived this trip on My Boat Prep.</p>{img}'
            f'<table style="font-size:14px;border-collapse:collapse">{table}</table>'
            '<p style="font-size:12px;color:#64748b;margin-top:16px">Sent by My Boat Prep.</p></div>')


async def send_summary(archive_id: str):
    """Sends once, and only if the archive is still there (Undo or Restore deletes it)."""
    now = datetime.now(timezone.utc)
    free = [{"summary.claimed_at": {"$exists": False}}, {"summary.claimed_at": {"$lt": (now - timedelta(minutes=10)).isoformat()}}]
    a = await db.trip_archives.find_one_and_update({"archive_id": archive_id, "summary.sent_at": {"$exists": False}, "$or": free},
                                                   {"$set": {"summary.claimed_at": now.isoformat()}}, projection={"_id": 0})
    if not a:
        return
    owner = await db.users.find_one({"user_id": a["owner_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
    boat = await db.user_boats.find_one({"owner_id": a["owner_id"], "boat_id": a["boat_id"]}, {"_id": 0, "shore": 1, "boat.vessel": 1}) or {}
    to = [owner.get("email", "")]
    if (a.get("summary") or {}).get("shore"):
        to += [c.get("email", "") for c in (boat.get("shore") or {}).values()]
    if (a.get("summary") or {}).get("crew"):
        to += [u.get("email", "") for u in await db.users.find({"user_id": {"$in": [c["user_id"] for c in a.get("crew") or []]}}, {"_id": 0, "email": 1}).to_list(200)]
    to = list(dict.fromkeys(e.strip().lower() for e in to if e and "@" in e))
    url = ""
    if a.get("path"):
        try:
            png = await asyncio.to_thread(_render, a["path"])
            key = secrets.token_urlsafe(24)
            await db.trip_maps.insert_one({"key": key, "png": png, "archive_id": archive_id, "at": datetime.now(timezone.utc)})
            url = f'{a["summary"]["base"]}/api/trip-map/{key}.jpg'
        except Exception as e:  # noqa: BLE001  the email still goes, just without the picture
            log.warning("Trip map render failed for %s: %s", archive_id, e)
    vessel = (boat.get("boat") or {}).get("vessel") or "the boat"
    try:
        await send_email(to=to, subject=f"{vessel}: {a['name']} trip wrap-up", html=_html(a, owner.get("name") or owner.get("email") or "The skipper", url))
        await db.trip_archives.update_one({"archive_id": archive_id}, {"$set": {"summary.sent_at": datetime.now(timezone.utc).isoformat(), "summary.to": len(to)}})
    except Exception as e:  # noqa: BLE001  try again on the next check
        log.warning("Trip summary email failed for %s: %s", archive_id, e)
        await db.trip_archives.update_one({"archive_id": archive_id}, {"$unset": {"summary.claimed_at": ""}})


async def _later(archive_id: str):
    await asyncio.sleep(DELAY.total_seconds())
    await send_summary(archive_id)


_tasks: set = set()


def schedule(archive_id: str):
    t = asyncio.create_task(_later(archive_id))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


async def send_due():
    """Backup for summaries whose timer was lost to a restart."""
    cut = (datetime.now(timezone.utc) - DELAY - timedelta(minutes=2)).isoformat()
    for a in await db.trip_archives.find({"summary.due_at": {"$lt": cut}, "summary.sent_at": {"$exists": False}}, {"_id": 0, "archive_id": 1}).to_list(50):
        await send_summary(a["archive_id"])
