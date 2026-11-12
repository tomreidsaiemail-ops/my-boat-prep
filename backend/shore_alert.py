import logging
import math
from datetime import datetime, timezone
from html import escape
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from email_service import send_email
from shore import _map_link, _nz
from urls import public_base

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
NEAR_M = 100
NAMES = {"mayDay": "MAYDAY", "panPan": "PAN-PAN"}
Owner = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{0,80}$")]
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
FIELDS = {"_id": 0, "owner_id": 1, "boat_id": 1, "boat.vessel": 1, "boat.shore_email": 1, "shore": 1, "shore_ids": 1, "tracking": 1, "distress": 1, "crew_names": 1}


class Where(BaseModel):
    owner_id: str = Field(default="", pattern=r"^[A-Za-z0-9_-]{0,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    alert_id: str = Field(pattern=r"^[A-Za-z0-9-]{8,60}$")


class AlertIn(Where):
    kind: Literal["mayDay", "panPan"]
    at: int = Field(gt=1_600_000_000_000, lt=4_000_000_000_000)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    acc: float | None = Field(default=None, ge=0, le=100000)
    fix_at: int | None = Field(default=None, gt=1_600_000_000_000, lt=4_000_000_000_000)


def _iso(ms: int) -> str:
    return datetime.fromtimestamp(min(ms / 1000, datetime.now(timezone.utc).timestamp()), timezone.utc).isoformat()


def _metres(a: dict, b: dict) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


async def _aboard(user: dict, owner_id: str, boat_id: str) -> dict:
    """Skipper or any crew aboard can raise and stand down a shore alert."""
    owner = owner_id or user["user_id"]
    q = {"owner_id": owner, "boat_id": boat_id, **({} if owner == user["user_id"] else {"crew": user["user_id"]})}
    doc = await db.user_boats.find_one(q, FIELDS)
    if not doc:
        raise HTTPException(status_code=404, detail="You're not aboard this boat any more")
    return doc


def _who(doc: dict, user: dict) -> str:
    return ((doc.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user.get("email") or "Someone aboard").strip()[:80]


def _emails(doc: dict) -> list:
    return list(dict.fromkeys(c["email"].strip().lower() for c in (doc.get("shore") or {}).values() if c.get("email")))


def _where_html(a: dict) -> str:
    pos, last = a.get("pos"), a.get("last")
    out = f'<p>Position when pressed: <a href="{_map_link(pos)}">{pos["lat"]:.5f}, {pos["lon"]:.5f}</a></p>' if pos else "<p>Position when pressed: unknown (no GPS fix)</p>"
    if last and not a.get("near"):
        out += f'<p>Last reported position: <a href="{_map_link(last)}">{last["lat"]:.5f}, {last["lon"]:.5f}</a> at {escape(_nz(last["at"]))} (NZ time)</p>'
    return out


def _alert_html(vessel: str, a: dict, link: str) -> str:
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<div style="background:#c62828;color:#fff;padding:14px 16px;border-radius:6px;font-size:18px;font-weight:bold">{NAMES[a["kind"]]} pressed on {escape(vessel)}</div>'
            f'<p>{escape(a["by_name"])} pressed {NAMES[a["kind"]]} in My Boat Prep at <b>{escape(_nz(a["at"]))} (NZ time)</b>.</p>{_where_html(a)}'
            f'<p><a href="{escape(link)}">Open the shore contact map</a>. If you can\'t reach the boat and are worried, contact the Coastguard or emergency services.</p></div>')


def _stand_html(vessel: str, a: dict) -> str:
    return (f'<div style="font-family:Arial,sans-serif;color:#0f2a4a;max-width:560px">'
            f'<div style="background:#047857;color:#fff;padding:14px 16px;border-radius:6px;font-size:18px;font-weight:bold">STAND DOWN: no {NAMES[a["kind"]]} on {escape(vessel)}</div>'
            f'<p>{escape(a["cleared_by_name"])} stood down the {NAMES[a["kind"]]} shore alert at <b>{escape(_nz(a["cleared_at"]))} (NZ time)</b>. '
            'There is no Mayday or Pan-Pan. No action is needed.</p></div>')


async def _mail(to: list, subject: str, html: str) -> bool:
    if not to:
        return False
    try:
        return bool(await send_email(to=to, subject=subject, html=html))
    except Exception as e:  # noqa: BLE001
        log.warning("Shore alert email failed: %s", e)
        return False


def _out(doc: dict, a: dict | None) -> dict:
    return {"alert": a, "contacts": len(doc.get("shore_ids") or [])}


@router.get("/shore/alert")
async def get_alert(boat_id: BoatQ, owner_id: Owner = "", user: dict = Depends(get_current_user)):
    doc = await _aboard(user, owner_id, boat_id)
    return _out(doc, doc.get("distress"))


@router.post("/shore/alert")
async def raise_alert(p: AlertIn, request: Request, user: dict = Depends(get_current_user)):
    doc = await _aboard(user, p.owner_id, p.boat_id)
    cur = doc.get("distress") or {}
    if not doc.get("shore_ids"):
        return _out(doc, None)
    if cur.get("alert_id") == p.alert_id or (cur.get("state") == "active" and cur.get("kind") == p.kind):
        return _out(doc, cur)
    t = doc.get("tracking") or {}
    pos = {"lat": round(p.lat, 6), "lon": round(p.lon, 6), "acc": p.acc, "at": _iso(p.fix_at or p.at)} if p.lat is not None and p.lon is not None else None
    last = {**t["last"], "at": t["last_at"]} if t.get("last") and t.get("last_at") else None
    dist = round(_metres(pos, last)) if pos and last else None
    a = {"alert_id": p.alert_id, "kind": p.kind, "state": "active", "at": _iso(p.at), "received_at": datetime.now(timezone.utc).isoformat(),
         "by": user["user_id"], "by_name": _who(doc, user), "pos": pos, "last": last, "dist_m": dist, "near": dist is not None and dist <= NEAR_M,
         **({"upgraded_from": cur["kind"]} if cur.get("state") == "active" else {})}
    await db.user_boats.update_one({"owner_id": doc["owner_id"], "boat_id": p.boat_id}, {"$set": {"distress": a}, "$push": {"distress_log": {"$each": [a], "$slice": -50}}})
    vessel = (doc.get("boat") or {}).get("vessel") or "the boat"
    a["emailed"] = await _mail(_emails(doc), f"{NAMES[p.kind]} pressed on {vessel}: shore contact alert", _alert_html(vessel, a, f"{public_base(request)}/shore"))
    return _out(doc, a)


@router.post("/shore/alert/stand-down")
async def stand_down(p: Where, user: dict = Depends(get_current_user)):
    doc = await _aboard(user, p.owner_id, p.boat_id)
    cur = doc.get("distress") or {}
    if cur.get("alert_id") != p.alert_id:
        if cur.get("state") == "cleared" or not cur:
            return _out(doc, cur or None)
        raise HTTPException(status_code=409, detail="A newer alert was raised since. Stand that one down instead.")
    if cur.get("state") == "cleared":
        return _out(doc, cur)
    a = {**cur, "state": "cleared", "cleared_at": datetime.now(timezone.utc).isoformat(), "cleared_by": user["user_id"], "cleared_by_name": _who(doc, user)}
    res = await db.user_boats.update_one({"owner_id": doc["owner_id"], "boat_id": p.boat_id, "distress.alert_id": p.alert_id, "distress.state": "active"}, {"$set": {"distress": a}})
    if not res.modified_count:
        return _out(doc, (await db.user_boats.find_one({"owner_id": doc["owner_id"], "boat_id": p.boat_id}, {"_id": 0, "distress": 1}) or {}).get("distress"))
    vessel = (doc.get("boat") or {}).get("vessel") or "the boat"
    extra = ((doc.get("boat") or {}).get("shore_email") or "").strip().lower()
    to = list(dict.fromkeys(_emails(doc) + ([extra] if "@" in extra else [])))
    a["emailed"] = await _mail(to, f"STAND DOWN: no {NAMES[a['kind']]} on {vessel}", _stand_html(vessel, a))
    return _out(doc, a)
