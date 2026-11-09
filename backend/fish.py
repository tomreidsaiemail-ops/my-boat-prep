import asyncio
import json
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Response, UploadFile
from auth import get_current_user, require_premium
from ai_lists import _run
from db import db
from photos import APP_NAME, MAX_BYTES, TYPES, get_object, put_object
import quota

router = APIRouter(prefix="/api")
CatchId = Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")]
MAX_CATCHES = 500
FISH = (
    "You are the Magic Fish Whisperer in the My Boat Prep app: a friendly, practical expert on fish, local fishing and seafood for recreational boaties. "
    "You get a photo of a fish someone has just caught and, when known, the GPS position and date. "
    "Name the species and explain why: the visible features in the photo that point to it. List close or similar species and how to tell them apart. "
    "Estimate the length (use anything in the photo for scale, like hands, a deck, a bucket or a lure) and estimate the weight from the length. "
    "Use the GPS position to name the area and give useful local fishing knowledge. Give the fishing rules that usually apply there "
    "(minimum sizes, bag limits, seasons, protected species, rāhui or closures) for the local area and for the country, and say they must be checked "
    "with the local authority because rules change. Give real official information sources (the fisheries authority, its app or website) with real https links only; "
    "never invent a link. Give questions the fisher should ask the local authority. Recommend a filleting technique as short steps, things to be careful of "
    "(spines, teeth, stings, bones) and protection to use (gloves, cut-resistant gloves, eye protection). Warn clearly about any poison or toxin risk "
    "(e.g. puffer fish tetrodotoxin, ciguatera, scombroid) and say never to eat a fish you are unsure is safe. Recommend a good batter for a fillet "
    "with ingredients and steps, and say whether it is suitable for sushi or sashimi and why (parasites, freezing, freshness). "
    "Suggest one meal using this fish for a meal plan. "
    "Shellfish and other seafood (e.g. scallops, mussels, oysters, cockles, pipi, paua, kina, crayfish, crabs, squid, octopus) are welcome too: set \"kind\" to \"shellfish\" and "
    "name the species, estimate the size (and count if there are several), give the local shellfish bag limits, minimum sizes, accumulation limits and seasonal closures, "
    "and warn clearly about biotoxins (paralytic, amnesic, diarrhetic shellfish poisoning), red tide or algal bloom warnings, and safe gathering rules "
    "(check current public health warnings before gathering, avoid polluted water, stormwater, marinas and after heavy rain, keep them cold, measure before taking). "
    "For shellfish put cleaning, shucking or preparing steps in \"filleting\", give up to 3 cooking methods in \"cooking\" (e.g. steaming, garlic butter, grilling) "
    "instead of a batter, and in \"sushi\" say whether it is safe to eat raw. "
    'Reply with JSON only, no code fences: {"not_fish": false, "message": "", "kind": "fish|shellfish", '
    '"species": {"common_name": "", "scientific_name": "", "other_names": [""], "confidence": "high|medium|low", "reasons": [""]}, '
    '"similar": [{"name": "", "difference": ""}], "size": {"length_cm": 0, "weight_kg": 0, "how": ""}, '
    '"place": {"name": "", "notes": [""]}, "local_knowledge": [""], "regulations": {"local": [""], "national": [""]}, '
    '"sources": [{"name": "", "url": "https://..."}], "questions": [""], '
    '"filleting": {"steps": [""], "careful": [""], "protection": [""]}, "toxins": [""], '
    '"batter": {"name": "", "ingredients": [""], "steps": [""]}, "sushi": {"suitable": false, "why": ""}, '
    '"meal": {"name": "", "meal_type": "lunch|dinner", "recipe": "", "ingredients": [""]}, '
    '"safety": {"biotoxins": [""], "gathering": [""]}, "cooking": [{"name": "", "ingredients": [""], "steps": [""]}]}. Use "safety" and "cooking" for shellfish; size may add "count". '
    'If the photo does not show a fish, shellfish or other seafood, reply {"not_fish": true, "message": "<what you can see and a tip for a better photo>"}.'
)


def _s(x, n: int = 300) -> str:
    return " ".join(str(x or "").split())[:n]


def _l(x, n: int = 12, m: int = 400) -> list:
    return [s for s in (_s(i, m) for i in (x if isinstance(x, list) else [])) if s][:n]


def _num(x, top: float) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return (round(v, 2) or None) if 0 < v <= top else None


def _d(x) -> dict:
    return x if isinstance(x, dict) else {}


def parse_fish(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    r = json.loads(match.group(0))
    if r.get("not_fish") is True:
        return {"not_fish": True, "message": _s(r.get("message"), 400) or "That doesn't look like a fish or shellfish. Try a clear photo of your whole catch."}
    sp, size, place, regs, fil, bat, sushi, meal, safe = (_d(r.get(k)) for k in ("species", "size", "place", "regulations", "filleting", "batter", "sushi", "meal", "safety"))
    name = _s(sp.get("common_name"), 80)
    if not name:
        raise ValueError("no species")
    conf = sp.get("confidence") if sp.get("confidence") in ("high", "medium", "low") else "medium"
    sources = [{"name": _s(s.get("name"), 100) or _s(s.get("url"), 100), "url": _s(s.get("url"), 300)} for s in (r.get("sources") or []) if isinstance(s, dict)]
    return {
        "not_fish": False,
        "kind": "shellfish" if r.get("kind") == "shellfish" else "fish",
        "safety": {"biotoxins": _l(safe.get("biotoxins"), 8), "gathering": _l(safe.get("gathering"), 10)},
        "cooking": [{"name": _s(c.get("name"), 80), "ingredients": _l(c.get("ingredients"), 15, 120), "steps": _l(c.get("steps"), 10)}
                    for c in (r.get("cooking") or []) if isinstance(c, dict) and _s(c.get("name"))][:3],
        "species": {"common_name": name, "scientific_name": _s(sp.get("scientific_name"), 100), "other_names": _l(sp.get("other_names"), 6, 60),
                    "confidence": conf, "reasons": _l(sp.get("reasons"), 8)},
        "similar": [{"name": _s(s.get("name"), 80), "difference": _s(s.get("difference"), 300)} for s in (r.get("similar") or []) if isinstance(s, dict) and _s(s.get("name"))][:6],
        "size": {"length_cm": _num(size.get("length_cm"), 600), "weight_kg": _num(size.get("weight_kg"), 1000), "count": int(_num(size.get("count"), 500) or 0) or None, "how": _s(size.get("how"), 400)},
        "place": {"name": _s(place.get("name"), 120), "notes": _l(place.get("notes"), 6)},
        "local_knowledge": _l(r.get("local_knowledge"), 10),
        "regulations": {"local": _l(regs.get("local"), 10), "national": _l(regs.get("national"), 10)},
        "sources": [s for s in sources if s["url"].startswith("https://")][:8],
        "questions": _l(r.get("questions"), 8),
        "filleting": {"steps": _l(fil.get("steps"), 12), "careful": _l(fil.get("careful"), 8), "protection": _l(fil.get("protection"), 8)},
        "toxins": _l(r.get("toxins"), 6),
        "batter": {"name": _s(bat.get("name"), 80), "ingredients": _l(bat.get("ingredients"), 15, 120), "steps": _l(bat.get("steps"), 10)},
        "sushi": {"suitable": sushi.get("suitable") is True, "why": _s(sushi.get("why"), 400)},
        "meal": {"name": _s(meal.get("name"), 80), "meal_type": meal.get("meal_type") if meal.get("meal_type") in ("breakfast", "lunch", "dinner") else "dinner",
                 "recipe": _s(meal.get("recipe"), 1000), "ingredients": _l(meal.get("ingredients"), 30, 120)},
    }


def _out(d: dict) -> dict:
    return {k: d.get(k) for k in ("catch_id", "created_at", "lat", "lon", "position", "report", "note")}


@router.post("/ai/fish")
async def fish_whisperer(file: UploadFile = File(...), lat: Optional[float] = Form(None, ge=-90, le=90), lon: Optional[float] = Form(None, ge=-180, le=180),
                         position: str = Form("", max_length=80), when: str = Form("", max_length=40), caught_at: str = Form("", max_length=40),
                         note: str = Form("", max_length=300), weight_kg: Optional[float] = Form(None, gt=0, le=1500),
                         boat_id: str = Form("", pattern=r"^[A-Za-z0-9_-]{0,40}$"), owner_id: str = Form("", pattern=r"^[A-Za-z0-9_-]{0,80}$"),
                         user: dict = Depends(require_premium)):
    if file.content_type not in TYPES:
        raise HTTPException(status_code=400, detail="Please take a JPEG, PNG or WebP photo")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="That photo is too big (max 3 MB)")
    where = f"Caught at latitude {lat:.5f}, longitude {lon:.5f}." if lat is not None and lon is not None else "The GPS position isn't known, so give general advice and say where rules depend on location."
    prompt = f"{where}\nLocal date and time: {_s(when, 40) or 'unknown'}.\nIdentify this catch and give the full Magic Fish Whisperer report."
    note = _s(note, 300)
    if weight_kg:
        prompt += f"\nThe skipper weighed it at {weight_kg:g} kg; use that weight."
    if note:
        prompt += f"\nThe skipper's note: {note}"
    before = (await db.magic_quota.find_one({"user_id": user["user_id"]}, {"_id": 0, "free_used": 1}) or {}).get("free_used", 0)
    report, left = await _run(user, "fish", prompt, parse_fish, {"name": "Magic Fish Whisperer", "count": 1}, FISH, "The Magic Fish Whisperer", image=data)
    if report["not_fish"]:
        after = (await db.magic_quota.find_one({"user_id": user["user_id"]}, {"_id": 0, "free_used": 1}) or {}).get("free_used", 0)
        await quota.refund(user["user_id"], "free" if after > before else "purchased")
        return {"not_fish": True, "message": report["message"], "asks_left": await quota.left(user["user_id"])}
    catch_id = uuid.uuid4().hex
    if weight_kg:  # The skipper's own weight replaces the AI's estimate.
        report["size"] = {**(report.get("size") or {}), "weight_kg": round(weight_kg, 3), "weighed": True}
    now = datetime.now(timezone.utc)
    try:  # Photos queued offline keep the time they were taken.
        taken = datetime.fromisoformat(caught_at.replace("Z", "+00:00")) if caught_at else None
        taken = taken if taken and taken.tzinfo and now - timedelta(days=90) <= taken <= now + timedelta(minutes=5) else None
    except ValueError:
        taken = None
    try:
        stored = await asyncio.to_thread(put_object, f"{APP_NAME}/catches/{user['user_id']}/{catch_id}.{TYPES[file.content_type]}", data, file.content_type)
    except requests.RequestException:
        stored = None
    doc = {"catch_id": catch_id, "user_id": user["user_id"], "photo_path": (stored or {}).get("path"), "content_type": file.content_type, "lat": lat, "lon": lon,
           "position": _s(position, 80), "report": report, "is_deleted": False, "created_at": (taken or now).isoformat(), **({"note": note} if note else {}),
           **({"identified_at": now.isoformat()} if taken else {})}
    await db.fish_catches.insert_one(doc)
    log_item = await log_catch(user, boat_id, owner_id, doc, _s(when, 40))
    return {"catch": {**_out(doc), "has_photo": bool(stored)}, "asks_left": left, "log_item": log_item}


def catch_label(doc: dict, who: str, when: str) -> str:
    r = doc["report"]
    sp, size = r["species"], r["size"]
    name = sp["common_name"] + (f" ({sp['scientific_name']})" if sp.get("scientific_name") else "")
    bits = [f"{size['count']} of them" if (size.get("count") or 0) > 1 else "", f"{size['length_cm']:g} cm" if size.get("length_cm") else "",
            f"{'weighed' if size.get('weighed') else 'about'} {size['weight_kg']:g} kg" if size.get("weight_kg") else ""]
    pos = doc.get("position") or (f"{doc['lat']:.5f}, {doc['lon']:.5f}" if doc.get("lat") is not None and doc.get("lon") is not None else "")
    where = ", ".join(x for x in (r["place"].get("name"), pos and f"position {pos}") if x)
    return (f"Catch on {when or datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')} by {who}: {name}"
            + (f", {', '.join(b for b in bits if b)}" if any(bits) else "") + (f", at {where}" if where else "") + ". Identified by the Magic Fish Whisperer."
            + (f" Note: {doc['note']}" if doc.get("note") else ""))[:2000]


async def log_catch(user: dict, boat_id: str, owner_id: str, doc: dict, when: str):
    """Every catch goes straight into the Ship's Log of the boat it was caught on; crew catches go in the skipper's log."""
    if not boat_id:
        return None
    crew = bool(owner_id and owner_id != user["user_id"])
    key = {"owner_id": owner_id, "boat_id": boat_id, "crew": user["user_id"]} if crew else {"owner_id": user["user_id"], "boat_id": boat_id}
    who = "Skipper"
    if crew:
        boat = await db.user_boats.find_one(key, {"_id": 0, f"crew_names.{user['user_id']}": 1})
        if not boat:
            return None
        who = ((boat.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user.get("email") or "Crew").strip()[:80]
    now = datetime.now(timezone.utc)
    item = {"id": int(now.timestamp() * 1000) * 1000 + secrets.randbelow(1000), "label": catch_label(doc, who, re.sub(r"[^\w ,:/.\-]", "", when).strip()),
            "catch_id": doc["catch_id"], "checked": False, "ts": now.isoformat()}
    res = await db.user_boats.update_one({**key, "data.shipsLog": {"$exists": True}},
                                         {"$push": {"data.shipsLog": item, "pushed_items": {"list": "shipsLog", "item": item}}, "$set": {"updated_at": now.isoformat()}})
    return item if res.matched_count else None


@router.get("/me/catches")
async def my_catches(user: dict = Depends(get_current_user)):
    docs = await db.fish_catches.find({"user_id": user["user_id"], "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(MAX_CATCHES)
    return {"catches": [{**_out(d), "has_photo": bool(d.get("photo_path"))} for d in docs]}


@router.get("/me/catches/{catch_id}/photo")
async def catch_photo(catch_id: CatchId, user: dict = Depends(get_current_user)):
    d = await db.fish_catches.find_one({"catch_id": catch_id, "user_id": user["user_id"], "is_deleted": False}, {"_id": 0, "photo_path": 1, "content_type": 1})
    if not d or not d.get("photo_path"):
        raise HTTPException(status_code=404, detail="No photo")
    try:
        data = await asyncio.to_thread(get_object, d["photo_path"])
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Couldn't load the photo")
    return Response(content=data, media_type=d["content_type"], headers={"Cache-Control": "private, max-age=604800"})


@router.delete("/me/catches/{catch_id}")
async def delete_catch(catch_id: CatchId, user: dict = Depends(get_current_user)):
    res = await db.fish_catches.update_one({"catch_id": catch_id, "user_id": user["user_id"], "is_deleted": False}, {"$set": {"is_deleted": True}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Catch not found")
    return {"ok": True}
