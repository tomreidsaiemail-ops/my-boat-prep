import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from db import db
from auth import require_premium
import quota
from usage import KIND_FEATURE, record_usage

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


async def _run(user: dict, kind: str, prompt: str, parse, meta: dict, system: str = SYSTEM, label: str = "Magic List Generation"):
    source = await quota.consume(user["user_id"])
    draft_id = str(uuid.uuid4())
    await db.ai_drafts.insert_one({"draft_id": draft_id, "user_id": user["user_id"], "kind": kind, **meta, "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{kind}-{draft_id}", system_message=system).with_model("gemini", "gemini-3-flash-preview")
    text = ""
    usage = None
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
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


PROVISIONER = ("You are the Marine Magic Provisioning Assistant in the My Boat Prep app. You suggest practical shopping amounts for a boat trip. "
               "Allow sensible safety margins for drinking water. Children eat and drink about half as much as adults. Reply with JSON only, no prose and no code fences.")


class ProvisionsIn(BaseModel):
    items: List[str] = Field(min_length=1, max_length=120)
    on_board: dict = Field(default_factory=dict)
    adults: int = Field(ge=0, le=999)
    children: int = Field(ge=0, le=999)
    days: int = Field(ge=1, le=365)

    @field_validator("items")
    @classmethod
    def trim_items(cls, v: list) -> list:
        items = [s for s in dict.fromkeys(str(x).strip()[:80] for x in v) if s]
        if not items:
            raise ValueError("Add at least one provision")
        return items


def parse_provisions(text: str, names: list) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    rows = json.loads(match.group(0)).get("items", [])
    wanted = {n.lower(): n for n in names}
    out = {}
    for r in rows if isinstance(rows, list) else []:
        name = wanted.get(str((r or {}).get("name", "")).strip().lower())
        if name:
            out[name] = str(r.get("amount", "")).strip()[:40]
    if not out:
        raise ValueError("no amounts")
    return out


@router.post("/ai/mpa/provisions")
async def mpa_provisions(body: ProvisionsIn, user: dict = Depends(require_premium)):
    stock = {str(k)[:80]: v for k, v in list(body.on_board.items())[:120] if isinstance(v, (int, float))}
    prompt = (f"Trip: {body.days} days, {body.adults} adults and {body.children} children on board.\n"
              f"Provisions to buy: {json.dumps(body.items)}\n"
              f"Already on board (count of each): {json.dumps(stock)}\n"
              "For each provision, give the amount still to buy for the whole trip after what is already on board, "
              "in shop-friendly units (e.g. '42 L', '3 dozen', '2 loaves', '6 x 250 g packs'). Use 'None needed' if what's on board is enough. "
              'Return exactly: {"items": [{"name": "<provision exactly as given>", "amount": "..."}]}')
    amounts, left = await _run(user, "mpa", prompt, lambda t: parse_provisions(t, body.items), {"name": "MPA provisions"}, PROVISIONER, "Magic Provisioning")
    return {"amounts": amounts, "drafts_left": left}


DOCTOR = ("You are the Magic Marine Doctor in the My Boat Prep app: a calm, practical offshore first-aid adviser helping a boat skipper. "
          "Give clear first-aid steps in plain English as a short numbered list, using items from the boat's first aid kit where they help. "
          "Start with any danger signs that need urgent help. Adjust for children when relevant. Keep it under 250 words. Plain text only: no markdown, headings or asterisks. "
          "You are not a doctor and must not diagnose; always finish with exactly this line: "
          "'This is first-aid guidance only. In an emergency call Mayday on VHF channel 16 or the coastguard, and get medical help as soon as you can.'")
DOCTOR_FOOTER = "This is first-aid guidance only. In an emergency call Mayday on VHF channel 16 or the coastguard, and get medical help as soon as you can."


class DoctorAskIn(BaseModel):
    question: str = Field(default="", max_length=1024, validate_default=True)
    kit_name: str = Field(default="First Aid Kit", max_length=80)
    kit: List[str] = Field(default_factory=list, max_length=150)
    adults: int = Field(default=1, ge=0, le=999)
    children: int = Field(default=0, ge=0, le=999)

    @field_validator("question")
    @classmethod
    def need_question(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Type a question for the Magic Marine Doctor first")
        return v.strip()


def parse_doctor(text: str) -> str:
    lines = [ln for ln in parse_answer(text).splitlines() if "in an emergency call mayday" not in ln.lower() and "first-aid guidance only" not in ln.lower()]
    answer = "\n".join(lines).strip()
    if not answer:
        raise ValueError("empty answer")
    return f"{answer}\n\n{DOCTOR_FOOTER}"


@router.post("/ai/doctor-ask")
async def doctor_ask(body: DoctorAskIn, user: dict = Depends(require_premium)):
    kit = ", ".join(str(k).strip()[:120] for k in body.kit if str(k).strip()) or "(not listed)"
    prompt = (f"First aid kit ({body.kit_name.strip()}): {kit}\nOn board: {body.adults} adults, {body.children} children\n"
              f'The skipper asks:\n"""{body.question.replace(chr(34) * 3, chr(39) * 3)}"""')
    answer, left = await _run(user, "doctor", prompt, parse_doctor, {"question": body.question[:200]}, DOCTOR, "Magic Marine Doctor answer")
    return {"answer": answer, "asks_left": left}


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
        got = parse_provisions(t, items)
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
