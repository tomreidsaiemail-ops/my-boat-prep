import asyncio
import base64
import io
import json
import logging
import os
import re
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


SIDES = ("Landscape orientation with the bow pointing RIGHT and the stern on the left, so the boat's PORT side is the TOP half of the picture "
         "and its STARBOARD side the BOTTOM half.")
STYLE = ("Style: technical wireframe line drawing like a boat builder's brochure plan, thin dark navy lines on a plain white background, no shading, no people. "
         "Clearly draw and label in short English words: Galley, Nav station, Saloon, each cabin (e.g. Forward cabin, Aft cabin), Heads. "
         "Other areas may be labelled too (e.g. Cockpit, Lazarette, Hanging locker). No other text, no watermark.")
SIDE_WORDS = {"port": "port side (TOP half of the picture)", "starboard": "starboard side (BOTTOM half of the picture)"}
VISION_MODEL = "gemini-2.5-flash"
STALE_MINUTES = 7


def galley_side(comment: str) -> str:
    m = re.search(r"galley\W+(?:\w+\W+){0,3}?(port|starboard|stbd)|(port|starboard|stbd)\W+(?:\w+\W+){0,2}?galley", comment or "", re.I)
    side = (m.group(1) or m.group(2)).lower() if m else ""
    return "starboard" if side == "stbd" else side


def plan_prompt(boat: dict) -> str:
    size = f", {boat['loa']} {'ft' if boat.get('units') == 'ft' else 'm'} long" if str(boat.get("loa") or "").strip() else ""
    kind = str(boat.get("boat_type") or "boat").strip()
    comment = str(boat.get("layout_comment") or "").strip()
    said = (f"The skipper describes this boat's layout as: \"{comment}\". Follow that description exactly; it overrides anything you know about this model. "
            if comment else "")
    side = galley_side(comment)
    galley = f"The galley is on the {SIDE_WORDS[side]}. " if side else ""
    return (f"A clean top-down full interior accommodation plan of a {_name(boat)} ({kind}{size}), from bow to stern, as in the builder's brochure. {said}{galley}"
            f"Otherwise match the real layout of this make and model as published by the manufacturer. {SIDES} {STYLE}")


SIDE_CHECK = """This is a top-down boat layout plan with the bow pointing right. Is the area labelled Galley (or the stove and sink) in the top half
or the bottom half of the picture? Reply with strict JSON only: {"galley": "top" or "bottom" or "none"}"""


async def _galley_half(data: bytes, session: str) -> str:
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You read boat plans and reply with strict JSON.").with_model("gemini", VISION_MODEL)
        reply = await asyncio.wait_for(chat.send_message(UserMessage(text=SIDE_CHECK, file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())])), 40)
        return str(json.loads(re.search(r"\{.*\}", str(reply), re.S).group(0)).get("galley") or "")
    except Exception as e:
        log.warning(f"Galley side check failed: {e!r}")
        return ""


async def _draw(boat: dict, session: str) -> bytes:
    """One plan from the image model; redrawn once if the comment names the galley side and it lands on the other side."""
    want = {"port": "top", "starboard": "bottom"}.get(galley_side(boat.get("layout_comment", "")))
    out = None
    for attempt in range(2 if want else 1):
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{session}-{attempt}", system_message="You draw clear boat layout plans.")
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        try:
            _, images = await asyncio.wait_for(chat.send_message_multimodal_response(UserMessage(text=plan_prompt(boat))), 150)
        except asyncio.TimeoutError:
            log.warning(f"{session}: drawing timed out")
            continue
        if not images:
            continue
        img = Image.open(io.BytesIO(base64.b64decode(images[0]["data"]))).convert("RGB")
        img.thumbnail((1600, 1600))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)
        out = buf.getvalue()
        if not want or await _galley_half(out, f"{session}-side{attempt}") in (want, "none", ""):
            break
        log.info(f"{session}: galley drawn on the wrong side, redrawing")
    if not out:
        raise ValueError("no image")
    return out


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
        data = await _draw(boat, f"zoneplan-{job_id}")
        path = f"{APP_NAME}/zone-schematics/{owner}/{job_id}/0.jpg"
        await _put(path, data)
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": "0", "title": PLAN_TITLE, "path": path}}})
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
        recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "v": 3, "status": {"$in": ["running", "done"]},
                                                    "created_at": {"$gte": week_ago}}, {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
        if recent:
            return {"job_id": recent["job_id"], "total": 1, "scans_left": await quota.left(user["user_id"]), "reused": True}
    source = await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "v": 3, "status": "running", "images": [], "failed": 0,
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
            "images": [{"id": i["id"], "title": i["title"]} for i in images]}


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
Only include areas you can actually see or confidently locate on this plan; skip the rest. Port is the boat's left side and starboard its right side when facing the bow.
Give the centre of each area as x and y fractions of the image width and height (0 = left/top, 1 = right/bottom). Each area at most once.
Reply with JSON only: {{"places": [{{"label": "<exact label from the list>", "x": 0.42, "y": 0.37}}]}}"""


@router.post("/boats/{boat_id}/zone-maps/{map_id}/auto-swatches")
async def auto_swatches(boat_id: BoatPath, map_id: Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")], user: dict = Depends(require_premium)):
    """Magic Mariner looks at a Zone Map Overview and drops every predetermined colour it can find onto it, replacing the squares already there."""
    from zone_colours import colour_presets
    key = {"owner_id": user["user_id"], "boat_id": boat_id}
    doc = await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1, "boat": 1})
    m = next((z for z in (doc or {}).get("zone_maps") or [] if z["id"] == map_id and z.get("kind") == "overview"), None)
    if not m:
        raise HTTPException(status_code=404, detail="Zone Map Overview not found")
    presets = (await colour_presets(user))["presets"]
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
    if not out:
        await quota.refund(user["user_id"], source)
        raise HTTPException(status_code=422, detail="The Magic Mariner couldn't find any of your zone colours on this plan. Drag them on yourself.")
    await db.user_boats.update_one({**key, "zone_maps.id": map_id}, {"$set": {"zone_maps.$.swatches": out[:50]}})
    return {"placed": len(out), "zone_maps": boat_maps(await db.user_boats.find_one(key, {"_id": 0, "zone_maps": 1})), "scans_left": await quota.left(user["user_id"])}
