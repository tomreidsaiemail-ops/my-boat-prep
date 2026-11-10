import asyncio
import logging
from datetime import datetime, timezone
from html import escape

import stripe
from fastapi import HTTPException

import crew
from db import db
from email_service import send_email

CODE = "JOINCREW"
REWARD = 10
NOT_CREW = "The JOINCREW code is only available to registered crew members who have accepted boat terms."
OFFER = "Use coupon code JOINCREW to get a great discount, and bump your Skipper's \"magic credits\""
log = logging.getLogger(__name__)


async def crew_boats(user_id: str) -> list:
    return await db.user_boats.find({"crew": user_id, "owner_id": {"$ne": user_id}, f"agreements.{user_id}.accepted_at": {"$exists": True}},
                                    {"_id": 0, "owner_id": 1, "boat_id": 1, "boat.vessel": 1, f"crew_names.{user_id}": 1}).to_list(200)


async def live() -> bool:
    return bool(await db.promo_codes.find_one({"code": CODE, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 1}))


async def check(user: dict):
    if user.get("joincrew"):
        raise HTTPException(status_code=400, detail="You've already used the JOINCREW code. It can only be used once.")
    if not await crew_boats(user["user_id"]):
        raise HTTPException(status_code=400, detail=NOT_CREW)


def _reward_html(crew_name: str, vessels: list, reward: int) -> str:
    on = ", ".join(escape(v) for v in vessels)
    return ('<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
            f'<h2 style="margin:0 0 12px">+{reward} Magic generations for you</h2>'
            f'<p><b>{escape(crew_name)}</b>, your crew on <b>{on}</b>, has started their own My Boat Prep Pro plan with the JOINCREW code.</p>'
            f'<p>As a thank-you, <b>{reward} Magic generations</b> have been added to your balance. They never expire.</p>'
            '<p style="font-size:13px;color:#64748b">You can see the JOINCREW tick on their crew card and in your Crew Register.</p></div>')


async def _email_skippers(user: dict, boats: list, owners: list, reward: int):
    for o in owners:
        skipper = await db.users.find_one({"user_id": o}, {"_id": 0, "email": 1})
        if not skipper:
            continue
        mine = [b for b in boats if b["owner_id"] == o]
        name = next((n for b in mine if (n := (b.get("crew_names") or {}).get(user["user_id"]))), None) or user.get("name") or user.get("email", "Your crew member")
        vessels = list(dict.fromkeys(((b.get("boat") or {}).get("vessel") or "").strip() or "your boat" for b in mine))
        try:
            await send_email(to=[skipper["email"]], subject=f"{name} joined My Boat Prep Pro with JOINCREW: +{reward} Magic for you",
                             html=_reward_html(name, vessels, reward))
        except Exception as e:
            log.warning("JOINCREW reward email to %s failed: %s", o, e)


async def award(user_id: str, session_id: str):
    """Once per buyer: each skipper whose terms they accepted gets the reward, and their crew cards get the JOINCREW tick."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "email": 1, "name": 1})
    if not user:
        return
    boats = await crew_boats(user_id)
    owners = list(dict.fromkeys(b["owner_id"] for b in boats))
    reward = int((await db.promo_codes.find_one({"code": CODE}, {"_id": 0, "skipper_reward": 1}) or {}).get("skipper_reward", REWARD))
    rec = {"at": datetime.now(timezone.utc).isoformat(), "session_id": session_id, "email_key": crew.email_key(user.get("email", "")), "skippers": owners, "reward": reward}
    res = await db.users.update_one({"user_id": user_id, "joincrew": {"$exists": False}}, {"$set": {"joincrew": rec}})
    if not res.modified_count:
        return
    for b in boats:
        await db.user_boats.update_one({"owner_id": b["owner_id"], "boat_id": b["boat_id"]}, {"$set": {f"joincrew_applied.{user_id}": True}})
    if reward <= 0:
        return
    for o in owners:
        await db.magic_quota.update_one({"user_id": o}, {"$inc": {"purchased_allowance": reward}, "$setOnInsert": {"free_used": 0}}, upsert=True)
    await _email_skippers(user, boats, owners, reward)


async def lock_stripe_box():
    """JOINCREW is applied by our checkout only, so it can't be typed into Stripe's own code box without the crew check."""
    d = await db.promo_codes.find_one({"code": CODE, "box_off": {"$ne": True}}, {"_id": 0, "stripe_promo_id": 1})
    if not d:
        return
    try:
        await asyncio.to_thread(stripe.PromotionCode.modify, d["stripe_promo_id"], active=False)
        await db.promo_codes.update_one({"code": CODE}, {"$set": {"box_off": True}})
    except stripe.error.StripeError as e:
        log.warning("Couldn't switch off JOINCREW in Stripe's code box: %s", e)
