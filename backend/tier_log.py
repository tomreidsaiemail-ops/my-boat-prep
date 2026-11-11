from datetime import datetime, timezone

from db import db

LABEL = {"free": "Free", "beta_tester": "Beta tester", "pro": "Pro"}


async def log_tier(user: dict, to_role: str | None, by: str, note: str = "") -> None:
    """Audit a user's tier change (or a tier-related event when to_role is None): when, from → to, who."""
    await db.tier_log.insert_one({
        "at": datetime.now(timezone.utc).isoformat(), "user_id": user["user_id"], "email": user.get("email", ""),
        "from": user.get("role", "free"), "to": to_role, "by": by, "note": note,
    })


async def tier_log(user_id: str | None, limit: int) -> list:
    q = {"user_id": user_id} if user_id else {}
    return await db.tier_log.find(q, {"_id": 0}).sort("at", -1).to_list(limit)
