import asyncio
import logging
from datetime import datetime, timezone

import stripe
from fastapi import HTTPException

from db import db
from crew import email_key

CODE = "JOINCREW"
REWARD = 10
NOT_CREW = "The JOINCREW code is only available to registered crew members who have accepted boat terms."
log = logging.getLogger(__name__)


async def crew_boats(user_id: str) -> list:
    return await db.user_boats.find({"crew": user_id, "owner_id": {"$ne": user_id}, f"agreements.{user_id}.accepted_at": {"$exists": True}},
                                    {"_id": 0, "owner_id": 1, "boat_id": 1}).to_list(200)


async def check(user: dict):
    if user.get("joincrew"):
        raise HTTPException(status_code=400, detail="You've already used the JOINCREW code. It can only be used once.")
    if not await crew_boats(user["user_id"]):
        raise HTTPException(status_code=400, detail=NOT_CREW)


async def award(user_id: str, session_id: str):
    """Once per buyer: each skipper whose terms they accepted gets the reward, and their crew cards get the JOINCREW tick."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not user:
        return
    boats = await crew_boats(user_id)
    owners = list(dict.fromkeys(b["owner_id"] for b in boats))
    rec = {"at": datetime.now(timezone.utc).isoformat(), "session_id": session_id, "email_key": email_key(user.get("email", "")), "skippers": owners}
    res = await db.users.update_one({"user_id": user_id, "joincrew": {"$exists": False}}, {"$set": {"joincrew": rec}})
    if not res.modified_count:
        return
    for o in owners:
        await db.magic_quota.update_one({"user_id": o}, {"$inc": {"purchased_allowance": REWARD}, "$setOnInsert": {"free_used": 0}}, upsert=True)
    for b in boats:
        await db.user_boats.update_one({"owner_id": b["owner_id"], "boat_id": b["boat_id"]}, {"$set": {f"joincrew_applied.{user_id}": True}})


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
