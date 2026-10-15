import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from db import db
from billing import refresh_if_lapsed

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].strip().lower()
SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
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
    created_at: Optional[str] = None


def to_user_out(u: dict) -> UserOut:
    is_admin = u.get("email", "").lower() == ADMIN_EMAIL
    role = u.get("role", "free")
    return UserOut(
        user_id=u["user_id"], email=u["email"], name=u.get("name", ""), picture=u.get("picture", ""),
        role=role, is_admin=is_admin, premium=is_admin or role in ("beta_tester", "pro"),
        pro_until=u.get("pro_until"), cancel_at_period_end=bool(u.get("cancel_at_period_end")),
        has_subscription=bool(u.get("stripe_subscription_id")) and u.get("subscription_status") in ("active", "trialing"),
        created_at=u.get("created_at"),
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
    return await refresh_if_lapsed(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not to_user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    if not to_user_out(user).premium:
        raise HTTPException(status_code=403, detail="Upgrade to Pro to use this feature")
    return user


@router.post("/auth/session", response_model=UserOut)
async def create_session(request: Request, response: Response):
    session_id = request.headers.get("x-session-id", "")
    if not session_id or len(session_id) > 512:
        raise HTTPException(status_code=400, detail="Missing session id")
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(SESSION_DATA_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sign-in failed, please try again")
    data = r.json()
    email = data["email"].strip().lower()
    now = datetime.now(timezone.utc)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}})
    else:
        user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.get("name", ""),
                "picture": data.get("picture", ""), "role": "free", "created_at": now.isoformat()}
        await db.users.insert_one(dict(user))
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": data["session_token"],
                                       "expires_at": now + timedelta(days=7), "created_at": now})
    response.set_cookie("session_token", data["session_token"], max_age=7 * 24 * 3600, path="/",
                        httponly=True, secure=True, samesite="none")
    return to_user_out(await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}))


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
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": payload.role}})
    return to_user_out(await db.users.find_one({"user_id": user_id}, {"_id": 0}))
