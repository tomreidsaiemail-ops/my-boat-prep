import time
from db import db

# FIRST200 launch: while running, every signed-in user gets Pro free. Cached briefly so to_user_out can stay sync.
_cache = {"on": False, "at": 0.0}
TTL = 10


async def first200_running(fresh: bool = False) -> bool:
    if fresh or time.monotonic() - _cache["at"] > TTL:
        doc = await db.app_settings.find_one({"key": "first200"}, {"_id": 0})
        _cache.update(on=bool(doc and doc.get("running")), at=time.monotonic())
    return _cache["on"]


def first200_cached() -> bool:
    return _cache["on"]
