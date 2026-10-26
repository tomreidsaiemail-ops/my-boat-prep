import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from db import db
from auth import require_premium

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
DAILY_DRAFTS = 20
SYSTEM = "You are an experienced yacht skipper who writes practical, safety-minded checklists for small boats. Reply with JSON only, no prose and no code fences."
PROMPT = (
    'Write a checklist for a boat list called "{name}". Group it into 3 to 8 categories in a sensible order. '
    "Give each category a short name with a brief explanation in brackets that helps new crew, e.g. 'Deck (before leaving the dock)'. "
    "Give each category 3 to 10 short, actionable items a sailor would tick off, e.g. 'Check engine oil level'. "
    'Return exactly: {{"groups": [{{"heading": "...", "items": ["..."]}}]}}'
)


class DraftIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


def to_lines(text: str) -> list:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    groups = json.loads(match.group(0)).get("groups", [])
    lines, seen, n = [], set(), 0
    for g in groups if isinstance(groups, list) else []:
        heading = str((g or {}).get("heading", "")).strip()[:80]
        items = [str(i).strip()[:120] for i in g.get("items", []) if str(i).strip()] if heading else []
        if not items:
            continue
        n += 1
        lines.append(f"{n}. {heading}")
        for i in items:
            if i.lower() not in seen:
                seen.add(i.lower())
                lines.append(i)
    if not lines:
        raise ValueError("empty draft")
    return lines


@router.post("/ai/list-draft")
async def list_draft(body: DraftIn, user: dict = Depends(require_premium)):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.ai_drafts.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_DRAFTS:
        raise HTTPException(status_code=429, detail=f"You've used today's {DAILY_DRAFTS} AI list drafts. Try again tomorrow.")
    draft_id = str(uuid.uuid4())
    await db.ai_drafts.insert_one({"draft_id": draft_id, "user_id": user["user_id"], "name": body.name.strip(), "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"draft-{draft_id}", system_message=SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=PROMPT.format(name=body.name.strip().replace('"', "'")))):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        lines = to_lines(text)
    except Exception as e:
        log.error(f"AI list draft failed: {e}; reply={text[:300]!r}")
        await db.ai_drafts.delete_one({"draft_id": draft_id})
        raise HTTPException(status_code=503, detail="The AI couldn't write that list right now. Please try again.")
    left = max(0, DAILY_DRAFTS - await db.ai_drafts.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}))
    return {"lines": lines, "drafts_left": left}
