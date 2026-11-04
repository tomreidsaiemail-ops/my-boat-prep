import base64
import io
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
from db import db
from auth import require_premium
import quota
from usage import record_usage
from photos import MAX_BYTES, TYPES

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
SYSTEM = ("You transcribe handwritten and printed paper Ship's Log pages for the My Boat Prep app. Copy the writing faithfully, in reading order, "
          "keeping times, positions, headings, courses, wind, barometer and notes. Fix nothing and invent nothing; write [illegible] for words you can't read. "
          "Reply with the plain text only: no markdown, no headings of your own, no commentary.")


@router.post("/boats/{boat_id}/paper-log")
async def paper_log(boat_id: BoatPath, file: UploadFile = File(...), title: str = Form(min_length=1, max_length=120), date: str = Form(pattern=r"^\d{4}-\d{2}-\d{2}$"),
                    user: dict = Depends(require_premium)):
    """Batch Magic Scan Paper Logs: reads one photographed page into text for a Ship's Log row."""
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="Give the page a real date")
    if not title.strip():
        raise HTTPException(status_code=422, detail="Give the page a title")
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
    source = await quota.consume(user["user_id"])
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"paperlog-{uuid.uuid4()}", system_message=SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    text, usage = "", None
    hint = f"This page is the Ship's Log '{title.strip()}'" + (f" dated {date}" if date else "") + ". Transcribe it."
    try:
        async for ev in chat.stream_message(UserMessage(text=hint, file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())])):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                usage = ev.usage
                break
        text = re.sub(r"[*#`]+", "", text).strip()
        if not text:
            raise ValueError("empty")
    except Exception as e:
        log.error(f"Paper log scan failed: {e}; reply={text[:300]!r}")
        await quota.refund(user["user_id"], source)
        if usage:
            await record_usage(user["user_id"], "MPL", usage)
        raise HTTPException(status_code=503, detail="The Magic Mariner couldn't read that page. Please try again with a clearer photo.")
    await record_usage(user["user_id"], "MPL", usage)
    return {"text": text[:1800], "scans_left": await quota.left(user["user_id"])}
