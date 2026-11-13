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
PLANS = [
    ("Deck & cockpit", "deck plan seen from directly above: bow, foredeck, mast, cabin top, cockpit, helm, cockpit lockers and lazarettes, transom or swim platform"),
    ("Saloon & galley", "interior plan seen from directly above of the saloon and galley: seating, saloon table, galley, chart/nav table, companionway steps"),
    ("Cabins", "interior plan seen from directly above of the cabins and heads: forward cabin, aft cabin(s), heads and shower, hanging lockers"),
    ("Full interior", "full interior accommodation plan seen from directly above, from bow to stern, as in the builder's brochure"),
]


def _name(boat: dict) -> str:
    return " ".join(str(boat.get(k) or "").strip() for k in ("year_built", "make", "model") if str(boat.get(k) or "").strip())


def plan_prompt(boat: dict, what: str) -> str:
    size = f", {boat['loa']} {'ft' if boat.get('units') == 'ft' else 'm'} long" if str(boat.get("loa") or "").strip() else ""
    kind = str(boat.get("boat_type") or "boat").strip()
    layout = str(boat.get("layout") or "").strip()
    detail = str(boat.get("layout_detail") or "").strip()
    pick = f"This boat has the factory layout '{layout}'{': ' + detail if detail else ''}. Draw exactly that configuration. " if layout else ""
    return (f"A clean top-down layout plan of a {_name(boat)} ({kind}{size}). Draw the {what}. {pick}"
            "Match the real layout of this make and model as published by the manufacturer, as closely as you know it. "
            "Style: technical wireframe line drawing like a boat builder's brochure plan, thin dark navy lines on a plain white background, no shading, no people, "
            "landscape orientation with the bow pointing right. Label each area clearly in short English words (e.g. Cockpit, Helm, Saloon, Galley, Nav station, "
            "Forward cabin, Aft cabin, Heads, Lazarette). No other text, no watermark.")


async def _one(job_id: str, owner: str, n: int, boat: dict) -> bool:
    title, what = PLANS[n]
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"zoneplan-{job_id}-{n}", system_message="You draw clear boat layout plans.")
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        _, images = await chat.send_message_multimodal_response(UserMessage(text=plan_prompt(boat, what)))
        if not images:
            raise ValueError("no image")
        img = Image.open(io.BytesIO(base64.b64decode(images[0]["data"]))).convert("RGB")
        img.thumbnail((1600, 1600))
        out = io.BytesIO()
        img.save(out, "JPEG", quality=85)
        path = f"{APP_NAME}/zone-schematics/{owner}/{job_id}/{n}.jpg"
        await asyncio.to_thread(put_object, path, out.getvalue(), "image/jpeg")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": str(n), "title": title, "path": path}}})
        return True
    except Exception as e:
        log.error(f"Zone schematic {n} failed: {e}")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$inc": {"failed": 1}})
        return False


async def _run(job_id: str, owner: str, boat: dict, source):
    done = await asyncio.gather(*[_one(job_id, owner, n, boat) for n in range(len(PLANS))])
    if not any(done) and source:
        await quota.refund(owner, source)
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "done" if any(done) else "failed", "finished_at": datetime.now(timezone.utc).isoformat()}})


class PlanBoat(BaseModel):
    layout: str = Field(default="", max_length=80)
    layout_detail: str = Field(default="", max_length=400)
    layouts_job: str = Field(default="", pattern=r"^([a-f0-9-]{36})?$")
    boat_type: str = Field(default="", max_length=60)
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    year_built: str = Field(default="", max_length=10)
    loa: str = Field(default="", max_length=20)
    units: str = Field(default="m", pattern="^(m|ft)$")


@router.post("/boats/{boat_id}/zone-schematics")
async def start_schematics(boat_id: BoatPath, payload: PlanBoat, user: dict = Depends(require_premium)):
    """Magic Mariner draws top-down layout plans of the boat's make and model to start its zone maps from; runs in the background."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump()
    if not (str(boat.get("make") or "").strip() and str(boat.get("model") or "").strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    sig = "|".join(str(boat.get(k) or "").strip().lower() for k in ("boat_type", "make", "model", "year_built", "layout"))
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": {"$ne": "layouts"}, "status": {"$in": ["running", "done"]}, "created_at": {"$gte": week_ago}},
                                               {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
    if recent:
        return {"job_id": recent["job_id"], "total": len(PLANS), "scans_left": await quota.left(user["user_id"]), "reused": True}
    # Picking a layout from a fresh Layout check draws its plans without another Magic use (one use in total).
    free = boat.pop("layouts_job") and await db.zone_schematics.find_one_and_update(
        {"job_id": payload.layouts_job, "owner_id": user["user_id"], "boat_id": boat_id, "kind": "layouts", "plans_free": True}, {"$set": {"plans_free": False}})
    source = None if free else await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "status": "running", "images": [], "failed": 0,
                                         "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)})
    task = asyncio.create_task(_run(job_id, user["user_id"], boat, source))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "total": len(PLANS), "scans_left": await quota.left(user["user_id"])}


async def _job(job_id: str, user: dict) -> dict:
    job = await db.zone_schematics.find_one({"job_id": job_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Those layout plans are no longer available")
    return job


@router.get("/zone-schematics/{job_id}")
async def schematics_status(job_id: JobPath, user: dict = Depends(get_current_user)):
    job = await _job(job_id, user)
    images = sorted(job["images"], key=lambda i: i["id"])
    return {"status": job["status"], "total": job.get("total", len(PLANS)), "failed": job.get("failed", 0),
            "images": [{"id": i["id"], "title": i["title"], "summary": i.get("summary", "")} for i in images]}


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


LAYOUTS_PROMPT = """List the factory interior layout configurations the {boat} ({kind}) was built in, as published by the builder
(e.g. galley to port or starboard, 2 or 3 or 4 cabins, owner's or charter version). Give at most 4, most common first, and only ones you are confident existed.
If it was only built one way, give just that one. Reply with strict JSON only:
{{"layouts": [{{"label": "Layout A: Port Galley", "summary": "Galley to port, nav station to starboard, 3 cabins, 2 heads"}}]}}
Labels start "Layout A:", "Layout B:" and so on, then 2 to 4 words naming what makes that layout different."""


async def _layout_image(job_id: str, owner: str, n: int, boat: dict, v: dict) -> bool:
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"zonelayout-{job_id}-{n}", system_message="You draw clear boat layout plans.")
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        _, images = await chat.send_message_multimodal_response(UserMessage(text=plan_prompt({**boat, "layout": v["label"], "layout_detail": v["summary"]}, PLANS[3][1])))
        if not images:
            raise ValueError("no image")
        img = Image.open(io.BytesIO(base64.b64decode(images[0]["data"]))).convert("RGB")
        img.thumbnail((1600, 1600))
        out = io.BytesIO()
        img.save(out, "JPEG", quality=85)
        path = f"{APP_NAME}/zone-schematics/{owner}/{job_id}/{n}.jpg"
        await asyncio.to_thread(put_object, path, out.getvalue(), "image/jpeg")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": str(n), "title": v["label"], "summary": v["summary"], "path": path}}})
        return True
    except Exception as e:
        log.error(f"Zone layout {n} failed: {e}")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$inc": {"failed": 1}})
        return False


async def _layouts_run(job_id: str, owner: str, boat: dict, source: str):
    """Asks which factory layouts the model came in, then draws a labelled full-interior plan of each for the skipper to pick from."""
    kind = str(boat.get("boat_type") or "boat").strip()
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"zonelayouts-{job_id}",
                       system_message="You know boat builders' published layouts and reply with strict JSON.").with_model("gemini", "gemini-3-flash-preview")
        reply = await chat.send_message(UserMessage(text=LAYOUTS_PROMPT.format(boat=_name(boat), kind=kind)))
        raw = json.loads(re.search(r"\{.*\}", str(reply), re.S).group(0)).get("layouts") or []
        layouts = [{"label": str(v.get("label") or "").strip()[:80], "summary": str(v.get("summary") or "").strip()[:400]} for v in raw if isinstance(v, dict) and str(v.get("label") or "").strip()][:4]
    except Exception as e:
        log.error(f"Zone layouts list failed: {e}")
        layouts = []
    layouts = layouts or [{"label": "Layout A: Standard", "summary": ""}]
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"total": len(layouts)}})
    done = await asyncio.gather(*[_layout_image(job_id, owner, n, boat, v) for n, v in enumerate(layouts)])
    if not any(done):
        await quota.refund(owner, source)
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "done" if any(done) else "failed", "finished_at": datetime.now(timezone.utc).isoformat(),
                                                                      **({} if any(done) else {"plans_free": False})}})


@router.post("/boats/{boat_id}/zone-layouts")
async def start_layouts(boat_id: BoatPath, payload: PlanBoat, user: dict = Depends(require_premium)):
    """Magic Mariner shows up to 4 labelled factory layouts of the make and model; the picked one's plans are then drawn for the same Magic use."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump(exclude={"layout", "layout_detail", "layouts_job"})
    if not (str(boat.get("make") or "").strip() and str(boat.get("model") or "").strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    sig = "|".join(str(boat.get(k) or "").strip().lower() for k in ("boat_type", "make", "model", "year_built"))
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": "layouts", "status": {"$in": ["running", "done"]}, "created_at": {"$gte": week_ago}},
                                               {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
    if recent:
        return {"job_id": recent["job_id"], "scans_left": await quota.left(user["user_id"]), "reused": True}
    source = await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": "layouts", "status": "running", "images": [], "failed": 0,
                                         "total": 4, "plans_free": True, "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)})
    task = asyncio.create_task(_layouts_run(job_id, user["user_id"], boat, source))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "scans_left": await quota.left(user["user_id"])}


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
