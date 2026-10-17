import uuid
from datetime import datetime, timezone, timedelta
from html import escape
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from db import db
from auth import get_current_user, to_user_out, ADMIN_EMAIL
from email_service import send_email

router = APIRouter(prefix="/api")
DAILY_FEEDBACK_LIMIT = 5
TIERS = {"free": "Free", "beta_tester": "Beta", "pro": "Pro"}


class FeedbackIn(BaseModel):
    title: str = Field(max_length=120)
    message: str = Field(max_length=4000)

    @field_validator("title", "message")
    @classmethod
    def not_blank(cls, v: str, info) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Please enter a title" if info.field_name == "title" else "Please enter your feedback")
        return v


def feedback_html(fb: dict) -> str:
    body = escape(fb["message"]).replace("\n", "<br>")
    return (
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
        f'<h2 style="margin:0 0 12px">{escape(fb["title"])}</h2>'
        f'<p style="margin:0 0 16px">{body}</p>'
        '<hr style="border:none;border-top:1px solid #e2e8f0">'
        f'<p style="font-size:13px;color:#64748b">From: {escape(fb["name"] or "Skipper")} ({escape(fb["email"])}), {fb["tier"]} plan<br>'
        f'Sent: {fb["created_at"][:16].replace("T", " ")} UTC</p></div>'
    )


@router.post("/feedback")
async def submit_feedback(payload: FeedbackIn, user: dict = Depends(get_current_user)):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.feedback.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_FEEDBACK_LIMIT:
        raise HTTPException(status_code=429, detail="Thanks! You've sent a lot of feedback today, please try again tomorrow")
    out = to_user_out(user)
    fb = {
        "feedback_id": str(uuid.uuid4()), "user_id": user["user_id"], "email": out.email, "name": out.name,
        "tier": "Admin" if out.is_admin else TIERS.get(out.role, out.role), "title": payload.title, "message": payload.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        email_id = await send_email(to=[ADMIN_EMAIL], subject=f"Feedback: {payload.title}", html=feedback_html(fb))
    except ValueError:
        raise HTTPException(status_code=400, detail="Your feedback couldn't be sent as written. Please remove any links and try again.")
    await db.feedback.insert_one({**fb, "email_id": email_id})
    return {"ok": True}
