import asyncio
import base64
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from db import db
from auth import require_premium
import quota
from photos import APP_NAME, get_object, put_object
from inventory import MAX_BOAT_MAPS, boat_maps

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
SearchPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
SEARCH_URL = "https://www.googleapis.com/customsearch/v1"
UA = {"User-Agent": "Mozilla/5.0 (compatible; MyBoatPrep/1.0; +https://myboatprep.com)"}
MAX_BYTES = 8_000_000


def search_query(boat: dict) -> str:
    who = " ".join(str(boat.get(k) or "").strip() for k in ("year_built", "make", "model") if str(boat.get(k) or "").strip())
    return f"schematic overhead image line drawing {who}"


async def google_images(query: str) -> list[dict]:
    """Top Google Images results (one Custom Search call, up to 10)."""
    params = {"key": os.environ["GOOGLE_SEARCH_API_KEY"], "cx": os.environ["GOOGLE_SEARCH_CX"], "q": query, "searchType": "image", "num": 10, "safe": "active"}
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(SEARCH_URL, params=params)
    if r.status_code != 200:
        msg = (r.json().get("error") or {}).get("message", "") if r.headers.get("content-type", "").startswith("application/json") else r.text[:200]
        log.error(f"Google image search failed {r.status_code}: {msg}")
        raise HTTPException(status_code=503, detail="The image search isn't available right now. Please try again later, or upload your own diagram.")
    out = []
    for n, it in enumerate(r.json().get("items") or []):
        img = it.get("image") or {}
        if not it.get("link") or not img.get("thumbnailLink"):
            continue
        page = img.get("contextLink") or ""
        out.append({"id": str(n), "link": it["link"], "thumb": img["thumbnailLink"], "title": str(it.get("title") or "")[:140],
                    "source_url": page, "host": it.get("displayLink") or urlparse(page).hostname or "", "width": img.get("width"), "height": img.get("height")})
    return out


def _public(s: dict) -> dict:
    return {"search_id": s["search_id"], "query": s["query"],
            "results": [{k: r[k] for k in ("id", "thumb", "title", "source_url", "host", "width", "height")} for r in s["results"]]}


class SearchBoat(BaseModel):
    boat_type: str = Field(default="", max_length=60)
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    year_built: str = Field(default="", max_length=10)
    fresh: bool = False


@router.post("/boats/{boat_id}/zone-schematics/search")
async def search_schematics(boat_id: BoatPath, payload: SearchBoat, user: dict = Depends(require_premium)):
    """Web image search for the boat's schematic; one Magic use (given back when nothing is found). The same search is reused for 30 days."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump()
    if not (boat["make"].strip() and boat["model"].strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    query = search_query(boat)
    if not payload.fresh:
        recent = await db.zone_searches.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "query": query,
                                                  "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}},
                                                 {"_id": 0}, sort=[("created_at", -1)])
        if recent:
            return {**_public(recent), "reused": True, "scans_left": await quota.left(user["user_id"])}
    source = await quota.consume(user["user_id"])
    try:
        results = await google_images(query)
    except Exception:
        await quota.refund(user["user_id"], source)
        raise
    if not results:
        await quota.refund(user["user_id"], source)
        raise HTTPException(status_code=404, detail="No schematics found on the web for this boat. Upload your own diagram instead.")
    s = {"search_id": str(uuid.uuid4()), "owner_id": user["user_id"], "boat_id": boat_id, "query": query, "results": results,
         "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)}
    await db.zone_searches.insert_one({**s})
    return {**_public(s), "scans_left": await quota.left(user["user_id"])}


async def _download(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=UA) as http:
        r = await http.get(url)
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/") or len(r.content) > MAX_BYTES:
        raise ValueError(f"{r.status_code} {r.headers.get('content-type')}")
    img = Image.open(io.BytesIO(r.content))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, "white")
        bg.paste(img, mask=img.split()[3])
        img = bg
    img = img.convert("RGB")
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return buf.getvalue()


class PickIn(BaseModel):
    result_id: str = Field(pattern=r"^[0-9]{1,2}$")


@router.post("/boats/{boat_id}/zone-schematics/search/{search_id}/pick")
async def pick_schematic(boat_id: BoatPath, search_id: SearchPath, payload: PickIn, user: dict = Depends(require_premium)):
    """Copies the chosen web image to the boat (private to it, with the source link) as a new Zone Map Overview."""
    s = await db.zone_searches.find_one({"search_id": search_id, "owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0})
    hit = next((r for r in (s or {}).get("results") or [] if r["id"] == payload.result_id), None)
    if not hit:
        raise HTTPException(status_code=404, detail="That search has expired. Search again.")
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})
    if doc is None:
        raise HTTPException(status_code=404, detail="Boat not found")
    maps = list(doc.get("zone_maps") or [])
    if len(maps) >= MAX_BOAT_MAPS:
        raise HTTPException(status_code=400, detail=f"Each boat can have up to {MAX_BOAT_MAPS} zone maps. Remove one first.")
    try:
        data = await _download(hit["link"])
    except Exception as e:
        log.warning(f"Schematic download failed {hit['link'][:120]}: {e!r}")
        raise HTTPException(status_code=422, detail="That website won't let us copy the full picture. Pick another one, or upload your own diagram.")
    map_id = str(uuid.uuid4())
    path = f"{APP_NAME}/boat-zone-maps/{user['user_id']}/{map_id}.jpg"
    try:
        await asyncio.to_thread(put_object, path, data, "image/jpeg")
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't save the picture. Please try again.")
    maps.append({"id": map_id, "path": path, "content_type": "image/jpeg", "updated_at": datetime.now(timezone.utc).isoformat(), "name": "Schematic",
                 "kind": "overview", "swatches": [], "source_url": hit["source_url"], "source_title": hit["host"]})
    await db.user_boats.update_one(key, {"$set": {"zone_maps": maps}})
    return {"zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1}))}


PLACE_PROMPT = """This is a top-down layout plan of a boat (a {boat}). Find where each of these areas is on the plan:
{labels}
Only include areas you can actually see or confidently locate on this plan; skip the rest. If the plan shows the words PORT and STARBOARD, use them;
otherwise port is the boat's left side and starboard its right side when facing the bow. Each area of the plan gets at most one label: pick the single
most specific label that fits it (e.g. a cabin aft on the port side is "Port Aft cabin" if that label is listed, a heads in the bow is "Heads Fore").
Give the centre of each area as x and y fractions of the image width and height (0 = left/top, 1 = right/bottom). Each label at most once.
Reply with JSON only: {{"places": [{{"label": "<exact label from the list>", "x": 0.42, "y": 0.37}}]}}"""
DECK_RE = re.compile(r"deck|anchor|lazarette", re.I)
MAP_PX, PHONE_PX = 288, 330


class AutoIn(BaseModel):
    include_deck: bool = False


def spread(places: list[dict], aspect: float) -> list[dict]:
    """Nudges overlapping colour labels apart (sized as shown on a phone), each staying close to its area."""
    h_px = min(MAP_PX, PHONE_PX / aspect)
    w_px = h_px * aspect
    size = [((len(p["label"]) * 6 + 18) / w_px, 24 / h_px) for p in places]
    home = [(p["x"], p["y"]) for p in places]
    for _ in range(60):
        moved = False
        for i in range(len(places)):
            for j in range(i + 1, len(places)):
                a, b = places[i], places[j]
                ox = (size[i][0] + size[j][0]) / 2 - abs(a["x"] - b["x"])
                oy = (size[i][1] + size[j][1]) / 2 - abs(a["y"] - b["y"])
                if ox <= 0 or oy <= 0:
                    continue
                moved = True
                if oy <= ox:
                    d = (oy / 2 + 0.002) * (1 if a["y"] >= b["y"] else -1)
                    a["y"] += d
                    b["y"] -= d
                else:
                    d = (ox / 2 + 0.002) * (1 if a["x"] >= b["x"] else -1)
                    a["x"] += d
                    b["x"] -= d
        for k, p in enumerate(places):
            hx, hy = home[k]
            p["x"] = min(max(p["x"], hx - 0.15, size[k][0] / 2), hx + 0.15, 1 - size[k][0] / 2)
            p["y"] = min(max(p["y"], hy - 0.1, size[k][1] / 2), hy + 0.1, 1 - size[k][1] / 2)
        if not moved:
            break
    return places


@router.post("/boats/{boat_id}/zone-maps/{map_id}/auto-swatches")
async def auto_swatches(boat_id: BoatPath, map_id: Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")], payload: AutoIn | None = None, user: dict = Depends(require_premium)):
    """Magic Mariner drops the predetermined colours it can find onto a Zone Map Overview, replacing the squares already there.
    Below-deck zones plus cockpit and transom by default; deck zones only when asked."""
    from zone_colours import colour_presets
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1, "boat": 1})
    m = next((z for z in (doc or {}).get("zone_maps") or [] if z["id"] == map_id and z.get("kind") == "overview"), None)
    if not m:
        raise HTTPException(status_code=404, detail="Zone Map Overview not found")
    presets = (await colour_presets(user))["presets"]
    if not (payload and payload.include_deck):
        presets = [p for p in presets if not DECK_RE.search(p["label"])]
    if not presets:
        raise HTTPException(status_code=400, detail="Add colours to Admin - Zone Map Predetermined Colours first")
    try:
        data = get_object(m["path"])
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load that plan. Please try again.")
    b = doc.get("boat") or {}
    name = " ".join(x for x in (b.get("make"), b.get("model"), b.get("boat_type")) if x) or "boat"
    by_label = {p["label"].lower(): p for p in presets}
    source = await quota.consume(user["user_id"])
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"zoneplace-{uuid.uuid4()}",
                   system_message="You locate named areas on boat layout plans and reply with strict JSON.").with_model("gemini", "gemini-3-flash-preview")
    try:
        reply = await chat.send_message(UserMessage(text=PLACE_PROMPT.format(boat=name, labels="\n".join(f"- {p['label']}" for p in presets)),
                                                    file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())]))
        raw = json.loads(re.search(r"\{.*\}", str(reply), re.S).group(0)).get("places") or []
    except Exception as e:
        log.error(f"Auto-place colours failed: {e}")
        await quota.refund(user["user_id"], source)
        raise HTTPException(status_code=503, detail="The Magic Mariner couldn't read that plan. Please try again.")
    out, seen = [], set()
    for i, p in enumerate(raw):
        pre = by_label.get(str(p.get("label", "")).strip().lower())
        try:
            x, y = min(1.0, max(0.0, float(p["x"]))), min(1.0, max(0.0, float(p["y"])))
        except (KeyError, TypeError, ValueError):
            continue
        if pre and pre["label"] not in seen:
            seen.add(pre["label"])
            out.append({"id": f"a{uuid.uuid4().hex[:10]}", "x": x, "y": y, "colour": pre["colour"], "label": pre["label"]})
    if out:
        try:
            w, h = Image.open(io.BytesIO(data)).size
            out = spread(out, w / h)
        except Exception as e:
            log.warning(f"Couldn't spread colour labels: {e!r}")
    if not out:
        await quota.refund(user["user_id"], source)
        raise HTTPException(status_code=422, detail="The Magic Mariner couldn't find any of your zone colours on this plan. Drag them on yourself.")
    await db.user_boats.update_one({**key, "zone_maps.id": map_id}, {"$set": {"zone_maps.$.swatches": out[:50]}})
    return {"placed": len(out), "zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})), "scans_left": await quota.left(user["user_id"])}
