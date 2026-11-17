import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
import logging
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr, Field
from db import db
from auth import ADMIN_EMAIL, create_session, provider_of, get_current_user, signed_in_user
from twofa import CODE_TRIES, CODES_PER_HOUR, RESEND_SECONDS, code_hash, expiry, is_special, new_code
from email_service import send_email, EMAIL_FROM_NAME
from urls import public_base

router = APIRouter(prefix="/api/auth")

MAX_FAILS = 5
LOCK_MINUTES = 15
RESET_HOURS = 1
RESETS_PER_HOUR = 3
LOGIN_ERROR = "Incorrect email or password"
GOOGLE_MANAGED = "Password management for this account is handled by Google. Sign in with Google instead."
DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()
logger = logging.getLogger(__name__)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CodeIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\s*\d{6}\s*$")


class CurrentIn(BaseModel):
    current: str = Field(min_length=1, max_length=128)


class ChangeIn(CurrentIn):
    password: str = Field(min_length=8, max_length=128)


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


async def _failed(ident: str, attempt: dict | None, now: datetime) -> None:
    count = (attempt or {}).get("count", 0) + 1
    lock = now + timedelta(minutes=LOCK_MINUTES) if count >= MAX_FAILS else None
    await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": 0 if lock else count, "locked_until": lock, "updated_at": now}}, upsert=True)


async def _locked(ident: str, now: datetime) -> dict | None:
    attempt = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if attempt and attempt.get("locked_until") and attempt["locked_until"].replace(tzinfo=timezone.utc) > now:
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {LOCK_MINUTES} minutes or reset your password.")
    return attempt


async def _own_password(user_id: str, current: str) -> dict:
    """Email accounts only; wrong current passwords count towards the same lock as sign-in."""
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "password_hash": 1, "auth_provider": 1})
    if provider_of(doc) == "google":
        raise HTTPException(status_code=403, detail=GOOGLE_MANAGED)
    ident, now = _ident(doc["email"]), datetime.now(timezone.utc)
    attempt = await _locked(ident, now)
    if not verify_password(current, doc.get("password_hash") or DUMMY_HASH):
        await _failed(ident, attempt, now)
        raise HTTPException(status_code=400, detail="Your current password isn't right")
    await db.login_attempts.delete_one({"identifier": ident})
    return doc


async def send_code(email: str) -> None:
    """2FA: a 6-digit code to prove the email, at most one a minute and five an hour."""
    now = datetime.now(timezone.utc)
    last = await db.email_codes.find_one({"email": email}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)])
    if last and last["created_at"].replace(tzinfo=timezone.utc) > now - timedelta(seconds=RESEND_SECONDS):
        return
    if await db.email_codes.count_documents({"email": email, "created_at": {"$gte": now - timedelta(hours=1)}}) >= CODES_PER_HOUR:
        return
    code = new_code()
    await db.email_codes.update_many({"email": email, "used": False}, {"$set": {"used": True}})
    await db.email_codes.insert_one({"email": email, "code_hash": code_hash(email, code), "tries": 0, "used": False, "created_at": now, "expires_at": expiry(now)})
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">'
        '<h1 style="font-size:20px">Your My Boat Prep code</h1><p>Hi skipper,</p>'
        '<p>Type this code into My Boat Prep to confirm your email. It works once and expires in 15 minutes.</p>'
        f'<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{code}</p>'
        "<p style=\"font-size:13px;color:#475569\">If you didn't create an account, ignore this email.</p>"
        f'<p style="font-size:12px;color:#64748b">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p></div>'
    )
    try:
        await send_email(to=[email], subject=f"{code} is your My Boat Prep code", html=html)
    except (HTTPException, ValueError):
        logger.error("Email code failed to send")


async def password_alert(email: str, base: str, was_set: bool) -> None:
    """Tell the skipper their password changed, so they spot it if it wasn't them."""
    what = "set" if was_set else "changed"
    when = datetime.now(timezone.utc).strftime("%d %B %Y at %H:%M UTC").lstrip("0")
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">'
        f'<h1 style="font-size:20px">Your My Boat Prep password was {what}</h1><p>Hi skipper,</p>'
        f'<p>The password for <b>{escape(email)}</b> was {what} on <b>{when}</b>.</p>'
        '<p>If this was you, there is nothing else to do.</p>'
        '<p style="background:#fef3c7;padding:12px;border-radius:8px"><b>Wasn\'t you?</b> Reset your password straight away, '
        f'then <a href="mailto:{ADMIN_EMAIL}">contact us</a> so we can check your account.</p>'
        f'<p><a href="{base}/forgot-password" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset my password</a></p>'
        f'<p style="font-size:12px;color:#64748b">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p></div>'
    )
    try:
        await send_email(to=[email], subject=f"Your My Boat Prep password was {what}", html=html)
    except (HTTPException, ValueError):
        logger.error("Password alert email failed to send")


async def needs_code(user: dict) -> bool:
    if user.get("email_verified"):
        return False
    if await is_special(user["email"]):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"email_verified": True}})
        return False
    return True


@router.post("/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.strip().lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "password_hash": 1})
    if existing:
        detail = ("An account with this email already exists. Sign in instead." if existing.get("password_hash")
                  else "This email signs in with Google. Use Continue with Google instead.")
        raise HTTPException(status_code=400, detail=detail)
    user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": payload.name.strip() or email.split("@")[0],
            "picture": "", "role": "free", "password_hash": hash_password(payload.password), "email_verified": False, "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        await db.users.insert_one(dict(user))
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Sign in instead.")
    if await needs_code(user):
        await send_code(email)
        return {"verify": True, "email": email}
    await create_session(response, user["user_id"])
    return await signed_in_user(user["user_id"])


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.strip().lower()
    ident = _ident(email)
    now = datetime.now(timezone.utc)
    attempt = await _locked(ident, now)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    ok = verify_password(payload.password, (user or {}).get("password_hash") or DUMMY_HASH)
    if not user or not user.get("password_hash") or not ok:
        await _failed(ident, attempt, now)
        raise HTTPException(status_code=401, detail=LOGIN_ERROR)
    await db.login_attempts.delete_one({"identifier": ident})
    if await needs_code(user):
        await send_code(email)
        return {"verify": True, "email": email}
    await create_session(response, user["user_id"])
    return await signed_in_user(user["user_id"])


@router.post("/verify-email")
async def verify_email(payload: CodeIn, response: Response):
    email = payload.email.strip().lower()
    now = datetime.now(timezone.utc)
    rec = await db.email_codes.find_one({"email": email, "used": False, "expires_at": {"$gt": now}}, {"_id": 1, "code_hash": 1, "tries": 1}, sort=[("created_at", -1)])
    if not rec or rec["tries"] >= CODE_TRIES:
        raise HTTPException(status_code=400, detail="That code has expired. Tap Send a new code.")
    if not secrets.compare_digest(rec["code_hash"], code_hash(email, payload.code.strip())):
        await db.email_codes.update_one({"_id": rec["_id"]}, {"$inc": {"tries": 1}})
        raise HTTPException(status_code=400, detail="That code isn't right. Check the email and try again.")
    await db.email_codes.update_many({"email": email}, {"$set": {"used": True}})
    user = await db.users.find_one_and_update({"email": email}, {"$set": {"email_verified": True}}, projection={"_id": 0, "user_id": 1})
    if not user:
        raise HTTPException(status_code=400, detail="That code has expired. Tap Send a new code.")
    await create_session(response, user["user_id"])
    return await signed_in_user(user["user_id"])


@router.post("/resend-code")
async def resend_code(payload: ForgotIn):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "email": 1, "email_verified": 1, "password_hash": 1})
    if user and user.get("password_hash") and await needs_code(user):
        await send_code(email)
    return {"ok": True}


@router.post("/check-password")
async def check_password(payload: CurrentIn, user: dict = Depends(get_current_user)):
    await _own_password(user["user_id"], payload.current)
    return {"ok": True}


@router.post("/change-password")
async def change_password(payload: ChangeIn, request: Request, user: dict = Depends(get_current_user)):
    doc = await _own_password(user["user_id"], payload.current)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    token = request.cookies.get("session_token") or request.headers.get("authorization", "")[7:]
    await db.user_sessions.delete_many({"user_id": user["user_id"], "session_token": {"$ne": token}})
    await password_alert(doc["email"], public_base(request), False)
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotIn, request: Request):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1, "password_hash": 1, "auth_provider": 1})
    if user and provider_of(user) == "google":
        raise HTTPException(status_code=400, detail=GOOGLE_MANAGED)
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    if user and await db.password_reset_tokens.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) < RESETS_PER_HOUR:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({"token_hash": _sha(token), "user_id": user["user_id"], "used": False,
                                                   "created_at": now, "expires_at": now + timedelta(hours=RESET_HOURS)})
        link = f"{public_base(request)}/reset-password?token={token}"
        html = (
            '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">'
            f'<h1 style="font-size:20px">Set your My Boat Prep password</h1><p>Hi skipper,</p>'
            '<p>Tap the button below to choose a new password. The link works once and expires in 1 hour.</p>'
            f'<p><a href="{link}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>'
            "<p style=\"font-size:13px;color:#475569\">If you didn't ask for this, ignore this email and your password stays the same.</p>"
            f'<p style="font-size:12px;color:#64748b">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p></div>'
        )
        try:
            await send_email(to=[email], subject="Reset your My Boat Prep password", html=html)
        except (HTTPException, ValueError):
            logger.error("Password reset email failed to send")
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(payload: ResetIn, request: Request):
    now = datetime.now(timezone.utc)
    rec = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": _sha(payload.token), "used": False, "expires_at": {"$gt": now}},
        {"$set": {"used": True}}, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not rec:
        raise HTTPException(status_code=400, detail="This reset link has expired or was already used. Ask for a new one.")
    if provider_of(await db.users.find_one({"user_id": rec["user_id"]}, {"_id": 0, "password_hash": 1, "auth_provider": 1}) or {"auth_provider": "email"}) == "google":
        raise HTTPException(status_code=403, detail=GOOGLE_MANAGED)
    user = await db.users.find_one_and_update(
        {"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password), "email_verified": True}},
        projection={"_id": 0, "email": 1, "password_hash": 1})
    await db.user_sessions.delete_many({"user_id": rec["user_id"]})
    if user:
        await db.login_attempts.delete_one({"identifier": _ident(user["email"])})
        await password_alert(user["email"], public_base(request), not user.get("password_hash"))
    return {"ok": True}
