from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api")


class WizardEvent(BaseModel):
    wizard: str = Field(min_length=1, max_length=120)
    event: Literal["open", "finish"]


@router.post("/wizards/event")
async def wizard_event(payload: WizardEvent, user: dict = Depends(get_current_user)):
    """A Model Vessel walkthrough was opened or finished: one record per person per walkthrough."""
    now, key = datetime.now(timezone.utc).isoformat(), payload.wizard.strip().lower()
    upd = {"$setOnInsert": {"first_at": now}, "$set": {"last_at": now}, "$inc": {"opens": 1 if payload.event == "open" else 0}}
    if payload.event == "finish":
        upd["$min"] = {"finished_at": now}
    await db.wizard_progress.update_one({"user_id": user["user_id"], "wizard": key}, upd, upsert=True)
    return {"ok": True}


@router.get("/wizards/mine")
async def my_wizards(user: dict = Depends(get_current_user)):
    docs = await db.wizard_progress.find({"user_id": user["user_id"], "finished_at": {"$exists": True}}, {"_id": 0, "wizard": 1}).to_list(200)
    return {"finished": [d["wizard"] for d in docs]}


async def tutorial_stats() -> list:
    """Analytics: each Model Vessel walkthrough with how many people opened and finished it, and when anyone first opened it."""
    names = [d["name"] async for d in db.list_templates.find({"custom": True, "name": {"$regex": r"^\s*admin\s*-\s*model vessel\s*-", "$options": "i"}}, {"_id": 0, "name": 1})]
    rows = {r["_id"]: r for r in await db.wizard_progress.aggregate([{"$group": {
        "_id": "$wizard", "users": {"$sum": 1}, "opens": {"$sum": "$opens"}, "first_at": {"$min": "$first_at"},
        "finished": {"$sum": {"$cond": [{"$ifNull": ["$finished_at", False]}, 1, 0]}}}}]).to_list(200)}
    out = []
    for n in names:
        title = " ".join(n.split("-", 2)[2].split()) if n.count("-") >= 2 else ""
        if not title:
            continue
        r = rows.get(title.lower(), {})
        out.append({"title": title, "users": r.get("users", 0), "opens": r.get("opens", 0), "finished": r.get("finished", 0), "first_at": r.get("first_at")})
    return sorted(out, key=lambda t: (t["title"].lower() != "basic introduction walkthrough", t["title"].lower()))
