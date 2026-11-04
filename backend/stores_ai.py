import io
import json
import logging
import os
import re
from typing import List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from emergentintegrations.llm.openai import OpenAISpeechToText
from auth import require_premium
from ai_lists import _run

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
AUDIO_MAX = 8 * 1024 * 1024
AUDIO_TYPES = ("audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/m4a", "audio/x-m4a", "audio/aac", "video/webm", "video/mp4")
EXT = {"webm": "webm", "mp4": "mp4", "mpeg": "mp3", "mp3": "mp3", "wav": "wav", "x-wav": "wav", "ogg": "ogg", "m4a": "m4a", "x-m4a": "m4a", "aac": "m4a"}


@router.post("/ai/transcribe")
async def transcribe(file: UploadFile = File(...), user: dict = Depends(require_premium)):
    """Short voice note -> text (Whisper). Does not use a Magic; the following Magic step does."""
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="That recording format isn't supported")
    data = await file.read(AUDIO_MAX + 1)
    if len(data) > AUDIO_MAX:
        raise HTTPException(status_code=400, detail="That recording is too long, please keep it under a minute")
    if len(data) < 500:
        raise HTTPException(status_code=400, detail="That recording is empty, please try again")
    audio = io.BytesIO(data)
    audio.name = f"note.{EXT.get(ctype.split('/')[1], 'webm')}"
    try:
        stt = OpenAISpeechToText(api_key=os.environ["EMERGENT_LLM_KEY"])
        res = await stt.transcribe(file=audio, model="whisper-1", response_format="json",
                                   prompt="A skipper listing food and drink used from the boat's fridge, freezer, pantry and stores.")
    except Exception as e:
        log.error(f"transcribe failed: {e}")
        raise HTTPException(status_code=503, detail="Couldn't hear that clearly, please try again or type it")
    return {"text": (getattr(res, "text", "") or "").strip()[:2000]}


class StockItem(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    qty: int = Field(ge=0, le=9999)
    area: str = Field(default="", max_length=120)


class ConsumedIn(BaseModel):
    text: str = Field(min_length=2, max_length=2000)
    stock: List[StockItem] = Field(min_length=1, max_length=600)


SYSTEM = ("You are the Magic Provisioning Assistant on a boat. You match what the skipper says was eaten or drunk to the boat's food and drink stores. "
          "Reply with JSON only, no prose and no code fences.")


def parse_consumed(stock: List[StockItem]):
    def parse(text: str):
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError("no JSON")
        raw = json.loads(m.group(0))
        used, seen = [], set()
        for r in raw.get("items", []) if isinstance(raw.get("items"), list) else []:
            try:
                n = int(r.get("n"))
                qty = int(r.get("qty", 1))
            except (TypeError, ValueError):
                continue
            if not 1 <= n <= len(stock) or n in seen or stock[n - 1].qty < 1:
                continue
            seen.add(n)
            try:
                grams = min(500000, max(0, int(float(r.get("weight_g", 0)))))
            except (TypeError, ValueError):
                grams = 0
            used.append({"n": n, "qty": min(max(1, qty), stock[n - 1].qty), "weight_g": grams})
        unknown = [str(u).strip()[:80] for u in (raw.get("unknown") or []) if str(u).strip()][:20]
        return {"items": used, "unknown": unknown}
    return parse


@router.post("/ai/mpa/consumed")
async def consumed(body: ConsumedIn, user: dict = Depends(require_premium)):
    lines = "\n".join(f"{n}. {s.name} x{s.qty}" + (f" ({s.area})" if s.area else "") for n, s in enumerate(body.stock, 1))
    prompt = (f"The skipper says this was used:\n\"\"\"{body.text}\"\"\"\n\nFood and drink stores on board (number. name xquantity (area)):\n{lines}\n\n"
              "Match each thing used to the best store line. qty is how many of that line were used (whole units, never more than on board; "
              "'half the milk' with 1 on board means 1 only if it was finished, otherwise skip it). If the skipper names an area, prefer that area's line. "
              "weight_g is your estimate of the total weight used in grams. Put things that match no line in unknown. "
              'Return exactly: {"items": [{"n": 1, "qty": 2, "weight_g": 700}], "unknown": ["..."]}')
    result, left = await _run(user, "stores", prompt, parse_consumed(body.stock), {"chars": len(body.text)}, SYSTEM, "Magic Provisioning Assistant")
    return {**result, "asks_left": left}
