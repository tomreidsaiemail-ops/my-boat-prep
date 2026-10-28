from datetime import datetime, timezone
from typing import Optional
from db import db

FEATURES = {"MMD": "Magic Marine Doctor", "MPA": "Marine Magic Provisioning Assistant", "MME": "Magic Marine Engineer",
            "MMN": "Magic Marine Navigator", "MLG": "Magic List Generation", "BMMS": "Batch Magic Marine Scan", "MMS": "Magic Marine Scan"}
KIND_FEATURE = {"doctor": "MMD", "mpa": "MPA", "engine": "MME", "navigator": "MMN", "draft": "MLG", "topup": "MLG"}


async def record_usage(user_id: str, feature: str, usage: Optional[object]):
    tin, tout = int(getattr(usage, "input_tokens", 0) or 0), int(getattr(usage, "output_tokens", 0) or 0)
    await db.ai_usage.insert_one({"user_id": user_id, "feature": feature, "input_tokens": tin, "output_tokens": tout,
                                  "total_tokens": int(getattr(usage, "total_tokens", 0) or 0) or tin + tout, "created_at": datetime.now(timezone.utc)})


def _when(iso: str) -> datetime:
    try:
        d = datetime.fromisoformat(iso)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


async def backfill_usage():
    """One-off: count Magic uses logged before token tracking began (tokens unknown, recorded as 0)."""
    if await db.app_settings.find_one({"key": "ai_usage_backfilled"}):
        return
    docs = [{"user_id": d["user_id"], "feature": KIND_FEATURE.get(d.get("kind"), "MLG"), "input_tokens": 0, "output_tokens": 0, "total_tokens": 0,
             "created_at": _when(d.get("created_at")), "backfilled": True} async for d in db.ai_drafts.find({}, {"_id": 0, "user_id": 1, "kind": 1, "created_at": 1})]
    docs += [{"user_id": d["user_id"], "feature": "MMS", "input_tokens": 0, "output_tokens": 0, "total_tokens": 0,
              "created_at": _when(d.get("created_at")), "backfilled": True} async for d in db.ai_scans.find({}, {"_id": 0, "user_id": 1, "created_at": 1})]
    if docs:
        await db.ai_usage.insert_many(docs)
    await db.app_settings.insert_one({"key": "ai_usage_backfilled", "at": datetime.now(timezone.utc).isoformat(), "count": len(docs)})
