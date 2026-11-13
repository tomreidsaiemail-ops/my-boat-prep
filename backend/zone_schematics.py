import asyncio
import base64
import io
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Path, Response
from pydantic import BaseModel, Field
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from db import db
from auth import get_current_user, require_premium
import quota
from photos import APP_NAME, get_object, put_object
from inventory import MAX_BOAT_MAPS, boat_maps
from layout_rules import check, locate, parse_rules, rules_prompt

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
JobPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
ImgPath = Annotated[str, Path(pattern=r"^[0-9]$")]
MODEL = "gemini-3.1-flash-image-preview"
_tasks = set()
PLAN_TITLE = "Full interior"


def _name(boat: dict) -> str:
    return " ".join(str(boat.get(k) or "").strip() for k in ("year_built", "make", "model") if str(boat.get(k) or "").strip())


SIDES = ("Wide landscape orientation with the stern on the LEFT, the bow pointing RIGHT and the centreline running horizontally across the picture, "
         "so the boat's PORT side is the TOP half of the picture and its STARBOARD side the BOTTOM half. Write the small words BOW at the right end, STERN at the left end, "
         "PORT along the top edge and STARBOARD along the bottom edge, outside the hull.")
STYLE = ("Style: technical wireframe line drawing like a boat builder's brochure plan, thin dark navy lines on a plain white background, no shading, no people. "
         "Clearly draw and label in short English words: Galley, Nav station, Saloon, every cabin with one short name that includes the word cabin (e.g. Forward cabin, Aft port cabin) and every "
         "toilet compartment with one short name that includes the word Heads (e.g. Forward heads). One label per area, never two. Other areas may be labelled too (e.g. Cockpit, Lazarette, Hanging locker). No other text, no watermark.")
STALE_MINUTES = 8
MAX_FIXES = 2
TIME_BUDGET = 240


def plan_prompt(boat: dict, rules: str = "", fix: str = "") -> str:
    size = f", {boat['loa']} {'ft' if boat.get('units') == 'ft' else 'm'} long" if str(boat.get("loa") or "").strip() else ""
    kind = str(boat.get("boat_type") or "boat").strip()
    comment = str(boat.get("layout_comment") or "").strip()
    said = f"The skipper describes this boat's layout as: \"{comment}\".\n" if comment else ""
    return (f"A clean top-down full interior accommodation plan of a {_name(boat)} ({kind}{size}), from bow to stern.\n{said}{rules}{fix}"
            f"Where the skipper says nothing, follow the real layout of this make and model as published by the builder. {SIDES} {STYLE}")


async def _image(prompt: str, session: str, ref: bytes | None = None) -> bytes | None:
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You draw clear boat layout plans and follow placement rules exactly.")
    chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    files = [ImageContent(image_base64=base64.b64encode(ref).decode())] if ref else None
    try:
        _, images = await asyncio.wait_for(chat.send_message_multimodal_response(UserMessage(text=prompt, file_contents=files)), 150)
    except asyncio.TimeoutError:
        log.warning(f"{session}: drawing timed out")
        return None
    if not images:
        return None
    img = Image.open(io.BytesIO(base64.b64decode(images[0]["data"]))).convert("RGB")
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


async def _draw(boat: dict, session: str) -> tuple[bytes, list | None]:
    """Draws the plan, checks every zone against the skipper's comment and runs correction passes; returns the best plan and what still doesn't match (None = not checked)."""
    parsed = await parse_rules(str(boat.get("layout_comment") or ""), f"{session}-rules")
    rules = rules_prompt(parsed)
    start, best, fix, prev = time.monotonic(), None, "", None
    for attempt in range(1 + (MAX_FIXES if rules else 0)):
        if attempt and time.monotonic() - start > TIME_BUDGET:
            break
        # First correction edits the faulty plan; the last one draws afresh so a stubborn mistake isn't copied.
        data = await _image(plan_prompt(boat, rules, fix), f"{session}-{attempt}", prev if attempt == 1 else None)
        if not data:
            continue
        if not rules:
            return data, None
        located = await locate(data, f"{session}-check{attempt}")
        problems = check(parsed, located) if located else None
        log.info(f"{session} pass {attempt}: {problems}")
        if problems is None:
            best = best or (data, None)
            break
        if best is None or best[1] is None or len(problems) < len(best[1]):
            best = (data, problems)
        if not problems:
            break
        fix = (("CORRECTION PASS: the attached plan broke the skipper's rules: " if attempt == 0 else "A previous draft broke the skipper's rules, do not repeat these mistakes: ")
               + " ".join(problems)
               + " Redraw the whole plan so every rule above is met exactly: bow pointing right, stern on the left, port at the top, starboard at the bottom.\n")
        prev = data
    if not best:
        raise ValueError("no image")
    return best


async def _put(path: str, data: bytes):
    for attempt in range(3):
        try:
            return await asyncio.to_thread(put_object, path, data, "image/jpeg")
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(1.5 * (attempt + 1))


async def _run(job_id: str, owner: str, boat: dict, source):
    try:
        data, problems = await _draw(boat, f"zoneplan-{job_id}")
        path = f"{APP_NAME}/zone-schematics/{owner}/{job_id}/0.jpg"
        await _put(path, data)
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": "0", "title": PLAN_TITLE, "path": path, "checked": problems is not None,
                                                                                     "problems": problems or []}}})
        status = "done"
    except Exception as e:
        log.error(f"Zone schematic {job_id} failed: {e!r}")
        if source:
            await quota.refund(owner, source)
        status = "failed"
    await db.zone_schematics.update_one({"job_id": job_id, "status": "running"}, {"$set": {"status": status, "finished_at": datetime.now(timezone.utc).isoformat()}})


class PlanBoat(BaseModel):
    layout_comment: str = Field(default="", max_length=300)
    retry: bool = False
    boat_type: str = Field(default="", max_length=60)
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    year_built: str = Field(default="", max_length=10)
    loa: str = Field(default="", max_length=20)
    units: str = Field(default="m", pattern="^(m|ft)$")


@router.post("/boats/{boat_id}/zone-schematics")
async def start_schematics(boat_id: BoatPath, payload: PlanBoat, user: dict = Depends(require_premium)):
    """Magic Mariner draws one full-interior plan from make, model, year and the skipper's layout comment; one Magic use, runs in the background."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump(exclude={"retry"})
    if not (str(boat.get("make") or "").strip() and str(boat.get("model") or "").strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    sig = "|".join(str(boat.get(k) or "").strip().lower() for k in ("boat_type", "make", "model", "year_built", "layout_comment"))
    if not payload.retry:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "v": 5, "status": {"$in": ["running", "done"]},
                                                    "created_at": {"$gte": week_ago}}, {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
        if recent:
            return {"job_id": recent["job_id"], "total": 1, "scans_left": await quota.left(user["user_id"]), "reused": True}
    source = await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "v": 5, "status": "running", "images": [], "failed": 0,
                                         "total": 1, "source": source, "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)})
    task = asyncio.create_task(_run(job_id, user["user_id"], boat, source))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "total": 1, "scans_left": await quota.left(user["user_id"])}


async def _job(job_id: str, user: dict) -> dict:
    job = await db.zone_schematics.find_one({"job_id": job_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Those layout plans are no longer available")
    return job


@router.get("/zone-schematics/{job_id}")
async def schematics_status(job_id: JobPath, user: dict = Depends(get_current_user)):
    job = await _job(job_id, user)
    stale = (datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)).isoformat()
    if job["status"] == "running" and job.get("created_at", "") < stale and await db.zone_schematics.find_one_and_update(
            {"job_id": job_id, "status": "running"}, {"$set": {"status": "done" if job["images"] else "failed"}}):
        # Cut short (e.g. by an app update): keep what was drawn, or give the Magic use back.
        if not job["images"] and job.get("source"):
            await quota.refund(user["user_id"], job["source"])
        job = await _job(job_id, user)
    images = sorted(job["images"], key=lambda i: i["id"])
    return {"status": job["status"], "total": job.get("total", 1), "failed": job.get("failed", 0),
            "images": [{"id": i["id"], "title": i["title"], "checked": bool(i.get("checked")), "problems": i.get("problems") or []} for i in images]}


@router.get("/zone-schematics/{job_id}/{img_id}")
async def schematic_image(job_id: JobPath, img_id: ImgPath, user: dict = Depends(get_current_user)):
    img = next((i for i in (await _job(job_id, user))["images"] if i["id"] == img_id), None)
    if not img:
        raise HTTPException(status_code=404, detail="No such plan")
    try:
        data = await asyncio.to_thread(get_object, img["path"])
    except Exception:
        raise HTTPException(status_code=502, detail="Couldn't load the picture")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


class UseIn(BaseModel):
    image_ids: List[Annotated[str, Field(pattern=r"^[0-9]$")]] = Field(min_length=1, max_length=4)


@router.post("/boats/{boat_id}/zone-schematics/{job_id}/use")
async def use_schematics(boat_id: BoatPath, job_id: JobPath, payload: UseIn, user: dict = Depends(require_premium)):
    job = await _job(job_id, user)
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})
    if doc is None or job["boat_id"] != boat_id:
        raise HTTPException(status_code=404, detail="Boat not found")
    picked = [i for i in sorted(job["images"], key=lambda i: i["id"]) if i["id"] in set(payload.image_ids)]
    if not picked:
        raise HTTPException(status_code=400, detail="Pick at least one layout plan")
    maps = list(doc.get("zone_maps") or [])
    if len(maps) + len(picked) > MAX_BOAT_MAPS:
        raise HTTPException(status_code=400, detail=f"Each boat can have up to {MAX_BOAT_MAPS} zone maps. Remove one first.")
    now = datetime.now(timezone.utc).isoformat()
    for i in picked:
        maps.append({"id": str(uuid.uuid4()), "path": i["path"], "content_type": "image/jpeg", "updated_at": now, "name": i["title"], "kind": "overview", "swatches": []})
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
