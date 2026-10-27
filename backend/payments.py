import os
import re
import logging
import asyncio
from datetime import datetime, timezone
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import db
from billing import FIRST5000_LOOKUP, apply_subscription, retrieve_subscription
from launch import first200_running
from auth import get_current_user, to_user_out, UserOut

STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
PRO_LOOKUP_KEY = "pro_yearly"
TAX_MODE = "calc_only"  # NZ sandbox: Stripe calculates tax, owner files returns
ORIGIN_RE = re.compile(r"^https?://[a-z0-9.-]+(:\d{2,5})?$")

router = APIRouter(prefix="/api")


async def first5000_running() -> bool:
    doc = await db.app_settings.find_one({"key": "first5000"}, {"_id": 0})
    return bool(doc and doc.get("running"))


def _price(lookup: str):
    data = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
    return data[0] if data else None


async def _offer() -> dict:
    full, first = await asyncio.gather(asyncio.to_thread(_price, PRO_LOOKUP_KEY), asyncio.to_thread(_price, FIRST5000_LOOKUP))
    return {"first5000": await first5000_running(), "first200": await first200_running(), "price": (full.unit_amount / 100) if full else None,
            "first5000_price": (first.unit_amount / 100) if first else None}


@router.get("/payments/offer")
async def offer(_: dict = Depends(get_current_user)):
    return await _offer()


# Public so the login page can show the FIRST5000 banner before sign-in.
@router.get("/payments/offer/public")
async def public_offer():
    return await _offer()


class CheckoutIn(BaseModel):
    origin_url: str = Field(max_length=200)


def _create_session(**kwargs):
    if TAX_MODE == "calc_only":
        kwargs.update(automatic_tax={"enabled": True}, billing_address_collection="required")
    return stripe.checkout.Session.create(**kwargs)


@router.post("/payments/checkout")
async def checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
    origin = payload.origin_url.rstrip("/").lower()
    if not ORIGIN_RE.match(origin):
        raise HTTPException(status_code=400, detail="Invalid origin")
    if to_user_out(user).has_subscription:
        raise HTTPException(status_code=400, detail="You already have Pro")
    if await first200_running(fresh=True):
        raise HTTPException(status_code=400, detail="My Boat Prep Pro is free for everyone during the FIRST200 launch, no payment needed")
    launch = await first5000_running()
    lookup = FIRST5000_LOOKUP if launch else PRO_LOOKUP_KEY
    price, full = await asyncio.gather(asyncio.to_thread(_price, lookup), asyncio.to_thread(_price, PRO_LOOKUP_KEY))
    if not price or not full:
        raise HTTPException(status_code=500, detail="Pro plan not configured")
    meta = {"user_id": user["user_id"], "lookup_key": lookup, "first5000": "1" if launch else "0"}
    f, p = full.unit_amount / 100, price.unit_amount / 100
    note = (f"FIRST5000 launch offer: 50% off. You pay NZD {p:.2f} for your first year and NZD {p:.2f} again at your first renewal, "
            f"then NZD {f:.2f} a year. A promo code comes off this year's NZD {p:.2f}." if launch
            else f"Pro renews automatically at NZD {f:.2f} a year. A promo code comes off this first year only.")
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}], mode="subscription",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel", metadata=meta, subscription_data={"metadata": meta},
        client_reference_id=user["user_id"], adaptive_pricing={"enabled": False}, allow_promotion_codes=True,
        custom_text={"submit": {"message": note}},
    )
    if user.get("stripe_customer_id"):
        kwargs["customer"] = user["stripe_customer_id"]
    else:
        kwargs["customer_email"] = user["email"]
    session = await asyncio.to_thread(_create_session, **kwargs)
    now = datetime.now(timezone.utc)
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["user_id"], "lookup_key": lookup,
        "amount": float(price.unit_amount or 0) / 100, "currency": price.currency,
        "status": "initiated", "payment_status": "pending", "created_at": now, "updated_at": now,
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def _mark_paid(session_id: str, subscription_id: str | None, user_id: str | None):
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_subscription_id": subscription_id,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    if subscription_id and user_id:
        await apply_subscription(user_id, await retrieve_subscription(subscription_id))


@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, s.subscription, record.get("user_id"))
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"]}


async def _user_for_subscription(sub) -> str | None:
    uid = (sub.get("metadata") or {}).get("user_id")
    if uid:
        return uid
    u = await db.users.find_one({"stripe_subscription_id": sub["id"]}, {"_id": 0, "user_id": 1})
    return u["user_id"] if u else None


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await _mark_paid(obj["id"], obj.get("subscription"), (obj.get("metadata") or {}).get("user_id"))
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                                                 {"$set": {"status": "expired", "payment_status": "expired"}})
    elif t in ("customer.subscription.updated", "customer.subscription.deleted"):
        uid = await _user_for_subscription(obj)
        if uid:
            await apply_subscription(uid, obj)
    elif t in ("invoice.payment_failed", "invoice.paid") and _invoice_sub(obj):
        # invoice.paid on a renewal is a second chance to move FIRST5000 to full price after the first renewal.
        try:
            sub = await retrieve_subscription(_invoice_sub(obj))
            uid = await _user_for_subscription(sub)
            if uid:
                await apply_subscription(uid, sub)
        except stripe.error.StripeError as e:
            logging.getLogger(__name__).error("Webhook %s sync failed: %s", t, e)
    return {"status": "ok"}


def _invoice_sub(inv) -> str | None:
    sub = inv.get("subscription") or ((inv.get("parent") or {}).get("subscription_details") or {}).get("subscription")
    return sub if isinstance(sub, str) else (sub or {}).get("id")


class RenewIn(BaseModel):
    renew: bool


@router.post("/payments/renewal", response_model=UserOut)
async def set_renewal(payload: RenewIn, user: dict = Depends(get_current_user)):
    sub_id = user.get("stripe_subscription_id")
    if not sub_id or not to_user_out(user).has_subscription:
        raise HTTPException(status_code=400, detail="No active Pro subscription")
    sub = await asyncio.to_thread(stripe.Subscription.modify, sub_id, cancel_at_period_end=not payload.renew)
    await apply_subscription(user["user_id"], sub)
    return to_user_out(await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}))
