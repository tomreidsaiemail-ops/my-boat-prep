from datetime import datetime, timezone
from typing import List, Union
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api")
TIPS_KEY = "master"


class TipItem(BaseModel):
    id: Union[int, str]
    label: str = Field(max_length=500)


class TipsIn(BaseModel):
    items: List[TipItem] = Field(max_length=300)


async def load_tips() -> dict:
    doc = await db.tips.find_one({"key": TIPS_KEY}, {"_id": 0})
    return {"items": (doc or {}).get("items", []), "updated_at": (doc or {}).get("updated_at")}


@router.get("/tips")
async def get_tips(_: dict = Depends(get_current_user)):
    return await load_tips()


@router.put("/admin/tips")
async def save_tips(payload: TipsIn, admin: dict = Depends(require_admin)):
    items = [{"id": t.id, "label": t.label.strip()} for t in payload.items if t.label.strip()]
    now = datetime.now(timezone.utc).isoformat()
    await db.tips.update_one({"key": TIPS_KEY}, {"$set": {"key": TIPS_KEY, "items": items, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"items": items, "updated_at": now}
