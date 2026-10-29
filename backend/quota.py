import asyncio
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
import stripe
from db import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api")
DEFAULTS = {"daily_limit": 20, "pack_size": 20, "pack_price": 5.0, "big_pack_size": 100, "big_pack_price": 15.0}
PRO_LOOKUP_KEY = "pro_yearly"
# Set per request from the X-Timezone header (see server.py middleware) so the day resets at the skipper's local midnight.
current_tz: ContextVar[str | None] = ContextVar("current_tz", default=None)
# A dict the middleware creates per request; consume() fills free_left so the response can carry the X-Magic-Free-Left header.
quota_note: ContextVar[dict | None] = ContextVar("quota_note", default=None)
_price_cache: dict = {}


class QuotaExceeded(Exception):
    def __init__(self, info: dict):
        self.info = info


async def quota_exceeded_handler(_: Request, exc: QuotaExceeded):
    i = exc.info
    return JSONResponse(status_code=429, content={
        "detail": f"You've reached your daily limit of {i['daily_limit']} Magic generations. Buy +{i['pack_size']} more for {i['price_text']}.",
        "code": "daily_limit", **i})


def _pro_price():
    data = stripe.Price.list(lookup_keys=[PRO_LOOKUP_KEY], active=True, limit=1).data
    return data[0] if data else None


async def pro_currency() -> tuple[str, str | None]:
    if _price_cache.get("at", 0) > time.time() - 600:
        return _price_cache["value"]
    p = await asyncio.to_thread(_pro_price)
    value = ((p.currency if p else "nzd"), (p.get("tax_behavior") if p else None))
    _price_cache.update(at=time.time(), value=value)
    return value


def price_text(amount: float, currency: str) -> str:
    sym = {"nzd": "NZ$", "usd": "US$", "aud": "A$", "gbp": "£", "eur": "€", "cad": "CA$"}.get(currency.lower(), f"{currency.upper()} ")
    return f"{sym}{amount:g}" if amount == int(amount) else f"{sym}{amount:.2f}"


async def get_settings() -> dict:
    doc = await db.app_settings.find_one({"key": "magic_quota"}, {"_id": 0, "key": 0}) or {}
    return {**DEFAULTS, **{k: doc[k] for k in DEFAULTS if k in doc}}


def local_today(tz: str | None = None) -> str:
    tz = tz or current_tz.get()
    try:
        zone = ZoneInfo(tz) if tz else timezone.utc
    except Exception:
        zone = timezone.utc
    return datetime.now(zone).date().isoformat()


async def _fresh(user_id: str) -> dict:
    """Creates the usage doc if needed and resets daily_used when the skipper's local day has changed."""
    today = local_today()
    await db.magic_quota.update_one({"user_id": user_id}, {"$setOnInsert": {"daily_used": 0, "purchased_allowance": 0, "last_reset_date": today}}, upsert=True)
    doc = await db.magic_quota.find_one_and_update({"user_id": user_id, "last_reset_date": {"$ne": today}},
                                                   {"$set": {"daily_used": 0, "last_reset_date": today}}, return_document=ReturnDocument.AFTER)
    return doc or await db.magic_quota.find_one({"user_id": user_id}, {"_id": 0})


def packs(s: dict, currency: str) -> list:
    return [{"id": "small", "size": s["pack_size"], "price": s["pack_price"], "price_text": price_text(s["pack_price"], currency)},
            {"id": "big", "size": s["big_pack_size"], "price": s["big_pack_price"], "price_text": price_text(s["big_pack_price"], currency)}]


async def status(user_id: str) -> dict:
    s, doc = await get_settings(), await _fresh(user_id)
    used, bought = int(doc.get("daily_used", 0)), int(doc.get("purchased_allowance", 0))
    currency, _ = await pro_currency()
    return {**s, "daily_used": used, "purchased_allowance": bought, "free_left": max(0, s["daily_limit"] - used),
            "left": max(0, s["daily_limit"] - used) + bought, "currency": currency, "price_text": price_text(s["pack_price"], currency),
            "packs": packs(s, currency)}


async def consume(user_id: str) -> str:
    """Takes one Magic generation: today's free quota first, then purchased allowance. Returns the source used."""
    s = await get_settings()
    await _fresh(user_id)
    doc = await db.magic_quota.find_one_and_update({"user_id": user_id, "daily_used": {"$lt": s["daily_limit"]}}, {"$inc": {"daily_used": 1}},
                                                   return_document=ReturnDocument.AFTER)
    if doc:
        note = quota_note.get()
        if note is not None:
            note["free_left"] = max(0, s["daily_limit"] - int(doc["daily_used"]))
        return "free"
    if await db.magic_quota.find_one_and_update({"user_id": user_id, "purchased_allowance": {"$gt": 0}}, {"$inc": {"purchased_allowance": -1}}):
        return "purchased"
    raise QuotaExceeded(await status(user_id))


async def refund(user_id: str, source: str):
    if source == "free":
        await db.magic_quota.update_one({"user_id": user_id, "daily_used": {"$gt": 0}}, {"$inc": {"daily_used": -1}})
    else:
        await db.magic_quota.update_one({"user_id": user_id}, {"$inc": {"purchased_allowance": 1}})


async def left(user_id: str) -> int:
    return (await status(user_id))["left"]


async def credit_topup(session_id: str, meta: dict | None = None) -> bool:
    """Atomically marks a top-up paid and adds its pack once, however many times Stripe or the client confirms it."""
    now = datetime.now(timezone.utc)
    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "kind": "magic_topup", "credited": {"$ne": True}},
        {"$set": {"credited": True, "status": "completed", "payment_status": "paid", "updated_at": now}})
    if not tx and meta and meta.get("user_id") and str(meta.get("pack_size", "")).isdigit():
        # Webhook fallback when the checkout's transaction row was never saved: create it already credited, only once.
        res = await db.payment_transactions.update_one({"session_id": session_id}, {"$setOnInsert": {
            "user_id": meta["user_id"], "kind": "magic_topup", "pack_size": int(meta["pack_size"]), "credited": True,
            "status": "completed", "payment_status": "paid", "created_at": now, "updated_at": now}}, upsert=True)
        tx = {"user_id": meta["user_id"], "pack_size": int(meta["pack_size"])} if res.upserted_id else None
    if not tx:
        return False
    await db.magic_quota.update_one({"user_id": tx["user_id"]}, {"$inc": {"purchased_allowance": int(tx["pack_size"])},
                                                                 "$setOnInsert": {"daily_used": 0, "last_reset_date": local_today()}}, upsert=True)
    return True


@router.get("/magic/quota")
async def my_quota(user: dict = Depends(get_current_user)):
    return await status(user["user_id"])


class QuotaSettingsIn(BaseModel):
    daily_limit: int = Field(ge=0, le=1000)
    pack_size: int = Field(ge=1, le=1000)
    pack_price: float = Field(ge=1, le=500)
    big_pack_size: int | None = Field(default=None, ge=1, le=5000)
    big_pack_price: float | None = Field(default=None, ge=1, le=1000)


@router.get("/admin/settings/quota")
async def admin_get_quota(_: dict = Depends(require_admin)):
    currency, _t = await pro_currency()
    return {**await get_settings(), "currency": currency}


@router.put("/admin/settings/quota")
async def admin_set_quota(body: QuotaSettingsIn, admin: dict = Depends(require_admin)):
    vals = {k: (round(v, 2) if k.endswith("price") else v) for k, v in body.model_dump(exclude_none=True).items()}
    await db.app_settings.update_one({"key": "magic_quota"}, {"$set": {**vals, "updated_by": admin["email"], "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    currency, _t = await pro_currency()
    return {**await get_settings(), "currency": currency}
