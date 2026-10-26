import asyncio
import re
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_admin
from db import db
from billing import FIRST5000_LOOKUP
from payments import PRO_LOOKUP_KEY, _price, first5000_running

router = APIRouter(prefix="/api/admin/promo-codes")
CODE_RE = re.compile(r"^[A-Z0-9_-]{3,30}$")
NZ = ZoneInfo("Pacific/Auckland")
MANAGED = {"managed_by": "mbp_admin"}


class PromoIn(BaseModel):
    code: str = Field(max_length=30)
    percent_off: float = Field(gt=0, le=100)
    expires_on: date


def _pro_price():
    prices = stripe.Price.list(lookup_keys=[PRO_LOOKUP_KEY], active=True, limit=1, expand=["data.product"]).data
    if not prices:
        raise HTTPException(status_code=500, detail="Pro plan not configured")
    return prices[0]


def _stripe_usage() -> dict:
    return {p.id: {"times_redeemed": p.times_redeemed, "active": p.active}
            for p in stripe.PromotionCode.list(limit=100).auto_paging_iter() if (p.metadata or {}).get("managed_by") == "mbp_admin"}


def _out(d: dict, usage: dict | None) -> dict:
    u = (usage or {}).get(d["stripe_promo_id"], {})
    return {"code": d["code"], "percent_off": d["percent_off"], "expires_at": d["expires_at"], "created_at": d["created_at"],
            "times_redeemed": u.get("times_redeemed") if usage is not None else None,
            "active": u.get("active", False) and d["expires_at"] > datetime.now(timezone.utc).isoformat()}


class First5000In(BaseModel):
    running: bool


@router.put("/first5000")
async def set_first5000(payload: First5000In, admin: dict = Depends(require_admin)):
    await db.app_settings.update_one({"key": "first5000"}, {"$set": {"key": "first5000", "running": payload.running, "updated_by": admin["user_id"],
                                                                     "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"running": payload.running}


@router.get("")
async def list_promo_codes(_: dict = Depends(require_admin)):
    docs = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    try:
        price = await asyncio.to_thread(_pro_price)
        usage = await asyncio.to_thread(_stripe_usage)
        base = {"amount": price.unit_amount / 100, "currency": price.currency.upper()}
    except stripe.error.StripeError:
        usage, base = None, None
    first = await asyncio.to_thread(_price, FIRST5000_LOOKUP)
    return {"base_price": base, "first5000": await first5000_running(), "first5000_price": first.unit_amount / 100 if first else None,
            "codes": [_out(d, usage) for d in docs]}


def _create_in_stripe(code: str, percent_off: float, expires_ts: int):
    product = _pro_price().product
    coupon = stripe.Coupon.create(percent_off=percent_off, duration="once", name=f"{code} ({percent_off:g}% off first year)"[:40],
                                  applies_to={"products": [product.id]}, redeem_by=expires_ts, metadata=MANAGED)
    try:
        promo = stripe.PromotionCode.create(promotion={"type": "coupon", "coupon": coupon.id}, code=code, expires_at=expires_ts, metadata=MANAGED)
    except stripe.error.StripeError:
        stripe.Coupon.delete(coupon.id)
        raise
    return coupon, promo


@router.post("")
async def create_promo_code(payload: PromoIn, admin: dict = Depends(require_admin)):
    code = payload.code.strip().upper()
    if not CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Use 3 to 30 letters, numbers, - or _ for the code")
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail=f"{code} already exists")
    if payload.expires_on < datetime.now(NZ).date():
        raise HTTPException(status_code=400, detail="Pick an expiry date from today onwards")
    percent = round(payload.percent_off, 2)
    expires = datetime.combine(payload.expires_on, time(23, 59, 59), NZ)
    try:
        coupon, promo = await asyncio.to_thread(_create_in_stripe, code, percent, int(expires.timestamp()))
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Stripe couldn't create that code")
    doc = {"code": code, "percent_off": percent, "expires_at": expires.astimezone(timezone.utc).isoformat(),
           "stripe_coupon_id": coupon.id, "stripe_promo_id": promo.id,
           "created_at": datetime.now(timezone.utc).isoformat(), "created_by": admin["user_id"]}
    await db.promo_codes.insert_one({**doc})
    return _out(doc, {promo.id: {"times_redeemed": 0, "active": True}})
