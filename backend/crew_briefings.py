from datetime import datetime, timedelta, timezone
from html import escape
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user
from crew import BoatPath, owned_boat, public_base, role_briefings, shore_brief_html
from email_service import send_email

router = APIRouter(prefix="/api")
DAILY_BRIEFING_LIMIT = 40


class BriefingIn(BaseModel):
    member_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,80}$")


def briefing_html(skipper: str, vessel: str, name: str, briefs: List[tuple], notes: str, link: str, shore: bool = False) -> str:
    rows = "".join(f'<p style="margin:0 0 12px"><b>{escape(r)}</b><br/>{escape(b).replace(chr(10), "<br/>")}</p>' for r, b in briefs)
    plan = f'<p style="margin:16px 0 0"><b>Voyage or race notes:</b><br/>{escape(notes).replace(chr(10), "<br/>")}</p>' if notes else ""
    return (
        '<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px">'
        f'<h2 style="margin:0 0 12px">Hi {escape(name)}, your role briefing for {escape(vessel)}</h2>'
        f'<p style="margin:0 0 16px">{escape(skipper)} has sent you your role briefing again before the next voyage.</p>{rows}{shore_brief_html(shore)}{plan}'
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open My Boat Prep</a></p>'
        '<p style="font-size:12px;color:#888888">We never ask for your password or card details by email.</p></div>'
    )


@router.post("/boats/{boat_id}/briefings")
async def resend_briefings(boat_id: BoatPath, payload: BriefingIn, request: Request, user: dict = Depends(get_current_user)):
    """Emails each crew member (or just one) the briefing for their roles, ahead of a voyage."""
    doc = await owned_boat(user, boat_id)
    ids = doc.get("crew") or []
    if payload.member_id:
        if payload.member_id not in ids:
            raise HTTPException(status_code=404, detail="That person isn't on your crew")
        ids = [payload.member_id]
    since = datetime.now(timezone.utc) - timedelta(days=1)
    if await db.briefing_sends.count_documents({"owner_id": user["user_id"], "at": {"$gte": since}}) + len(ids) > DAILY_BRIEFING_LIMIT:
        raise HTTPException(status_code=429, detail=f"You can send up to {DAILY_BRIEFING_LIMIT} briefings a day. Try again tomorrow.")
    briefs = await role_briefings(user["user_id"], boat_id)
    names, roles = doc.get("crew_names") or {}, doc.get("crew_roles") or {}
    vessel = (doc.get("boat") or {}).get("vessel") or "the boat"
    skipper = user.get("name") or user["email"]
    members = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(100)
    sent, skipped = [], []
    for m in members:
        name = names.get(m["user_id"]) or m.get("name") or m["email"]
        mine = [(r, briefs[r.lower()]) for r in roles.get(m["user_id"]) or [] if briefs.get(r.lower())]
        if not mine and not doc.get("shore"):
            skipped.append(name)
            continue
        await send_email(to=[m["email"]], subject=f"Your role briefing for {vessel}",
                         html=briefing_html(skipper, vessel, name, mine, doc.get("voyage_notes", ""), f"{public_base(request)}/", bool(doc.get("shore"))))
        await db.briefing_sends.insert_one({"owner_id": user["user_id"], "member_id": m["user_id"], "at": datetime.now(timezone.utc)})
        sent.append(name)
    return {"sent": sent, "skipped": skipped}
