import asyncio
import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
from db import db
from auth import get_current_user, require_premium
from photos import APP_NAME, get_object, put_object
import quota
from usage import KIND_FEATURE, record_usage
from youtube_links import check_links, wants_youtube

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)
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
    description: str = Field(default="", max_length=4000, validate_default=True)

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
        items = [i for i in dict.fromkeys(str(x).strip()[:1000] for x in g.get("items", [])) if i and i.lower() not in seen] if heading else []
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


async def _run(user: dict, kind: str, prompt: str, parse, meta: dict, system: str = SYSTEM, label: str = "Magic List Generation", image: Optional[bytes] = None):
    source = await quota.consume(user["user_id"])
    draft_id = str(uuid.uuid4())
    await db.ai_drafts.insert_one({"draft_id": draft_id, "user_id": user["user_id"], "kind": kind, **meta, "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{kind}-{draft_id}", system_message=system).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    usage = None
    try:
        files = [ImageContent(image_base64=base64.b64encode(image).decode())] if image else None
        async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=files) if files else UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                usage = ev.usage
                break
        result = parse(text)
    except Exception as e:
        log.error(f"{label} ({kind}) failed: {e}; reply={text[:300]!r}")
        await db.ai_drafts.delete_one({"draft_id": draft_id})
        await quota.refund(user["user_id"], source)
        if usage:
            await record_usage(user["user_id"], KIND_FEATURE.get(kind, "MLG"), usage)
        raise HTTPException(status_code=503, detail=f"{label} couldn't do that right now. Please try again.")
    await record_usage(user["user_id"], KIND_FEATURE.get(kind, "MLG"), usage)
    return result, await quota.left(user["user_id"])


YOUTUBE_RULE = (
    "\nThe user asked for YouTube links. Put each link in the item text as a full address of a real, existing YouTube video or channel "
    "(https://www.youtube.com/watch?v=..., https://youtu.be/... or https://www.youtube.com/@channel). Copy any links the user gave exactly. "
    "Never invent or guess a video ID; if you don't know a real link for an item, leave the link out of that item."
)


@router.post("/ai/list-draft")
async def list_draft(body: DraftIn, user: dict = Depends(require_premium)):
    prompt = PROMPT.format(name=body.name.strip().replace('"', "'") or "New list", description=body.description.replace('"""', "'''"))
    youtube = wants_youtube(body.name, body.description)
    if youtube:
        prompt += YOUTUBE_RULE
    lines, left = await _run(user, "draft", prompt, to_lines, {"name": body.name.strip(), "description": body.description})
    if not youtube:
        return {"lines": lines, "drafts_left": left}
    return {"lines": lines, "drafts_left": left, "youtube": await check_links(lines)}


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
    description: str = Field(default="", max_length=4000)
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
        item = str((s or {}).get("item", "")).strip()[:1000]
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


PROVISIONER = ("You are the Magic Provisioning Assistant in the My Boat Prep app. You suggest practical shopping amounts for a boat trip. "
               "Allow sensible safety margins for drinking water. Children eat and drink about half as much as adults. Reply with JSON only, no prose and no code fences.")


class PetIn(BaseModel):
    type: str = Field(default="", max_length=40)
    name: str = Field(default="", max_length=60)
    breed: str = Field(default="", max_length=60)
    weight: str = Field(default="", max_length=8)


class ProvisionsIn(BaseModel):
    items: List[str] = Field(default_factory=list, max_length=120)
    on_board: dict = Field(default_factory=dict)
    adults: int = Field(ge=0, le=999)
    children: int = Field(ge=0, le=999)
    days: int = Field(ge=1, le=365)
    pets: List[PetIn] = Field(default_factory=list, max_length=20)
    units: str = Field(default="kg", pattern="^(kg|lb)$")

    @field_validator("items")
    @classmethod
    def trim_items(cls, v: list) -> list:
        return [s for s in dict.fromkeys(str(x).strip()[:80] for x in v) if s]

    @model_validator(mode="after")
    def need_something(self):
        self.pets = [p for p in self.pets if p.type.strip() or p.name.strip()]
        if not self.items and not self.pets:
            raise ValueError("Add at least one provision")
        return self


def pet_text(p: PetIn, units: str) -> str:
    bits = [p.type.strip() or "pet", p.breed.strip(), f"{p.weight} {units}" if p.weight.strip() else ""]
    return f"{p.name.strip() or 'Unnamed'} ({', '.join(b for b in bits if b)})"


def parse_provisions(text: str, names: list, pets: tuple = ()) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    data = json.loads(match.group(0))
    rows = data.get("items", [])
    wanted = {n.lower(): n for n in names}
    out = {}
    for r in rows if isinstance(rows, list) else []:
        name = wanted.get(str((r or {}).get("name", "")).strip().lower())
        if name:
            out[name] = str(r.get("amount", "")).strip()[:40]
    pet_names = {p.lower(): p for p in pets}
    pet_rows = []
    for r in data.get("pets", []) if isinstance(data.get("pets"), list) else []:
        item = str((r or {}).get("name", "")).strip()[:80]
        if item:
            who = str(r.get("for", "")).strip()
            pet_rows.append({"name": item, "amount": str(r.get("amount", "")).strip()[:40], "for": pet_names.get(who.lower(), who[:60])})
    if (names and not out) or (not names and not pet_rows):
        raise ValueError("no amounts")
    return {"amounts": out, "pets": pet_rows[:60]}


@router.post("/ai/mpa/provisions")
async def mpa_provisions(body: ProvisionsIn, user: dict = Depends(require_premium)):
    stock = {str(k)[:80]: v for k, v in list(body.on_board.items())[:120] if isinstance(v, (int, float))}
    pet_names = [p.name.strip() or "Unnamed" for p in body.pets]
    prompt = (f"Trip: {body.days} days, {body.adults} adults and {body.children} children on board.\n"
              f"Provisions to buy: {json.dumps(body.items)}\n"
              f"Already on board (count of each): {json.dumps(stock)}\n"
              "For each provision, give the amount still to buy for the whole trip after what is already on board, "
              "in shop-friendly units (e.g. '42 L', '3 dozen', '2 loaves', '6 x 250 g packs'). Use 'None needed' if what's on board is enough. ")
    shape = '{"items": [{"name": "<provision exactly as given>", "amount": "..."}]'
    if body.pets:
        prompt += (f"\nPets on board: {'; '.join(pet_text(p, body.units) for p in body.pets)}.\n"
                   "Also list the food and essential supplies each pet needs for the whole trip on a boat, sized by its type and weight "
                   "(e.g. dry food, wet food, treats, drinking water, poo bags or litter, a lifejacket for dogs, any regular medication reminder). "
                   "Up to 6 items per pet, with shop-friendly amounts. ")
        shape += ', "pets": [{"name": "<item>", "amount": "...", "for": "<pet name exactly as given>"}]'
    prompt += f"Return exactly: {shape}}}"
    result, left = await _run(user, "mpa", prompt, lambda t: parse_provisions(t, body.items, pet_names), {"name": "MPA provisions"}, PROVISIONER, "Magic Provisioning")
    return {"amounts": result["amounts"], "pets": result["pets"], "drafts_left": left}


DOCTOR = ("You are the Magic Marine Doctor in the My Boat Prep app: a calm, practical offshore first-aid adviser helping a boat skipper. "
          "Give clear first-aid steps in plain English as a short numbered list, using items from the boat's first aid kit where they help. "
          "Start with any danger signs that need urgent help. Adjust for children when relevant. Keep it under 250 words. Plain text only: no markdown, headings or asterisks. "
          "You are not a doctor and must not diagnose; always finish with exactly this line: "
          "'This is first-aid guidance only. In an emergency call Mayday on VHF channel 16 or the coastguard, and get medical help as soon as you can.'")
DOCTOR_FOOTER = "This is first-aid guidance only. In an emergency call Mayday on VHF channel 16 or the coastguard, and get medical help as soon as you can."
PET_DOCTOR = ("You are the Magic Marine Doctor in the My Boat Prep app, helping a boat skipper give first aid to a pet on board. "
              "Give clear pet first-aid steps in plain English as a short numbered list, suited to the animal's type, breed and weight, "
              "using items from the boat's first aid kit only where they are safe for that animal. Start with any danger signs that need a vet urgently. "
              "Never suggest human painkillers or medicines (e.g. paracetamol, ibuprofen, aspirin) unless they are known to be safe for that animal, and warn against them where relevant. "
              "Keep it under 250 words. Plain text only: no markdown, headings or asterisks. "
              "You are not a vet and must not diagnose; always finish with exactly this line: "
              "'This is pet first-aid guidance only. Contact a vet by phone or radio as soon as you can, and in a human emergency call Mayday on VHF channel 16.'")
PET_DOCTOR_FOOTER = "This is pet first-aid guidance only. Contact a vet by phone or radio as soon as you can, and in a human emergency call Mayday on VHF channel 16."


MMD_LOG_RULE = "Tick the box to agree your question and the Doctor's answer go in the Ship's Log"


class DoctorAskIn(BaseModel):
    question: str = Field(default="", max_length=1024, validate_default=True)
    kit_name: str = Field(default="First Aid Kit", max_length=80)
    kit: List[str] = Field(default_factory=list, max_length=150)
    adults: int = Field(default=1, ge=0, le=999)
    children: int = Field(default=0, ge=0, le=999)
    pet: Optional[PetIn] = None
    units: str = Field(default="kg", pattern="^(kg|lb)$")
    log_agree: bool = Field(default=False, validate_default=True)
    log_when: str = Field(default="", max_length=60)
    boat_id: str = Field(default="main", pattern=r"^[A-Za-z0-9_-]{1,40}$")
    owner_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,80}$")

    @field_validator("question")
    @classmethod
    def need_question(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Type a question for the Magic Marine Doctor first")
        return v.strip()

    @field_validator("log_agree")
    @classmethod
    def need_log_agree(cls, v: bool) -> bool:
        if not v:
            raise ValueError(MMD_LOG_RULE)
        return v


def parse_doctor(text: str, footer: str = DOCTOR_FOOTER) -> str:
    lines = [ln for ln in parse_answer(text).splitlines() if not any(k in ln.lower() for k in ("in an emergency call mayday", "first-aid guidance only", "in a human emergency call mayday"))]
    answer = "\n".join(lines).strip()
    if not answer:
        raise ValueError("empty answer")
    return f"{answer}\n\n{footer}"


PHOTO_RULE = ("\nA photo is attached. Look at it carefully: describe briefly what you can see that matters (a wound, burn, rash, swelling, bite, "
              "or a medicine or first-aid item and its label) and use it in your first-aid advice. If the photo is unclear or doesn't show the problem, say so.")


async def _doctor(body: DoctorAskIn, user: dict, image: Optional[bytes] = None):
    kit = ", ".join(str(k).strip()[:120] for k in body.kit if str(k).strip()) or "(not listed)"
    question = f'"""{body.question.replace(chr(34) * 3, chr(39) * 3)}"""'
    rule = PHOTO_RULE if image else ""
    if body.pet:
        prompt = f"First aid kit ({body.kit_name.strip()}): {kit}\nThe patient is a pet: {pet_text(body.pet, body.units)}\nThe skipper asks:\n{question}{rule}"
        return await _run(user, "doctor", prompt, lambda t: parse_doctor(t, PET_DOCTOR_FOOTER), {"question": body.question[:200], "pet": body.pet.type[:40]}, PET_DOCTOR, "Magic Marine Doctor pet answer", image)
    prompt = (f"First aid kit ({body.kit_name.strip()}): {kit}\nOn board: {body.adults} adults, {body.children} children\n"
              f"The skipper asks:\n{question}{rule}")
    return await _run(user, "doctor", prompt, parse_doctor, {"question": body.question[:200]}, DOCTOR, "Magic Marine Doctor answer", image)


async def _save_answer(user: dict, body: DoctorAskIn, answer: str, photo: Optional[dict] = None) -> dict:
    doc = {"answer_id": uuid.uuid4().hex, "user_id": user["user_id"], "question": body.question, "answer": answer, "kit_name": body.kit_name.strip(),
           "pet": body.pet.name.strip() if body.pet else "", "photo": photo, "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.doctor_answers.insert_one(doc)
    return _answer_out(doc)


def _answer_out(d: dict) -> dict:
    return {"id": d["answer_id"], "question": d["question"], "answer": d["answer"], "kit_name": d.get("kit_name", ""), "pet": d.get("pet", ""),
            "has_photo": bool(d.get("photo")), "created_at": d["created_at"]}


async def mmd_asker(user: dict, body: DoctorAskIn) -> Optional[str]:
    """'Skipper' for the boat's owner, else the crew member's name. Checked before the Doctor runs so no generation is wasted."""
    if not body.owner_id or body.owner_id == user["user_id"]:
        return "Skipper"
    doc = await db.user_boats.find_one({"owner_id": body.owner_id, "boat_id": body.boat_id, "crew": user["user_id"]}, {"_id": 0, f"crew_names.{user['user_id']}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return ((doc.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user.get("email") or "Crew").strip()[:80]


async def log_mmd(user: dict, body: DoctorAskIn, who: str, answer: str) -> dict:
    """Ship's Log entry for every Doctor question. Crew entries go straight onto the skipper's boat; the skipper's app adds its own."""
    now = datetime.now(timezone.utc)
    when = re.sub(r"[^\w ,:/.\-]", "", body.log_when).strip() or now.strftime("%d %b %Y %H:%M UTC")
    pet = f" about {body.pet.name.strip() or body.pet.type.strip() or 'a pet'}" if body.pet else ""
    item = {"id": int(now.timestamp() * 1000), "label": f"Magic Marine Doctor asked by {who}{pet} on {when}: {body.question}"[:2000],
            "mmd_answer": answer, "checked": False, "ts": now.isoformat()}
    if body.owner_id and body.owner_id != user["user_id"]:
        await db.user_boats.update_one({"owner_id": body.owner_id, "boat_id": body.boat_id, "crew": user["user_id"]},
                                       {"$push": {"data.shipsLog": item}, "$set": {"updated_at": now.isoformat()}})
    return item


@router.post("/ai/doctor-ask")
async def doctor_ask(body: DoctorAskIn, user: dict = Depends(require_premium)):
    who = await mmd_asker(user, body)
    answer, left = await _doctor(body, user)
    saved = await _save_answer(user, body, answer)
    return {"answer": answer, "asks_left": left, "saved": saved, "log_item": await log_mmd(user, body, who, answer)}


DOCTOR_PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DOCTOR_PHOTO_MAX = 5 * 1024 * 1024


@router.post("/ai/doctor-ask-photo")
async def doctor_ask_photo(payload: str = Form(...), file: UploadFile = File(...), user: dict = Depends(require_premium)):
    """Same as doctor-ask, with a photo the Doctor looks at; the photo is kept with the answer."""
    try:
        body = DoctorAskIn.model_validate_json(payload)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors()[0].get("msg", "Check the question").replace("Value error, ", ""))
    if file.content_type not in DOCTOR_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Please choose a JPEG, PNG or WebP photo")
    data = await file.read(DOCTOR_PHOTO_MAX + 1)
    if len(data) > DOCTOR_PHOTO_MAX:
        raise HTTPException(status_code=400, detail="That photo is too big (max 5 MB)")
    who = await mmd_asker(user, body)
    answer, left = await _doctor(body, user, data)
    photo = None
    try:
        path = f"{APP_NAME}/doctor-photos/{user['user_id']}/{uuid.uuid4()}.{DOCTOR_PHOTO_TYPES[file.content_type]}"
        result = await asyncio.to_thread(put_object, path, data, file.content_type)
        photo = {"path": result["path"], "content_type": file.content_type}
    except Exception as e:
        log.error(f"Doctor photo save failed: {e}")
    saved = await _save_answer(user, body, answer, photo)
    return {"answer": answer, "asks_left": left, "saved": saved, "photo_saved": bool(photo), "log_item": await log_mmd(user, body, who, answer)}


@router.get("/ai/doctor-history")
async def doctor_history(user: dict = Depends(get_current_user)):
    docs = await db.doctor_answers.find({"user_id": user["user_id"], "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"answers": [_answer_out(d) for d in docs]}


@router.get("/ai/doctor-history/{answer_id}/photo")
async def doctor_photo(answer_id: str, user: dict = Depends(get_current_user)):
    d = await db.doctor_answers.find_one({"answer_id": answer_id, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0, "photo": 1})
    if not d or not d.get("photo"):
        raise HTTPException(status_code=404, detail="Photo not found")
    try:
        data = await asyncio.to_thread(get_object, d["photo"]["path"])
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't load the photo, please try again")
    return Response(content=data, media_type=d["photo"]["content_type"], headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/ai/doctor-history/{answer_id}")
async def doctor_forget(answer_id: str, user: dict = Depends(get_current_user)):
    res = await db.doctor_answers.update_one({"answer_id": answer_id, "user_id": user["user_id"]}, {"$set": {"is_deleted": True}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Answer not found")
    return {"ok": True}


class PetKitIn(BaseModel):
    pets: List[PetIn] = Field(min_length=1, max_length=20)
    units: str = Field(default="kg", pattern="^(kg|lb)$")
    days: int = Field(default=0, ge=0, le=365)


@router.post("/ai/pet-kit")
async def pet_kit(body: PetKitIn, user: dict = Depends(require_premium)):
    pets = [p for p in body.pets if p.type.strip() or p.name.strip()]
    if not pets:
        raise HTTPException(status_code=422, detail="Add a pet's type or name first")
    trip = f" for a {body.days}-day trip" if body.days else ""
    description = (f"A pet first aid kit to keep on a boat{trip}, for these pets: {'; '.join(pet_text(p, body.units) for p in pets)}. "
                   "Use one heading per pet (its name and type), plus a 'Shared' heading for items all the pets can use. "
                   "Size bandages, dressings, muzzles, booties and any doses to each pet's type, breed and weight, and give amounts. "
                   "Include a vet contact and pet records reminder. Only include medicines that are safe for that animal, and say 'vet-approved' where a vet should prescribe them.")
    prompt = PROMPT.format(name="First Aid Kit - Pets", description=description)
    lines, left = await _run(user, "draft", prompt, to_lines, {"name": "First Aid Kit - Pets", "description": description[:300]})
    return {"lines": lines, "description": description, "drafts_left": left}


class AislesIn(BaseModel):
    items: List[str] = Field(min_length=1, max_length=150)
    aisles: List[str] = Field(min_length=1, max_length=20)


@router.post("/ai/mpa/aisles")
async def mpa_aisles(body: AislesIn, user: dict = Depends(require_premium)):
    items = [s for s in dict.fromkeys(str(x).strip()[:80] for x in body.items) if s]
    aisles = [str(a).strip()[:40] for a in body.aisles if str(a).strip()]
    if not items or not aisles:
        raise HTTPException(status_code=422, detail="Nothing to sort")
    prompt = (f"Supermarket aisles: {json.dumps(aisles)}\nShopping items: {json.dumps(items)}\n"
              'Put each item in the best aisle. Return exactly: {"items": [{"name": "<item exactly as given>", "amount": "<aisle exactly as given>"}]}')

    def parse(t: str) -> dict:
        got = parse_provisions(t, items)["amounts"]
        return {k: v for k, v in got.items() if v in aisles}
    mapping, left = await _run(user, "mpa", prompt, parse, {"name": "MPA aisles"}, PROVISIONER, "Magic Provisioning")
    return {"aisles": mapping, "drafts_left": left}


NAVIGATOR = ("You are the Magic Marine Navigator in the My Boat Prep app: an experienced cruising navigator helping a skipper plan a passage. "
             "Suggest a sensible route from START to DESTINATION as a short numbered list of legs with approximate distances in nautical miles, "
             "key waypoints or headlands, hazards to keep clear of, tidal gates or current to time, and good anchorages or shelter on the way. "
             "Take the boat's draft, mast height and size into account (bridges, shallows) and the crew on board. Keep the answer under 300 words. "
             "The answer is plain text only: no markdown, headings or asterisks; put each numbered leg on its own line using \\n line breaks. "
             "Also give the route as waypoints with approximate latitude and longitude in decimal degrees, starting at START and ending at DESTINATION, "
             "each in navigable water and in order along the route (2 to 20 waypoints), plus the total distance and an estimated passage time for this boat. "
             "Reply with JSON only, no code fences: "
             '{"answer": "<plain text answer>", "waypoints": [{"name": "<place>", "lat": <number>, "lon": <number>}], '
             '"distance_nm": <number>, "passage_time": "<e.g. about 9 hours at 6 knots>"}')
NAV_FOOTER = "Suggested route only. Check official charts, notices to mariners, tides and the latest weather before you sail."


class NavBoat(BaseModel):
    boat_type: str = Field(default="", max_length=60)
    units: str = Field(default="m", max_length=2)
    loa: str = Field(default="", max_length=10)
    beam: str = Field(default="", max_length=10)
    draft: str = Field(default="", max_length=10)
    mast_height: str = Field(default="", max_length=10)
    pob: int = Field(default=1, ge=0, le=999)
    children: int = Field(default=0, ge=0, le=999)
    trip_days: int = Field(default=0, ge=0, le=365)


class NavigatorAskIn(BaseModel):
    question: str = Field(default="", max_length=1024)
    start: str = Field(default="", max_length=80, validate_default=True)
    destination: str = Field(default="", max_length=80, validate_default=True)
    boat: NavBoat = Field(default_factory=NavBoat)
    items: List[str] = Field(default_factory=list, max_length=150)

    @field_validator("start", "destination")
    @classmethod
    def need_place(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("The Magic Marine Navigator needs both a START and a DESTINATION")
        return v.strip()


def _waypoints(raw) -> list:
    out = []
    for w in raw if isinstance(raw, list) else []:
        try:
            lat, lon = float(w["lat"]), float(w["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            out.append({"name": str(w.get("name", "")).strip()[:80], "lat": round(lat, 5), "lon": round(lon, 5)})
    return out[:20] if len(out) >= 2 else []


def parse_navigator(text: str) -> dict:
    data = {}
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            data = json.loads(m.group(0))
        except ValueError:
            data = {}
    raw = data.get("answer") if isinstance(data, dict) and data.get("answer") else text
    lines = [ln.strip() for ln in parse_answer(str(raw)).splitlines() if "suggested route only" not in ln.lower()]
    answer = "\n".join(lines).strip()
    if not answer or answer.startswith("{"):
        raise ValueError("empty answer")
    try:
        dist = round(float(data.get("distance_nm")), 1) if data.get("distance_nm") is not None else None
    except (TypeError, ValueError):
        dist = None
    return {"answer": f"{answer}\n\n{NAV_FOOTER}", "waypoints": _waypoints(data.get("waypoints")),
            "distance_nm": dist, "passage_time": str(data.get("passage_time") or "").strip()[:80]}


@router.post("/ai/navigator-ask")
async def navigator_ask(body: NavigatorAskIn, user: dict = Depends(require_premium)):
    b = body.boat
    u = "ft" if b.units == "ft" else "m"
    dims = ", ".join(f"{k} {v} {u}" for k, v in (("LOA", b.loa), ("beam", b.beam), ("draft", b.draft), ("mast height", b.mast_height)) if v)
    kids = min(b.children, b.pob)
    crew = f"{b.pob} on board ({b.pob - kids} adults, {kids} children)" if kids else f"{b.pob} on board"
    checks = "; ".join(str(i).strip()[:120] for i in body.items if str(i).strip()) or "(none listed)"
    prompt = (f"START: {body.start}\nDESTINATION: {body.destination}\n"
              f"Boat: {b.boat_type.strip() or 'type not given'}{', ' + dims if dims else ''}. Crew: {crew}. Trip: {b.trip_days or 'not set'} days.\n"
              f"The skipper's Route Planning checklist: {checks}\n"
              f'The skipper adds:\n"""{body.question.strip().replace(chr(34) * 3, chr(39) * 3) or "(nothing)"}"""')
    result, left = await _run(user, "navigator", prompt, parse_navigator, {"question": f"{body.start} to {body.destination}"[:200]}, NAVIGATOR, "Magic Marine Navigator answer")
    return {**result, "asks_left": left}


BUDGETER = ("You are the Magic Mariner in the My Boat Prep app: an experienced boat owner helping a skipper budget for owning their boat. "
            "Answer with a realistic yearly running-cost estimate for the boat described: a likely total range per year, then the main costs "
            "(berth or mooring, insurance, haul out and antifouling, engine and rigging servicing, safety gear, fuel, sundries) with rough amounts. "
            "Use the currency given. Keep it under 120 words, plain text only: no markdown, headings or asterisks, one cost per line. "
            "End with one short tip for keeping costs down.")


class BudgetIn(BaseModel):
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    boat_type: str = Field(default="", max_length=60)
    currency: str = Field(default="", max_length=3)
    loa: str = Field(default="", max_length=8)
    units: str = Field(default="m", pattern="^(m|ft)$")


def parse_budget(text: str) -> str:
    answer = re.sub(r"[*#`]+", "", parse_answer(text)).strip()
    if not answer:
        raise ValueError("empty answer")
    return answer[:3000]


@router.post("/ai/budget")
async def budget_comments(body: BudgetIn, user: dict = Depends(require_premium)):
    boat = " ".join(x.strip() for x in (body.make, body.model, body.boat_type) if x.strip())
    if not (body.make.strip() or body.model.strip()):
        raise HTTPException(status_code=422, detail="Add your boat's make and model first")
    prompt = f"How much a year should I budget for {boat} per year?"
    if body.loa.strip():
        prompt += f"\nLength overall: {body.loa.strip()} {body.units}"
    prompt += f"\nCurrency: {body.currency.strip().upper() or 'the local currency, named'}"
    answer, left = await _run(user, "budget", prompt, parse_budget, {"name": "Boat budget", "boat": boat[:120]}, BUDGETER, "Magic Mariner budgeting")
    return {"answer": answer, "asks_left": left}


PASSAGE = ("You are the Magic Mariner in the My Boat Prep app, helping a skipper plan fuel for a motoring passage. "
           "Estimate the sea-route distance in nautical miles between the start and destination (by water, around headlands, not a straight line), "
           "and the engine's fuel use per hour at the given cruising speed for this boat and engine. Be realistic and slightly conservative. "
           'Reply with JSON only, no code fences: {"distance_nm": 0, "fuel_rate": 0, "notes": "one or two short plain sentences on your assumptions"}')


class PassageIn(BaseModel):
    start: str = Field(min_length=1, max_length=80)
    dest: str = Field(min_length=1, max_length=80)
    engine_type: str = Field(default="", max_length=80)
    cruise_kn: float = Field(default=6, gt=0, le=60)
    boat_type: str = Field(default="", max_length=60)
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    loa: str = Field(default="", max_length=8)
    units: str = Field(default="m", pattern="^(m|ft)$")
    tank_units: str = Field(default="L", pattern="^(L|gal)$")


def parse_passage(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no json")
    d = json.loads(match.group(0))
    dist, rate = float(d.get("distance_nm") or 0), float(d.get("fuel_rate") or 0)
    if not (0 < dist <= 5000 and 0 < rate <= 500):
        raise ValueError("bad numbers")
    return {"distance_nm": round(dist, 1), "fuel_rate": round(rate, 1), "notes": re.sub(r"[*#`]+", "", str(d.get("notes") or "")).strip()[:400]}


@router.post("/ai/passage")
async def passage_estimate(body: PassageIn, user: dict = Depends(require_premium)):
    unit = "US gallons" if body.tank_units == "gal" else "litres"
    boat = " ".join(x.strip() for x in (body.make, body.model, body.boat_type) if x.strip()) or "a cruising boat"
    prompt = (f"Start: {body.start.strip()}\nDestination: {body.dest.strip()}\nBoat: {boat}"
              + (f", LOA {body.loa.strip()} {body.units}" if body.loa.strip() else "")
              + f"\nEngine: {body.engine_type.strip() or 'not recorded (assume a typical diesel for this boat)'}"
              + f"\nCruising speed: {body.cruise_kn:g} knots\nGive fuel_rate in {unit} per hour.")
    est, left = await _run(user, "passage", prompt, parse_passage, {"name": "Passage fuel plan", "route": f"{body.start} to {body.dest}"[:120]}, PASSAGE, "Magic Mariner passage plan")
    return {**est, "asks_left": left}
