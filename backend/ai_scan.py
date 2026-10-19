import base64
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
from db import db
from auth import require_premium
from photos import MAX_BYTES, TYPES

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
DAILY_SCANS = 20
MAX_ITEMS = 60
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
SYSTEM = (
    "You catalogue the contents of storage spaces on boats (cupboards, lockers, lazarettes, drawers). "
    "Reply with JSON only, no prose and no code fences."
)
PROMPT = (
    "List every distinct item you can see stored in this boat cupboard, locker or drawer. "
    "Use short, plain names a sailor would use (e.g. 'Spare impeller', 'Head torch', 'Tinned tomatoes'). "
    "Count how many of each you can see; use 1 if unsure. Ignore the cupboard itself, shelves and fittings. "
    'Return exactly: {"items": [{"name": "...", "qty": 1}]}. If you cannot see any items, return {"items": []}.'
)


def parse_items(text: str) -> list:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    raw = json.loads(match.group(0)).get("items", [])
    out, seen = [], set()
    for r in raw if isinstance(raw, list) else []:
        name = str((r or {}).get("name", "")).strip()[:80]
        if not name or name.lower() in seen:
            continue
        try:
            qty = min(9999, max(1, int(r.get("qty", 1))))
        except (TypeError, ValueError):
            qty = 1
        seen.add(name.lower())
        out.append({"name": name, "qty": qty})
    return out[:MAX_ITEMS]


@router.post("/boats/{boat_id}/scan")
async def scan_cupboard(boat_id: BoatPath, file: UploadFile = File(...), user: dict = Depends(require_premium)):
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP photo")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That photo is too big (max 3 MB)")
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="That file doesn't look like a photo")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.ai_scans.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_SCANS:
        raise HTTPException(status_code=429, detail=f"You've used today's {DAILY_SCANS} AI scans. Try again tomorrow, or add items by hand.")
    scan_id = str(uuid.uuid4())
    await db.ai_scans.insert_one({"scan_id": scan_id, "user_id": user["user_id"], "boat_id": boat_id, "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"scan-{uuid.uuid4()}", system_message=SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    try:
        msg = UserMessage(text=PROMPT, file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())])
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        items = parse_items(text)
    except Exception as e:
        log.error(f"AI scan failed: {e}; reply={text[:300]!r}")
        await db.ai_scans.delete_one({"scan_id": scan_id})
        raise HTTPException(status_code=503, detail="The AI couldn't read that photo. Please try again or add items by hand.")
    return {"items": items, "scans_left": max(0, DAILY_SCANS - await db.ai_scans.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}))}
