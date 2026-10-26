import os
import asyncio
from datetime import datetime, timezone
import stripe
from db import db

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
ACTIVE = ("active", "trialing")


def _period_end(sub) -> str | None:
    ts = sub.get("current_period_end")
    if not ts:
        items = (sub.get("items") or {}).get("data") or []
        ts = items[0].get("current_period_end") if items else None
    return datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None


async def retrieve_subscription(sub_id: str):
    return await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)


FIRST5000_LOOKUP = "pro_yearly_first5000"


def ensure_first5000_schedule(sub) -> None:
    """FIRST5000: launch price for the first year and first renewal, then full price from the 2nd renewal."""
    if sub.get("schedule") or sub.get("status") not in ACTIVE:
        return
    full = stripe.Price.list(lookup_keys=["pro_yearly"], active=True, limit=1).data
    if not full:
        return
    first = sub["items"]["data"][0]["price"]["id"]
    sched = stripe.SubscriptionSchedule.create(from_subscription=sub["id"])
    p0 = sched["phases"][0]
    tax = {"automatic_tax": {"enabled": bool((p0.get("automatic_tax") or {}).get("enabled"))}}
    year = {"interval": "year", "interval_count": 1}
    stripe.SubscriptionSchedule.modify(sched["id"], end_behavior="release", phases=[
        {"items": [{"price": first, "quantity": 1}], "start_date": p0["start_date"], "end_date": p0["end_date"], **tax},
        {"items": [{"price": first, "quantity": 1}], "duration": year, **tax},
        {"items": [{"price": full[0].id, "quantity": 1}], "duration": year, **tax},
    ])


async def apply_subscription(user_id: str, sub) -> None:
    """Sync a Stripe subscription onto the user's tier."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    fields = {
        "stripe_subscription_id": sub["id"],
        "stripe_customer_id": sub.get("customer"),
        "subscription_status": sub.get("status"),
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
        "pro_until": _period_end(sub),
    }
    if (sub.get("metadata") or {}).get("first5000") == "1":
        fields["first5000"] = True
        await asyncio.to_thread(ensure_first5000_schedule, sub)
    if sub.get("status") in ACTIVE:
        fields["role"] = "pro" if user.get("role") != "beta_tester" else user["role"]
    elif user.get("role") == "pro" and user.get("stripe_subscription_id") in (None, sub["id"]):
        fields["role"] = "free"
    await db.users.update_one({"user_id": user_id}, {"$set": fields})


async def refresh_if_lapsed(user: dict) -> dict:
    """Re-check Stripe when a paid Pro period has passed (webhook fallback)."""
    until, sub_id = user.get("pro_until"), user.get("stripe_subscription_id")
    if user.get("role") != "pro" or not sub_id or not until or until > datetime.now(timezone.utc).isoformat():
        return user
    try:
        await apply_subscription(user["user_id"], await retrieve_subscription(sub_id))
    except stripe.error.StripeError:
        return user
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
