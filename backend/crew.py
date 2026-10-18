import hashlib
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field
from email_validator import validate_email, EmailNotValidError
from db import db
from auth import get_current_user, require_premium
from email_service import send_email
from urls import public_base

router = APIRouter(prefix="/api")
INVITE_DAYS = 7
DAILY_INVITE_LIMIT = 20
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def owned_boat(user: dict, boat_id: str) -> dict:
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "boat": 1, "crew": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    return doc


class InviteIn(BaseModel):
    email: str = Field(max_length=254)


def invite_html(owner: str, vessel: str, link: str) -> str:
    return (
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
        f'<h2 style="margin:0 0 12px">You\'re invited aboard {escape(vessel)}</h2>'
        f'<p>{escape(owner)} has invited you to join the crew of <b>{escape(vessel)}</b> on My Boat Prep. '
        'You\'ll see the boat\'s checklists on your own phone and can tick items as you go.</p>'
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Join the crew</a></p>'
        f'<p style="font-size:13px;color:#64748b">Sign in with this email address to accept. The invite expires in {INVITE_DAYS} days.</p></div>'
    )


@router.post("/boats/{boat_id}/invites")
async def invite_crew(boat_id: BoatPath, payload: InviteIn, request: Request, user: dict = Depends(require_premium)):
    doc = await owned_boat(user, boat_id)
    try:
        email = validate_email(payload.email.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if email == user["email"].lower():
        raise HTTPException(status_code=400, detail="That's your own email address")
    crew_ids = doc.get("crew") or []
    if crew_ids and await db.users.find_one({"user_id": {"$in": crew_ids}, "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="They're already crew on this boat")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.crew_invites.count_documents({"owner_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_INVITE_LIMIT:
        raise HTTPException(status_code=429, detail="Daily invite limit reached, try again tomorrow")
    vessel = doc.get("boat", {}).get("vessel", "").strip() or "my boat"
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    invite = {"invite_id": str(uuid.uuid4()), "token_hash": _hash(token), "owner_id": user["user_id"], "boat_id": boat_id, "email": email,
              "created_at": now.isoformat(), "expires_at": (now + timedelta(days=INVITE_DAYS)).isoformat()}
    await db.crew_invites.delete_many({"owner_id": user["user_id"], "boat_id": boat_id, "email": email})
    await send_email(to=[email], subject=f"Join the crew of {vessel} on My Boat Prep",
                     html=invite_html(user.get("name") or user["email"], vessel, f"{public_base(request)}/join/{token}"))
    await db.crew_invites.insert_one(invite)
    return {"invite_id": invite["invite_id"], "email": email, "created_at": invite["created_at"]}


@router.get("/boats/{boat_id}/crew")
async def get_crew(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    members = await db.users.find({"user_id": {"$in": doc.get("crew") or []}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(100)
    now = datetime.now(timezone.utc).isoformat()
    invites = await db.crew_invites.find({"owner_id": user["user_id"], "boat_id": boat_id, "expires_at": {"$gt": now}},
                                         {"_id": 0, "invite_id": 1, "email": 1, "created_at": 1}).to_list(100)
    return {"crew": members, "invites": invites}


@router.delete("/boats/{boat_id}/crew/{member_id}")
async def remove_crew(boat_id: BoatPath, member_id: Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")], user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$pull": {"crew": member_id}})
    return {"ok": True}


@router.delete("/boats/{boat_id}/invites/{invite_id}")
async def cancel_invite(boat_id: BoatPath, invite_id: Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")], user: dict = Depends(get_current_user)):
    await db.crew_invites.delete_one({"owner_id": user["user_id"], "boat_id": boat_id, "invite_id": invite_id})
    return {"ok": True}


class JoinIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)


@router.post("/crew/join")
async def join_crew(payload: JoinIn, user: dict = Depends(get_current_user)):
    inv = await db.crew_invites.find_one({"token_hash": _hash(payload.token)}, {"_id": 0})
    if not inv or inv["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This invite has expired or was cancelled. Ask the skipper for a new one.")
    if inv["email"] != user["email"].lower():
        raise HTTPException(status_code=403, detail=f"This invite was sent to {inv['email']}. Sign in with that email to accept it.")
    key = {"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]}
    res = await db.user_boats.update_one(key, {"$addToSet": {"crew": user["user_id"]}})
    await db.crew_invites.delete_one({"token_hash": inv["token_hash"]})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="That boat no longer exists")
    key = f"c_{inv['owner_id']}_{inv['boat_id']}"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_boat": key}})
    return {"key": key}


class LeaveIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")


@router.post("/crew/leave")
async def leave_crew(payload: LeaveIn, user: dict = Depends(get_current_user)):
    await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id}, {"$pull": {"crew": user["user_id"]}})
    return {"ok": True}
