from datetime import datetime, timezone
from typing import List, Union
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api")
FAQ_ID = "faq"
FAQ_NAME = "FAQ"


class FaqItem(BaseModel):
    id: Union[int, str]
    question: str = Field(max_length=300)
    answer: str = Field(max_length=3000)


class FaqIn(BaseModel):
    items: List[FaqItem] = Field(max_length=300)


async def load_faq() -> List[dict]:
    doc = await db.faq.find_one({"key": "master"}, {"_id": 0})
    return (doc or {}).get("items", [])


async def faq_list_for_pdf() -> dict:
    items = [{"label": f"Q: {i['question']}  A: {i['answer']}", "checked": False, "flagged": False} for i in await load_faq()]
    return {"name": FAQ_NAME, "items": items, "numbered": True}


@router.get("/faq")
async def get_faq(_: dict = Depends(get_current_user)):
    return {"items": await load_faq()}


@router.put("/admin/faq")
async def save_faq(payload: FaqIn, admin: dict = Depends(require_admin)):
    items = [{"id": f.id, "question": f.question.strip(), "answer": f.answer.strip()}
             for f in payload.items if f.question.strip() and f.answer.strip()]
    now = datetime.now(timezone.utc).isoformat()
    await db.faq.update_one({"key": "master"}, {"$set": {"key": "master", "items": items, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"items": items, "updated_at": now}
