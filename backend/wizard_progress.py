import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, require_admin
from db import db
from templates import _keep_version

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


PLACEHOLDER = "New step: write the instructions for this step here."
NOT_STEP = re.compile(r"^\s*(--|\$\$)")


class StepEdit(BaseModel):
    wizard: str = Field(min_length=1, max_length=120)
    step: int = Field(ge=0, le=300)
    expect: str = Field(max_length=4000)
    text: str = Field(min_length=1, max_length=4000)
    before: int = Field(default=0, ge=0, le=20)
    after: int = Field(default=0, ge=0, le=20)


@router.post("/admin/wizard-step")
async def edit_wizard_step(p: StepEdit, admin: dict = Depends(require_admin)):
    """Edit Step on a Model Vessel wizard: replace just that step's line, and add placeholder steps before or after it."""
    key = " ".join(p.wizard.split()).lower()
    doc = next((d for d in await db.list_templates.find({"custom": True, "name": {"$regex": r"^\s*admin\s*-\s*model vessel\s*-", "$options": "i"}}, {"_id": 0}).to_list(100)
                if d["name"].count("-") >= 2 and " ".join(d["name"].split("-", 2)[2].split()).lower() == key), None)
    if not doc:
        raise HTTPException(status_code=404, detail="That walkthrough's template list wasn't found")
    items = doc["items"]
    at = [n for n, i in enumerate(items) if i["label"].strip() and not NOT_STEP.match(i["label"])]
    if p.step >= len(at) or items[at[p.step]]["label"].strip() != p.expect.strip():
        raise HTTPException(status_code=409, detail="This step was changed somewhere else. Close the walkthrough, open it again and try once more.")
    n = at[p.step]
    nid = max([int(i.get("id") or 0) for i in items] + [0]) + 1
    before = [{"id": nid + j, "label": PLACEHOLDER} for j in range(p.before)]
    after = [{"id": nid + p.before + j, "label": PLACEHOLDER} for j in range(p.after)]
    out = items[:n] + before + [{**items[n], "label": " ".join(p.text.split())}] + after + items[n + 1:]
    if len(out) > 300:
        raise HTTPException(status_code=400, detail="A template list can have up to 300 lines")
    await _keep_version(doc)
    await db.list_templates.update_one({"list_id": doc["list_id"]}, {"$set": {"items": out, "updated_by": admin["user_id"], "updated_at": datetime.now(timezone.utc).isoformat(), "note": "Edit Step on the Model Vessel"}})
    return {"lines": [i["label"] for i in out]}
