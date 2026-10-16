import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
import logging
import bcrypt
from fastapi import APIRouter, HTTPException, Request, Response
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import UserOut, create_session, to_user_out
from email_service import send_email, EMAIL_FROM_NAME
from urls import public_base

router = APIRouter(prefix="/api/auth")

MAX_FAILS = 5
LOCK_MINUTES = 15
RESET_HOURS = 1
RESETS_PER_HOUR = 3
LOGIN_ERROR = "Incorrect email or password"
DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()
logger = logging.getLogger(__name__)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _ident(email: str) -> str:
    # Keyed by account, not IP: client-supplied forwarding headers can't reset the counter.
    return f"email:{email}"


@router.post("/register", response_model=UserOut)
async def register(payload: RegisterIn, response: Response):
    email = payload.email.strip().lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "password_hash": 1})
    if existing:
        detail = ("An account with this email already exists. Sign in instead." if existing.get("password_hash")
                  else "This email already signs in with Google. Use Google, or 'Forgot password' to add a password.")
        raise HTTPException(status_code=400, detail=detail)
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": payload.name.strip() or email.split("@")[0],
            "picture": "", "role": "free", "password_hash": hash_password(payload.password), "email_verified": False,
            "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        await db.users.insert_one(dict(user))
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Sign in instead.")
    await create_session(response, user["user_id"])
    return to_user_out(user)


@router.post("/login", response_model=UserOut)
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.strip().lower()
    ident = _ident(email)
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if attempt and attempt.get("locked_until") and attempt["locked_until"].replace(tzinfo=timezone.utc) > now:
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {LOCK_MINUTES} minutes or reset your password.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    ok = verify_password(payload.password, (user or {}).get("password_hash") or DUMMY_HASH)
    if not user or not user.get("password_hash") or not ok:
        count = (attempt or {}).get("count", 0) + 1
        lock = now + timedelta(minutes=LOCK_MINUTES) if count >= MAX_FAILS else None
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": 0 if lock else count, "locked_until": lock, "updated_at": now}}, upsert=True)
        raise HTTPException(status_code=401, detail=LOGIN_ERROR)
    await db.login_attempts.delete_one({"identifier": ident})
    await create_session(response, user["user_id"])
    return to_user_out(user)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotIn, request: Request):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "name": 1})
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    if user and await db.password_reset_tokens.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) < RESETS_PER_HOUR:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({"token_hash": _sha(token), "user_id": user["user_id"], "used": False,
                                                   "created_at": now, "expires_at": now + timedelta(hours=RESET_HOURS)})
        link = f"{public_base(request)}/reset-password?token={token}"
        html = (
            '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">'
            f'<h1 style="font-size:20px">Set your My Boat Prep password</h1><p>Hi {escape(user.get("name") or "skipper")},</p>'
            '<p>Tap the button below to choose a new password. The link works once and expires in 1 hour.</p>'
            f'<p><a href="{link}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>'
            "<p style=\"font-size:13px;color:#475569\">If you didn't ask for this, ignore this email and your password stays the same.</p>"
            f'<p style="font-size:12px;color:#64748b">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p></div>'
        )
        try:
            await send_email(to=[email], subject="Reset your My Boat Prep password", html=html)
        except HTTPException:
            logger.error("Password reset email failed to send")
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(payload: ResetIn):
    now = datetime.now(timezone.utc)
    rec = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": _sha(payload.token), "used": False, "expires_at": {"$gt": now}},
        {"$set": {"used": True}}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not rec:
        raise HTTPException(status_code=400, detail="This reset link has expired or was already used. Ask for a new one.")
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password), "email_verified": True}})
    await db.user_sessions.delete_many({"user_id": rec["user_id"]})
    user = await db.users.find_one({"user_id": rec["user_id"]}, {"_id": 0, "email": 1})
    if user:
        await db.login_attempts.delete_one({"identifier": _ident(user["email"])})
    return {"ok": True}
