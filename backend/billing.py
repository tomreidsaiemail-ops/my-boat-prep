import os
import asyncio
from datetime import datetime, timezone
import logging
import stripe
from db import db

logger = logging.getLogger(__name__)

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


def end_first5000_after_first_renewal(sub) -> None:
    """FIRST5000 pays the launch price twice (first year + first renewal); once the first renewal has happened, the next one is full price."""
    item = sub["items"]["data"][0]
    if (item["price"].get("metadata") or {}).get("plan") != "first5000" or sub.get("status") not in ACTIVE:
        return
    start, period_start = sub.get("start_date"), item.get("current_period_start") or sub.get("current_period_start")
    if not (start and period_start and period_start - start > 300 * 86400):
        return
    full = stripe.Price.list(lookup_keys=["pro_yearly"], active=True, limit=1).data
    if not full:
        logger.error("FIRST5000: pro_yearly price missing, %s stays on the launch price", sub["id"])
        return
    stripe.Subscription.modify(sub["id"], items=[{"id": item["id"], "price": full[0].id}], proration_behavior="none")
    item["price"] = full[0]


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
    fields["first5000"] = (sub.get("metadata") or {}).get("first5000") == "1"
    if fields["first5000"]:
        try:
            await asyncio.to_thread(end_first5000_after_first_renewal, sub)
        except stripe.error.StripeError as e:
            logger.error("FIRST5000 price switch failed for %s: %s", sub["id"], e)
    items = (sub.get("items") or {}).get("data") or []
    if items and items[0]["price"].get("unit_amount") is not None:
        fields["renew_price"] = items[0]["price"]["unit_amount"] / 100
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
