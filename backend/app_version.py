import time
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import db

router = APIRouter(prefix="/api")
KEY = "relogin"
# Old sessions keep working this long after the sign-out time, so phones can save their changes first.
GRACE = timedelta(minutes=10)
CACHE_SECONDS = 10
_cache = {"at": -1e9, "doc": {}}


def _aware(v) -> Optional[datetime]:
    if isinstance(v, str):
        try:
            v = datetime.fromisoformat(v)
        except ValueError:
            return None
    if not isinstance(v, datetime):
        return None
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


async def relogin_doc(fresh: bool = False) -> dict:
    if fresh or time.monotonic() - _cache["at"] > CACHE_SECONDS:
        _cache["doc"] = await db.app_settings.find_one({"key": KEY}, {"_id": 0, "key": 0}) or {}
        _cache["at"] = time.monotonic()
    return _cache["doc"]


def session_state(session: dict, doc: dict, now: datetime) -> str:
    """ok, stale (signed in before the update; still accepted during the grace) or rejected."""
    at = _aware(doc.get("at"))
    if not at or now < at:
        return "ok"
    created = _aware(session.get("created_at"))
    if created and created >= at:
        return "ok"
    return "rejected" if now >= at + GRACE else "stale"


def _token(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    return request.cookies.get("session_token") or (auth[7:] if auth.lower().startswith("bearer ") else None)


def _out(doc: dict) -> dict:
    at = _aware(doc.get("at"))
    return {"relogin_at": at.isoformat() if at else None, "note": doc.get("note", "")}


@router.get("/app/status")
async def app_status(request: Request):
    now = datetime.now(timezone.utc)
    doc = await relogin_doc()
    token = _token(request)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0, "created_at": 1}) if token else None
    return {**_out(doc), "server_time": now.isoformat(), "session": session_state(session, doc, now) if session else "none"}


class ReloginIn(BaseModel):
    at: Optional[datetime] = None
    note: str = Field(default="", max_length=200)


def _admin():
    from auth import require_admin
    return require_admin


@router.get("/admin/relogin")
async def get_relogin(_: dict = Depends(_admin())):
    doc = await relogin_doc(fresh=True)
    return {**_out(doc), "set_by": doc.get("set_by", "")}


@router.put("/admin/relogin")
async def set_relogin(payload: ReloginIn, admin: dict = Depends(_admin())):
    now = datetime.now(timezone.utc)
    at = _aware(payload.at) or now
    if at < now - timedelta(minutes=1):
        raise HTTPException(status_code=400, detail="Pick a time from now on")
    if at > now + timedelta(days=30):
        raise HTTPException(status_code=400, detail="Pick a time within the next 30 days")
    doc = {"at": at, "note": payload.note.strip(), "set_by": admin["email"], "set_at": now}
    await db.app_settings.update_one({"key": KEY}, {"$set": doc}, upsert=True)
    return {**_out(await relogin_doc(fresh=True)), "set_by": admin["email"]}


@router.delete("/admin/relogin")
async def cancel_relogin(_: dict = Depends(_admin())):
    await db.app_settings.delete_one({"key": KEY})
    await relogin_doc(fresh=True)
    return {"relogin_at": None, "note": "", "set_by": ""}
