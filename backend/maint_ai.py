import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from json_repair import repair_json
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from db import db
from auth import require_premium
import quota
from usage import record_usage

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")
MAINT_KEYS = {"deckHardware": "Deck Hardware", "sailLoft": "Sail Loft", "runningRigging": "Running Rigging",
              "standingRigging": "Standing Rigging", "groundTackle": "Ground Tackle", "sparsHardware": "Spars & Heavy Hardware"}
LIST_HINTS = {"sparsHardware": "the structural spars and heavy fittings: mast, boom, rigid vang or kicker, spinnaker pole, whisker pole, bowsprit or prodder, "
              "spreaders, gooseneck, mast step, and where fitted the mizzen mast, davits and arch. Give each spar its make (mast maker), model or section, "
              "colour or finish, length, section diameter, weight and replacement cost. Always include the mast, boom, vang, spinnaker pole and bowsprit, "
              "even where they are common options rather than standard"}
KIND_DAILY = 30
KIND_SYSTEM = ("You are the Magic Mariner in the My Boat Prep app. You know boat makes and models. Decide whether the boat described is a sailing boat "
               "(mast and sails, including sailing catamarans, trimarans and motor-sailers) or not (motor boats, launches, RIBs, power catamarans). "
               'Reply with JSON only, no code fences: {"sailboat": true, "name": "short description, e.g. Beneteau Oceanis 38 sloop"}')
MAINT_SYSTEM = ("You are the Magic Mariner in the My Boat Prep app: an experienced rigger and boat surveyor helping a skipper set up maintenance lists "
                "for the gear on their sailing boat. Be realistic for the exact make, model and age given. Reply with JSON only, no prose and no code fences.")


class BoatIn(BaseModel):
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    boat_type: str = Field(default="", max_length=60)
    year_built: str = Field(default="", pattern=r"^(\d{4})?$")
    loa: str = Field(default="", max_length=8)
    units: str = Field(default="m", pattern="^(m|ft)$")


class AttrDef(BaseModel):
    key: str = Field(max_length=60, pattern=r"^[a-z0-9_]+$")
    name: str = Field(max_length=80)
    options: List[str] = Field(default=[], max_length=60)
    type: str = Field(default="", max_length=30)


class MaintIn(BoatIn):
    lists: List[str] = Field(min_length=1, max_length=6)
    attrs: Dict[str, List[AttrDef]] = {}
    currency: str = Field(default="", pattern=r"^([A-Z]{3})?$")


ESTIMATES = ("decimal weight", "decimal cost")
MEASURES = ("decimal length", "decimal area")


def _number(text: str):
    m = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    if not m:
        return None
    v = round(float(m.group(0).replace(",", "")), 2)
    return f"{v:g}" if 0 < v <= 999999.99 else None


def _boat(b: BoatIn) -> str:
    name = " ".join(x.strip() for x in (b.make, b.model) if x.strip())
    kind = b.boat_type.strip()
    return f"{name} ({kind})" if name and kind else name or kind


def _json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        fixed = repair_json(match.group(0), return_objects=True)
        if not isinstance(fixed, dict):
            raise
        return fixed


@router.post("/ai/boat-kind")
async def boat_kind(body: BoatIn, user: dict = Depends(require_premium)):
    """Is this a sailing boat? Cached per make/model/type, so it doesn't use the skipper's Magic allowance."""
    boat = _boat(body)
    if not (body.make.strip() and body.model.strip()):
        raise HTTPException(status_code=422, detail="Add your boat's make and model first")
    key = " ".join(x.strip() for x in (body.make, body.model, body.boat_type) if x.strip()).lower()
    key = " ".join(key.split())
    hit = await db.boat_kinds.find_one({"key": key}, {"_id": 0})
    if hit:
        return {"sailboat": hit["sailboat"], "name": hit["name"]}
    day = datetime.now(timezone.utc).date().isoformat()
    if await db.ai_drafts.count_documents({"user_id": user["user_id"], "kind": "boatkind", "created_at": {"$gte": day}}) >= KIND_DAILY:
        raise HTTPException(status_code=429, detail="The Magic Mariner has checked enough boats today. Try again tomorrow.")
    await db.ai_drafts.insert_one({"draft_id": str(uuid.uuid4()), "user_id": user["user_id"], "kind": "boatkind", "boat": boat[:180], "created_at": datetime.now(timezone.utc).isoformat()})
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"boatkind-{uuid.uuid4()}", system_message=KIND_SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    try:
        data = _json(await chat.send_message(UserMessage(text=f"Boat type: {body.boat_type or 'not given'}\nMake: {body.make}\nModel: {body.model}")))
        sail, name = bool(data.get("sailboat")), str(data.get("name") or boat).strip()[:120]
    except Exception:
        raise HTTPException(status_code=503, detail="The Magic Mariner couldn't check your boat right now. Please try again.")
    await db.boat_kinds.update_one({"key": key}, {"$set": {"key": key, "sailboat": sail, "name": name}}, upsert=True)
    await record_usage(user["user_id"], "MMM", None)
    return {"sailboat": sail, "name": name}


def _clean_attrs(raw, defs: List[AttrDef]) -> dict:
    out = {}
    by_key = {d.key: d for d in defs}
    for k, v in (raw or {}).items() if isinstance(raw, dict) else []:
        d, text = by_key.get(str(k)), str(v or "").strip()
        if not d or not text:
            continue
        if d.type in ESTIMATES or d.type in MEASURES:
            num = _number(text)
            if num:
                out[d.key] = num
        elif d.options:
            pick = next((o for o in d.options if o.lower() == text.lower()), None)
            if pick:
                out[d.key] = pick
        else:
            out[d.key] = text[:100]
    return out


def parse_maint(lists: List[str], defs: Dict[str, List[AttrDef]]):
    def parse(text: str) -> dict:
        raw = _json(text).get("lists", {})
        out = {}
        for key in lists:
            groups = []
            for g in (raw.get(key) or [])[:12] if isinstance(raw, dict) else []:
                heading = str((g or {}).get("heading", "")).strip()[:80]
                items = [{"label": str(i.get("label", "")).strip()[:200], "attrs": _clean_attrs(i.get("attrs"), defs.get(key, []))}
                         for i in (g.get("items") or [])[:15] if isinstance(i, dict) and str(i.get("label", "")).strip()] if heading else []
                if items:
                    groups.append({"heading": heading, "items": items})
            if groups:
                out[key] = groups
        if not out:
            raise ValueError("empty lists")
        return out
    return parse


@router.post("/ai/maint-lists")
async def maint_lists(body: MaintIn, user: dict = Depends(require_premium)):
    lists = [k for k in dict.fromkeys(body.lists) if k in MAINT_KEYS]
    if not lists or not (body.make.strip() and body.model.strip()):
        raise HTTPException(status_code=422, detail="Add your boat's make and model first")
    boat = _boat(body)
    extra = "".join([f", built {body.year_built}" if body.year_built else "", f", LOA {body.loa} {body.units}" if body.loa.strip() else ""])
    weight_unit = "lb" if body.units == "ft" else "kg"
    money = body.currency or "USD"

    imperial = body.units == "ft"

    def describe(d: AttrDef) -> str:
        if d.type == "decimal weight":
            return f"{d.key} (ALWAYS give your estimated weight of the item as a plain number in {weight_unit})"
        if d.type == "decimal cost":
            return f"{d.key} (ALWAYS give your estimated replacement cost, bought new today, as a plain number in {money})"
        if d.type == "decimal length":
            unit = ("inches" if imperial else "mm") if re.search("diameter|thickness", d.key) else ("feet" if imperial else "m")
            return f"{d.key} (a plain number in {unit}, where it applies to the item)"
        if d.type == "decimal area":
            return f"{d.key} (a plain number in {'sq ft' if imperial else 'sqm'}, where it applies to the item)"
        return d.key + (f" (one of: {', '.join(d.options)})" if d.options else "")

    def prompt_for(k: str) -> str:
        attrs = "; ".join(describe(d) for d in body.attrs.get(k, []))
        what = f"{MAINT_KEYS[k]}" + (f" ({LIST_HINTS[k]})" if k in LIST_HINTS else "")
        return (f"Boat: {boat}{extra}.\nMake the \"{k}\" maintenance list = {what}, of the gear this boat most likely has, as fitted from the factory plus common additions."
                + (f"\nAttributes: {attrs}" if attrs else "") +
                "\nGroup the list into a few categories (headings, e.g. 'Winches', 'Headsails', 'Halyards', 'Shrouds', 'Anchors', 'Mast') with the specific items under each "
                "(e.g. 'Primary winch - port', 'Genoa', 'Main halyard', 'Cap shroud - starboard', 'Primary anchor', 'Spinnaker pole'). At most 12 headings and 40 items. "
                "Fill every weight and cost attribute for every item with a realistic estimate for this boat's size; fill length, diameter and area where they apply "
                "with realistic figures for this boat; fill make, model, colour and the other attributes only when you are reasonably confident, using the exact option text. "
                "Valid JSON only: never put a double quote character inside a value (write inches as in, e.g. 1.5 in). "
                f'Return exactly: {{"lists": {{"{k}": [{{"heading": "...", "items": [{{"label": "...", "attrs": {{"<attribute key>": "..."}}}}]}}]}}}}')

    source = await quota.consume(user["user_id"])
    await db.ai_drafts.insert_one({"draft_id": str(uuid.uuid4()), "user_id": user["user_id"], "kind": "maint", "name": "Boat maintenance lists", "boat": boat[:120],
                                   "created_at": datetime.now(timezone.utc).isoformat()})

    async def one(k: str, tries: int = 2):
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"maint-{uuid.uuid4()}", system_message=MAINT_SYSTEM).with_model("gemini", "gemini-3-flash-preview")
        text, usage = "", None
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt_for(k))):
                if isinstance(ev, TextDelta):
                    text += ev.content
                elif isinstance(ev, StreamDone):
                    usage = ev.usage
                    break
            return parse_maint([k], body.attrs)(text)
        except Exception as e:
            log.error(f"Magic Mariner maintenance list {k} failed: {e}; reply={text[:200]!r}...{text[-300:]!r}")
            return await one(k, tries - 1) if tries > 1 else {}
        finally:
            if usage:
                await record_usage(user["user_id"], "MMM", usage)

    result = {}
    for part in await asyncio.gather(*(one(k) for k in lists)):
        result.update(part)
    if not result:
        await quota.refund(user["user_id"], source)
        raise HTTPException(status_code=503, detail="Magic Mariner maintenance lists couldn't do that right now. Please try again.")
    return {"lists": result, "asks_left": await quota.left(user["user_id"])}
