import time
from db import db

# FIRST200 launch: while running, every signed-in user gets Pro free, except emails on the admin's exception list.
# Cached briefly so to_user_out can stay sync.
_cache = {"on": False, "except": frozenset(), "at": 0.0}
TTL = 10


async def first200_running(fresh: bool = False) -> bool:
    if fresh or time.monotonic() - _cache["at"] > TTL:
        doc = await db.app_settings.find_one({"key": "first200"}, {"_id": 0})
        _cache.update(on=bool(doc and doc.get("running")), at=time.monotonic(),
                      **{"except": frozenset(e.lower() for e in (doc or {}).get("exceptions") or [])})
    return _cache["on"]


def first200_cached(email: str | None = None) -> bool:
    """Whether FIRST200 applies; for a given email, False when that email is on the exception list."""
    return _cache["on"] and (email or "").strip().lower() not in _cache["except"]


async def first200_for(email: str, fresh: bool = False) -> bool:
    await first200_running(fresh)
    return first200_cached(email)


def first200_exceptions() -> list[str]:
    return sorted(_cache["except"])
