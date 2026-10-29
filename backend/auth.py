import os
import re
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from contextvars import ContextVar
from pydantic import BaseModel, Field
from db import db
from billing import refresh_if_lapsed
from launch import first200_cached, first200_running

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].strip().lower()
# Extra admins honoured only on requests to the preview site (see server.py middleware), never on the live app.
PREVIEW_ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("PREVIEW_ADMIN_EMAILS", "").split(",") if e.strip()}
PREVIEW_HOST_SUFFIX = ".preview.emergentagent.com"
on_preview: ContextVar[bool] = ContextVar("on_preview", default=False)
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
REDIRECT_RE = re.compile(r"^https://([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}/auth/google$")
SESSION_DAYS = 7
logger = logging.getLogger(__name__)
Role = Literal["free", "beta_tester", "pro"]

router = APIRouter(prefix="/api")


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""
    role: Role = "free"
    is_admin: bool = False
    premium: bool = False
    pro_until: Optional[str] = None
    cancel_at_period_end: bool = False
    has_subscription: bool = False
    first5000: bool = False
    launch_free: bool = False
    renew_price: Optional[float] = None
    created_at: Optional[str] = None
    tos_version: Optional[str] = None


def to_user_out(u: dict) -> UserOut:
    email = u.get("email", "").lower()
    is_admin = email == ADMIN_EMAIL or (on_preview.get() and email in PREVIEW_ADMIN_EMAILS)
    role = u.get("role", "free")
    return UserOut(
        user_id=u["user_id"], email=u["email"], name=u.get("name", ""), picture=u.get("picture", ""),
        role=role, is_admin=is_admin, premium=is_admin or role in ("beta_tester", "pro") or first200_cached(), launch_free=first200_cached(),
        pro_until=u.get("pro_until"), cancel_at_period_end=bool(u.get("cancel_at_period_end")),
        has_subscription=bool(u.get("stripe_subscription_id")) and u.get("subscription_status") in ("active", "trialing"),
        first5000=bool(u.get("first5000")), renew_price=u.get("renew_price"),
        created_at=u.get("created_at"), tos_version=u.get("tos_version"),
    )


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    await first200_running()
    return await refresh_if_lapsed(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not to_user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    if not to_user_out(user).premium:
        raise HTTPException(status_code=403, detail="Upgrade to Pro to use this feature")
    return user


class GoogleCodeIn(BaseModel):
    code: str = Field(min_length=10, max_length=2048)
    redirect_uri: str = Field(max_length=300)


async def create_session(response: Response, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token,
                                       "expires_at": now + timedelta(days=SESSION_DAYS), "created_at": now})
    response.set_cookie("session_token", token, max_age=SESSION_DAYS * 24 * 3600, path="/",
                        httponly=True, secure=True, samesite="none")


async def start_session(response: Response, email: str, name: str, picture: str) -> UserOut:
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        update = {"$set": {"name": name or user.get("name", ""), "picture": picture, "email_verified": True}}
        if user.get("password_hash") and not user.get("email_verified"):
            # Google proves the real owner; drop a password someone set without proving this email.
            update["$unset"] = {"password_hash": ""}
            await db.user_sessions.delete_many({"user_id": user["user_id"]})
        await db.users.update_one({"user_id": user["user_id"]}, update)
    else:
        user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": name, "picture": picture,
                "role": "free", "email_verified": True, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(dict(user))
    await create_session(response, user["user_id"])
    return to_user_out(await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}))


def _json(r: httpx.Response) -> dict:
    try:
        return r.json()
    except ValueError:
        return {}


@router.post("/auth/google", response_model=UserOut)
async def google_sign_in(payload: GoogleCodeIn, request: Request, response: Response):
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip().lower()
    if not REDIRECT_RE.match(payload.redirect_uri) or payload.redirect_uri != f"https://{host}/auth/google":
        raise HTTPException(status_code=400, detail="Invalid redirect address")
    async with httpx.AsyncClient(timeout=15) as http:
        tok = await http.post(GOOGLE_TOKEN_URL, data={
            "code": payload.code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": payload.redirect_uri, "grant_type": "authorization_code"})
        id_token = _json(tok).get("id_token") if tok.status_code == 200 else None
        if not id_token:
            logger.warning(f"Google token exchange failed: {tok.status_code} {tok.text[:200]}")
            raise HTTPException(status_code=401, detail="Google sign-in failed, please try again")
        info = await http.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
    claims = _json(info) if info.status_code == 200 else {}
    if claims.get("aud") != GOOGLE_CLIENT_ID or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com") \
            or str(claims.get("email_verified")).lower() != "true" or not claims.get("email"):
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified")
    return await start_session(response, claims["email"].strip().lower(), claims.get("name", ""), claims.get("picture", ""))


class TermsIn(BaseModel):
    version: str = Field(pattern=r"^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$")


@router.post("/auth/accept-terms", response_model=UserOut)
async def accept_terms(payload: TermsIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"tos_version": payload.version, "tos_accepted_at": datetime.now(timezone.utc).isoformat()}})
    return to_user_out({**user, "tos_version": payload.version})


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return to_user_out(user)


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    auth = request.headers.get("authorization", "")
    token = request.cookies.get("session_token") or (auth[7:] if auth.lower().startswith("bearer ") else None)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


class RoleIn(BaseModel):
    role: Role


@router.get("/admin/users", response_model=list[UserOut])
async def list_users(_: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [to_user_out(u) for u in users]


@router.patch("/admin/users/{user_id}", response_model=UserOut)
async def set_role(user_id: str, payload: RoleIn, _: dict = Depends(require_admin)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role == "free" and to_user_out(target).has_subscription:
        raise HTTPException(status_code=409, detail="This user pays for Pro. Their plan drops to Free when their subscription ends.")
    since = {"pro_since": datetime.now(timezone.utc).isoformat()} if payload.role == "pro" and target.get("role") != "pro" else {}
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": payload.role, **since}})
    return to_user_out(await db.users.find_one({"user_id": user_id}, {"_id": 0}))
