import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from db import db
from auth import require_premium

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
DAILY_DRAFTS = 20
SYSTEM = ("You are Magic List Generation in the My Boat Prep app. You turn the user's description into a tidy, well-organised list. "
          "Follow the description exactly, whatever the topic; it is boating related most of the time but not always. Reply with JSON only, no prose and no code fences.")
PROMPT = (
    'The list is called "{name}". The user described what it should contain:\n"""{description}"""\n'
    "Follow that description exactly. If it asks for categories or groups, use them as headings with the items under each; "
    "otherwise group the items into sensible categories in a sensible order. "
    "For practical checklists, give each heading a brief explanation in brackets that helps new crew, e.g. 'Deck (before leaving the dock)', and keep items short and actionable. "
    "Use at most 280 items in total. "
    'Return exactly: {{"groups": [{{"heading": "...", "items": ["..."]}}]}}'
)
MAX_LINES = 300


class DraftIn(BaseModel):
    name: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=512, validate_default=True)

    @field_validator("description")
    @classmethod
    def need_description(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Please describe the list in List Description first")
        return v.strip()


def to_lines(text: str) -> list:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    groups = json.loads(match.group(0)).get("groups", [])
    lines, seen, n = [], set(), 0
    for g in groups if isinstance(groups, list) else []:
        heading = str((g or {}).get("heading", "")).strip()[:80]
        items = [i for i in dict.fromkeys(str(x).strip()[:120] for x in g.get("items", [])) if i and i.lower() not in seen] if heading else []
        if not items:
            continue
        n += 1
        lines.append(f"{n}. {heading}")
        for i in items:
            seen.add(i.lower())
            lines.append(i)
        if len(lines) >= MAX_LINES:
            break
    if not lines:
        raise ValueError("empty draft")
    return lines[:MAX_LINES]


@router.post("/ai/list-draft")
async def list_draft(body: DraftIn, user: dict = Depends(require_premium)):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.ai_drafts.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_DRAFTS:
        raise HTTPException(status_code=429, detail=f"You've used today's {DAILY_DRAFTS} Magic List Generations. Try again tomorrow.")
    draft_id = str(uuid.uuid4())
    await db.ai_drafts.insert_one({"draft_id": draft_id, "user_id": user["user_id"], "name": body.name.strip(), "description": body.description, "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"draft-{draft_id}", system_message=SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    prompt = PROMPT.format(name=body.name.strip().replace('"', "'") or "New list", description=body.description.replace('"""', "'''"))
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        lines = to_lines(text)
    except Exception as e:
        log.error(f"Magic List Generation failed: {e}; reply={text[:300]!r}")
        await db.ai_drafts.delete_one({"draft_id": draft_id})
        raise HTTPException(status_code=503, detail="Magic List Generation couldn't create that list right now. Please try again.")
    left = max(0, DAILY_DRAFTS - await db.ai_drafts.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}))
    return {"lines": lines, "drafts_left": left}
