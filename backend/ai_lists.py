import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List
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


async def _run(user: dict, kind: str, prompt: str, parse, meta: dict, system: str = SYSTEM, label: str = "Magic List Generation"):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    kinds = {"$in": ["engine"]} if kind == "engine" else {"$ne": "engine"}
    used = {"user_id": user["user_id"], "kind": kinds, "created_at": {"$gte": since}}
    if await db.ai_drafts.count_documents(used) >= DAILY_DRAFTS:
        raise HTTPException(status_code=429, detail=f"You've used today's {DAILY_DRAFTS} {label}s. Try again tomorrow.")
    draft_id = str(uuid.uuid4())
    await db.ai_drafts.insert_one({"draft_id": draft_id, "user_id": user["user_id"], "kind": kind, **meta, "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{kind}-{draft_id}", system_message=system).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        result = parse(text)
    except Exception as e:
        log.error(f"{label} ({kind}) failed: {e}; reply={text[:300]!r}")
        await db.ai_drafts.delete_one({"draft_id": draft_id})
        raise HTTPException(status_code=503, detail=f"{label} couldn't do that right now. Please try again.")
    left = max(0, DAILY_DRAFTS - await db.ai_drafts.count_documents(used))
    return result, left


@router.post("/ai/list-draft")
async def list_draft(body: DraftIn, user: dict = Depends(require_premium)):
    prompt = PROMPT.format(name=body.name.strip().replace('"', "'") or "New list", description=body.description.replace('"""', "'''"))
    lines, left = await _run(user, "draft", prompt, to_lines, {"name": body.name.strip(), "description": body.description})
    return {"lines": lines, "drafts_left": left}


TOPUP_PROMPT = (
    'The list is called "{name}".{description}\nIts current items, with group headings marked "#", are:\n{outline}\n'
    "Suggest up to 25 useful items that are missing from this list, following the same purpose, style and level of detail. "
    "Do not repeat or reword items already on the list. Most suggestions should belong under one of the existing headings: "
    "for each suggestion copy the existing heading text exactly as written after the '#', or use an empty heading only if none fits. "
    'Return exactly: {{"suggestions": [{{"item": "...", "heading": "..."}}]}}'
)


class TopUpLine(BaseModel):
    label: str = Field(max_length=300)
    heading: bool = False


class TopUpIn(BaseModel):
    name: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=512)
    items: List[TopUpLine] = Field(default_factory=list, max_length=400)


def _norm_heading(h: str) -> str:
    h = re.sub(r"^\s*\d+[.)]?\s*", "", h.lower())
    return re.sub(r"\s+", " ", h.split("(")[0]).strip(" .:-")


def parse_suggestions(text: str, headings: dict, existing: set) -> list:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    raw = json.loads(match.group(0)).get("suggestions", [])
    out, seen = [], set(existing)
    for s in raw if isinstance(raw, list) else []:
        item = str((s or {}).get("item", "")).strip()[:120]
        if not item or item.lower() in seen:
            continue
        seen.add(item.lower())
        heading = str(s.get("heading", "")).strip()
        out.append({"item": item, "heading": headings.get(heading.lower()) or headings.get(_norm_heading(heading)) or ""})
    return out[:25]


@router.post("/ai/list-topup")
async def list_topup(body: TopUpIn, user: dict = Depends(require_premium)):
    if not body.description.strip() and not body.name.strip() and not body.items:
        raise HTTPException(status_code=422, detail="Add a list name, description or a few items first")
    outline = "\n".join(f"# {i.label.strip()}" if i.heading else f"- {i.label.strip()}" for i in body.items if i.label.strip()) or "(no items yet)"
    desc = f' The user described it as: """{body.description.strip().replace(chr(34) * 3, chr(39) * 3)}"""' if body.description.strip() else ""
    prompt = TOPUP_PROMPT.format(name=body.name.strip().replace('"', "'") or "My list", description=desc, outline=outline)
    labels = [i.label.strip() for i in body.items if i.heading]
    headings = {**{_norm_heading(h): h for h in labels if _norm_heading(h)}, **{h.lower(): h for h in labels}}
    existing = {i.label.strip().lower() for i in body.items}
    suggestions, left = await _run(user, "topup", prompt, lambda t: parse_suggestions(t, headings, existing), {"name": body.name.strip()})
    return {"suggestions": suggestions, "drafts_left": left}


ENGINEER = ("You are the Magic Marine Engineer in the My Boat Prep app: an experienced, practical marine engineer helping a boat skipper with their engine. "
            "Answer in plain English using short paragraphs or a short numbered list. Start with the most likely causes, then simple checks the skipper can do on board, "
            "then say when to stop the engine or call a qualified marine engineer. Mention safety (hot parts, moving belts, fuel, exhaust fumes) where it matters. "
            "If the engine type is known, tailor the answer to it. Keep it under 250 words. Plain text only: no markdown, headings, asterisks or code.")


class EngineAskIn(BaseModel):
    question: str = Field(default="", max_length=1024, validate_default=True)
    engine_type: str = Field(default="", max_length=80)
    history: List[str] = Field(default_factory=list, max_length=10)

    @field_validator("question")
    @classmethod
    def need_question(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Type a question for the Magic Marine Engineer first")
        return v.strip()

    @field_validator("history")
    @classmethod
    def trim_history(cls, v: list) -> list:
        return [str(x).strip()[:600] for x in v if str(x).strip()]


def parse_answer(text: str) -> str:
    answer = re.sub(r"\*\*|__|^#+\s*", "", text.strip(), flags=re.M).strip()
    if not answer:
        raise ValueError("empty answer")
    return answer[:4000]


@router.post("/ai/engine-ask")
async def engine_ask(body: EngineAskIn, user: dict = Depends(require_premium)):
    history = "\n".join(f"- {h}" for h in body.history) or "(none logged)"
    prompt = (f"Engine type: {body.engine_type.strip() or 'not given'}\nRecent engine service history:\n{history}\n"
              f'The skipper asks:\n"""{body.question.replace(chr(34) * 3, chr(39) * 3)}"""')
    answer, left = await _run(user, "engine", prompt, parse_answer, {"question": body.question[:200]}, ENGINEER, "Magic Marine Engineer answer")
    return {"answer": answer, "asks_left": left}
