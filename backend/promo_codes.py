import asyncio
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

import stripe
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from auth import require_admin
from db import db
from billing import FIRST5000_LOOKUP
from payments import PRO_LOOKUP_KEY, _price, first5000_running
from launch import first200_running
import joincrew

router = APIRouter(prefix="/api/admin/promo-codes")
CODE_RE = re.compile(r"^[A-Z0-9_-]{3,30}$")
NZ = ZoneInfo("Pacific/Auckland")
MANAGED = {"managed_by": "mbp_admin"}


class PromoEditIn(BaseModel):
    percent_off: float = Field(gt=0, le=100)
    expires_on: date
    skipper_reward: int | None = Field(default=None, ge=0, le=1000)


class PromoIn(PromoEditIn):
    code: str = Field(max_length=30)


CodePath = Annotated[str, Path(pattern=r"^[A-Z0-9_-]{3,30}$")]


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
            "times_redeemed": u.get("times_redeemed", 0) + d.get("prior_uses", 0) if usage is not None else None,
            **({"skipper_reward": d.get("skipper_reward", joincrew.REWARD)} if d["code"] == joincrew.CODE else {}),
            "active": (u.get("active", False) or bool(d.get("box_off"))) and d["expires_at"] > datetime.now(timezone.utc).isoformat()}


class First5000In(BaseModel):
    running: bool


async def _set_promo(key: str, running: bool, admin: dict):
    now = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one({"key": key}, {"$set": {"key": key, "running": running, "updated_by": admin["user_id"], "updated_at": now}}, upsert=True)
    if running:
        other = "first200" if key == "first5000" else "first5000"
        await db.app_settings.update_one({"key": other}, {"$set": {"key": other, "running": False, "updated_by": admin["user_id"], "updated_at": now}}, upsert=True)
    return {"first5000": await first5000_running(), "first200": await first200_running(fresh=True)}


@router.put("/first5000")
async def set_first5000(payload: First5000In, admin: dict = Depends(require_admin)):
    return {"running": payload.running, **await _set_promo("first5000", payload.running, admin)}


@router.put("/first200")
async def set_first200(payload: First5000In, admin: dict = Depends(require_admin)):
    return {"running": payload.running, **await _set_promo("first200", payload.running, admin)}


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ExceptionsIn(BaseModel):
    emails: list[str] = Field(max_length=500)


LISTS = {("first200", "exceptions"), ("first5000", "exceptions"), ("first5000", "inclusions")}


async def _lists() -> dict:
    docs = {d["key"]: d async for d in db.app_settings.find({"key": {"$in": ["first200", "first5000"]}}, {"_id": 0})}
    return {f"{k}_{f}": sorted((docs.get(k) or {}).get(f) or []) for k, f in LISTS}


@router.put("/{key}/{field}")
async def set_launch_list(key: Literal["first200", "first5000"], field: Literal["exceptions", "inclusions"], payload: ExceptionsIn, admin: dict = Depends(require_admin)):
    if (key, field) not in LISTS:
        raise HTTPException(status_code=404, detail="Not found")
    emails = sorted({e.strip().lower() for e in payload.emails if e.strip()})
    bad = [e for e in emails if not EMAIL_RE.match(e)]
    if bad:
        raise HTTPException(status_code=400, detail=f"That doesn't look like an email address: {bad[0]}")
    lists = await _lists()
    if key == "first5000":
        other = "inclusions" if field == "exceptions" else "exceptions"
        clash = sorted(set(emails) & set(lists[f"first5000_{other}"]))
        if clash:
            raise HTTPException(status_code=400, detail=f"{clash[0]} is already on the FIRST5000 {other} list. An email can't be on both FIRST5000 lists.")
    old = set(lists[f"{key}_{field}"])
    added, removed = [e for e in emails if e not in old], sorted(old - set(emails))
    if not added and not removed:
        raise HTTPException(status_code=400, detail="Nothing has changed")
    await db.app_settings.update_one({"key": key}, {"$set": {"key": key, field: emails}}, upsert=True)
    await _log(admin, "edited", f"{key.upper()} {field}", "; ".join(([f"added {', '.join(added)}"] if added else []) + ([f"removed {', '.join(removed)}"] if removed else [])))
    await first200_running(fresh=True)
    return await _lists()


def _usage(docs: list) -> dict:
    usage = _stripe_usage()
    for d in docs:
        if d.get("box_off"):
            usage[d["stripe_promo_id"]] = {"times_redeemed": stripe.Coupon.retrieve(d["stripe_coupon_id"]).times_redeemed, "active": True}
    return usage


@router.get("")
async def list_promo_codes(_: dict = Depends(require_admin)):
    docs = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    try:
        price = await asyncio.to_thread(_pro_price)
        usage = await asyncio.to_thread(_usage, docs)
        base = {"amount": price.unit_amount / 100, "currency": price.currency.upper()}
    except stripe.error.StripeError:
        usage, base = None, None
    first = await asyncio.to_thread(_price, FIRST5000_LOOKUP)
    log = await db.promo_code_log.find({}, {"_id": 0}).sort("at", -1).to_list(200)
    return {"base_price": base, "first5000": await first5000_running(), "first200": await first200_running(fresh=True), "first5000_price": first.unit_amount / 100 if first else None, **await _lists(),
            "codes": [_out(d, usage) for d in docs], "log": log}


def _create_in_stripe(code: str, percent_off: float, expires_ts: int | None):
    product = _pro_price().product
    until = {"redeem_by": expires_ts} if expires_ts else {}
    coupon = stripe.Coupon.create(percent_off=percent_off, duration="once", name=f"{code} ({percent_off:g}% off first year)"[:40],
                                  applies_to={"products": [product.id]}, metadata=MANAGED, **until)
    try:
        promo = stripe.PromotionCode.create(promotion={"type": "coupon", "coupon": coupon.id}, code=code, metadata=MANAGED,
                                            **({"expires_at": expires_ts} if expires_ts else {}))
    except stripe.error.StripeError:
        stripe.Coupon.delete(coupon.id)
        raise
    return coupon, promo


def _expiry(on: date, check: bool = True) -> tuple[str, int | None]:
    if check and on < datetime.now(NZ).date():
        raise HTTPException(status_code=400, detail="Pick an expiry date from today onwards")
    expires = datetime.combine(on, time(23, 59, 59), NZ)
    # Stripe only takes expiry dates up to five years ahead; anything later never expires there.
    stripe_limit = datetime.now(timezone.utc) + timedelta(days=5 * 365 - 2)
    return expires.astimezone(timezone.utc).isoformat(), int(expires.timestamp()) if expires <= stripe_limit else None


def _day(iso: str) -> str:
    d = datetime.fromisoformat(iso).astimezone(NZ)
    return "never expires" if d.year >= 9999 else d.strftime("%d/%m/%Y")


async def _log(admin: dict, action: str, code: str, detail: str):
    await db.promo_code_log.insert_one({"at": datetime.now(timezone.utc).isoformat(), "by": admin["email"], "action": action, "code": code, "detail": detail})


def _describe(percent: float, expires_at: str, reward: int | None) -> str:
    return f"{percent:g}% off first year, {_day(expires_at)}" + (f", skipper reward +{reward} Magic" if reward is not None else "")


@router.post("")
async def create_promo_code(payload: PromoIn, admin: dict = Depends(require_admin)):
    code = payload.code.strip().upper()
    if not CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Use 3 to 30 letters, numbers, - or _ for the code")
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail=f"{code} already exists")
    expires_at, ts = _expiry(payload.expires_on)
    percent = round(payload.percent_off, 2)
    try:
        coupon, promo = await asyncio.to_thread(_create_in_stripe, code, percent, ts)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Stripe couldn't create that code")
    reward = (joincrew.REWARD if payload.skipper_reward is None else payload.skipper_reward) if code == joincrew.CODE else None
    doc = {"code": code, "percent_off": percent, "expires_at": expires_at, "stripe_coupon_id": coupon.id, "stripe_promo_id": promo.id,
           "created_at": datetime.now(timezone.utc).isoformat(), "created_by": admin["user_id"], **({"skipper_reward": reward} if reward is not None else {})}
    await db.promo_codes.insert_one({**doc})
    await _log(admin, "created", code, _describe(percent, expires_at, reward))
    if code == joincrew.CODE:
        await joincrew.lock_stripe_box()
    return _out(doc, {promo.id: {"times_redeemed": 0, "active": True}})


def _old_uses(d: dict) -> int:
    if d.get("box_off"):
        return stripe.Coupon.retrieve(d["stripe_coupon_id"]).times_redeemed or 0
    return stripe.PromotionCode.retrieve(d["stripe_promo_id"]).times_redeemed or 0


def _switch_off(promo_id: str):
    try:
        stripe.PromotionCode.modify(promo_id, active=False)
    except stripe.error.InvalidRequestError as e:
        if getattr(e, "code", None) != "resource_missing":
            raise


@router.put("/{code}")
async def edit_promo_code(code: CodePath, payload: PromoEditIn, admin: dict = Depends(require_admin)):
    d = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail=f"{code} isn't on the list any more")
    percent = round(payload.percent_off, 2)
    expires_at, ts = _expiry(payload.expires_on, check=False)
    if expires_at != d["expires_at"]:
        _expiry(payload.expires_on)
    jc = code == joincrew.CODE
    old_reward = d.get("skipper_reward", joincrew.REWARD) if jc else None
    reward = (old_reward if payload.skipper_reward is None else payload.skipper_reward) if jc else None
    changes = [f"discount {d['percent_off']:g}% → {percent:g}%" if percent != d["percent_off"] else "",
               f"expiry {_day(d['expires_at'])} → {_day(expires_at)}" if expires_at != d["expires_at"] else "",
               f"skipper reward +{old_reward} → +{reward} Magic" if reward != old_reward else ""]
    changes = [c for c in changes if c]
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing has changed")
    upd = {"skipper_reward": reward} if jc else {}
    if percent != d["percent_off"] or expires_at != d["expires_at"]:
        if expires_at <= datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=400, detail="This code has expired, pick a new expiry date")
        # Stripe discounts can't be changed, so the code moves to a new one; people who already used it keep what they paid.
        try:
            used = await asyncio.to_thread(_old_uses, d)
            await asyncio.to_thread(_switch_off, d["stripe_promo_id"])
            try:
                coupon, promo = await asyncio.to_thread(_create_in_stripe, code, percent, ts)
            except stripe.error.StripeError:
                if not d.get("box_off"):
                    await asyncio.to_thread(stripe.PromotionCode.modify, d["stripe_promo_id"], active=True)
                raise
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=e.user_message or "Stripe couldn't update that code")
        upd.update(percent_off=percent, expires_at=expires_at, stripe_coupon_id=coupon.id, stripe_promo_id=promo.id, box_off=False, prior_uses=d.get("prior_uses", 0) + used)
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.promo_codes.update_one({"code": code}, {"$set": upd})
    await _log(admin, "edited", code, "; ".join(changes))
    if jc:
        await joincrew.lock_stripe_box()
    return await list_promo_codes(admin)


@router.delete("/{code}")
async def delete_promo_code(code: CodePath, admin: dict = Depends(require_admin)):
    d = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail=f"{code} isn't on the list any more")
    try:
        await asyncio.to_thread(_switch_off, d["stripe_promo_id"])
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Stripe couldn't switch that code off")
    await db.promo_codes.delete_one({"code": code})
    await _log(admin, "deleted", code, _describe(d["percent_off"], d["expires_at"], d.get("skipper_reward", joincrew.REWARD) if code == joincrew.CODE else None))
    return await list_promo_codes(admin)
