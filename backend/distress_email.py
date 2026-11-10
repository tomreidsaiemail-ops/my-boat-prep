import html
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from email_validator import validate_email, EmailNotValidError
from db import db
from auth import get_current_user
from email_service import send_email

router = APIRouter(prefix="/api")
DAILY_DISTRESS_LIMIT = 30
NAMES = {"mayDay": "MAYDAY", "panPan": "PAN-PAN"}
Line = Annotated[str, Field(max_length=600)]


class DistressEmailIn(BaseModel):
    kind: Literal["mayDay", "panPan"]
    to: str = Field(min_length=3, max_length=254)
    vessel: str = Field(default="", max_length=80)
    callsign: str = Field(default="", max_length=40)
    position: str = Field(default="", max_length=120)
    lines: List[Line] = Field(default_factory=list, max_length=120)


def distress_subject(p: DistressEmailIn) -> str:
    v = p.vessel.strip().upper() or "UNKNOWN"
    c = p.callsign.strip().upper() or "UNKNOWN"
    return f"{NAMES[p.kind]} VESSEL NAME {v}, CALLSIGN: {c}, POSITION {p.position.strip() or 'UNKNOWN'}"


def distress_html(p: DistressEmailIn, subject: str, sent_at: str) -> str:
    colour = "#c62828" if p.kind == "mayDay" else "#e67e22"
    body = "".join(f'<p style="margin:0 0 8px;font-size:16px;line-height:1.45">{html.escape(t)}</p>' for t in p.lines if t.strip())
    return (
        f'<div style="font-family:Arial,sans-serif;color:#0b1f33;max-width:640px">'
        f'<div style="background:{colour};color:#fff;padding:14px 16px;border-radius:6px;font-size:18px;font-weight:bold">{html.escape(subject)}</div>'
        f'<div style="padding:16px 4px">{body}</div>'
        f'<p style="font-size:12px;color:#5b6b7b">Sent from My Boat Prep at {html.escape(sent_at)} UTC.</p></div>'
    )


@router.post("/distress-email")
async def send_distress_email(p: DistressEmailIn, user: dict = Depends(get_current_user)):
    try:
        to = validate_email(p.to.strip(), check_deliverability=False).normalized
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.distress_emails.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_DISTRESS_LIMIT:
        raise HTTPException(status_code=429, detail="Daily distress email limit reached")
    now = datetime.now(timezone.utc)
    subject = distress_subject(p)
    email_id = await send_email(to=[to], subject=subject, html=distress_html(p, subject, now.strftime("%Y-%m-%d %H:%M")))
    await db.distress_emails.insert_one({"id": str(uuid.uuid4()), "user_id": user["user_id"], "kind": p.kind,
                                         "to": to, "subject": subject, "email_id": email_id, "created_at": now.isoformat()})
    return {"ok": True, "subject": subject}
