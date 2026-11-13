import asyncio
import base64
import io
import json
import logging
import os
import re
import uuid
from urllib.parse import urlparse
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
from layout_research import VISION_MODEL, find_drawings, research, resolve_pages, verified_drawings

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


SIDES = ("Landscape orientation with the bow pointing RIGHT and the stern on the left, so the boat's PORT side is the TOP half of the picture "
         "and its STARBOARD side the BOTTOM half.")
STYLE = ("Style: technical wireframe line drawing like a boat builder's brochure plan, thin dark navy lines on a plain white background, no shading, no people. "
         "Label each area clearly in short English words (e.g. Cockpit, Helm, Saloon, Galley, Nav station, Forward cabin, Aft cabin, Heads, Lazarette). "
         "No other text, no watermark.")
SIDE_WORDS = {"port": "port side (TOP half of the picture)", "starboard": "starboard side (BOTTOM half of the picture)"}


def _galley(boat: dict) -> str:
    g = str(boat.get("layout_galley") or "").strip().lower()
    return g if g in SIDE_WORDS else ""


def plan_prompt(boat: dict, what: str, ref: bool = False) -> str:
    size = f", {boat['loa']} {'ft' if boat.get('units') == 'ft' else 'm'} long" if str(boat.get("loa") or "").strip() else ""
    kind = str(boat.get("boat_type") or "boat").strip()
    layout = str(boat.get("layout") or "").strip()
    detail = str(boat.get("layout_detail") or "").strip()
    pick = f"This boat has the factory layout '{layout}'{': ' + detail if detail else ''}. Draw exactly that configuration. " if layout else ""
    galley = f"The galley is on the {SIDE_WORDS[_galley(boat)]}. " if _galley(boat) else ""
    source = ("The attached picture is this boat's verified layout plan. Copy its arrangement exactly: keep every cabin, berth, table, galley, heads, "
              "nav station and locker in the same place, side and proportion. Never mirror or invent anything; if its bow does not point right, rotate it. "
              if ref else "Match the real layout of this make and model as published by the manufacturer. ")
    return f"A clean top-down layout plan of a {_name(boat)} ({kind}{size}). Draw the {what}. {pick}{galley}{source}{SIDES} {STYLE}"


SIDE_CHECK = """This is a top-down boat layout plan with the bow pointing right. Is the area labelled Galley (or the stove and sink) in the top half
or the bottom half of the picture? Reply with strict JSON only: {"galley": "top" or "bottom" or "none"}"""


async def _galley_half(data: bytes, session: str) -> str:
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You read boat plans and reply with strict JSON.").with_model("gemini", VISION_MODEL)
        reply = await asyncio.wait_for(chat.send_message(UserMessage(text=SIDE_CHECK, file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())])), 40)
        return str(json.loads(re.search(r"\{.*\}", str(reply), re.S).group(0)).get("galley") or "")
    except Exception as e:
        log.warning(f"Galley side check failed: {e}")
        return ""


async def _draw(boat: dict, what: str, session: str, ref: bytes | None = None, check_galley: bool = False) -> bytes:
    """One plan from the image model, redrawn once if the galley lands on the wrong side."""
    want = {"port": "top", "starboard": "bottom"}.get(_galley(boat)) if check_galley else None
    out = None
    for attempt in range(2 if want else 1):
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{session}-{attempt}", system_message="You draw clear boat layout plans.")
        chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
        files = [ImageContent(image_base64=base64.b64encode(ref).decode())] if ref else None
        try:
            _, images = await asyncio.wait_for(chat.send_message_multimodal_response(UserMessage(text=plan_prompt(boat, what, bool(ref)), file_contents=files)), 150)
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
            return await _put(path, data)
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(1.5 * (attempt + 1))


async def _load(path: str) -> bytes | None:
    try:
        return await asyncio.to_thread(get_object, path)
    except Exception:
        return None


async def _one(job_id: str, owner: str, n: int, boat: dict, ref_path: str) -> bool:
    title, what = PLANS[n]
    try:
        ref = await _load(ref_path) if ref_path else None
        data = await _draw(boat, what, f"zoneplan-{job_id}-{n}", ref, check_galley=n in (1, 3))
        path = f"{APP_NAME}/zone-schematics/{owner}/{job_id}/{n}.jpg"
        await _put(path, data)
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": str(n), "title": title, "path": path}}})
        return True
    except Exception as e:
        log.error(f"Zone schematic {n} failed: {e}")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$inc": {"failed": 1}})
        return False


async def _run(job_id: str, owner: str, boat: dict, source, ref: dict | None):
    done = await asyncio.gather(*[_one(job_id, owner, n, boat, (ref or {}).get("path", "")) for n in range(len(PLANS))])
    if ref and ref.get("builder_path"):
        # The builder's own drawing is offered too, kept private to this boat with a link to where it was found.
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": {"id": "4", "title": "Builder's drawing", "path": ref["builder_path"],
                                                                                     "source_url": ref.get("source_url", ""), "source_title": ref.get("source_title", "")}}})
    if not any(done) and source:
        await quota.refund(owner, source)
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "done" if any(done) else "failed", "finished_at": datetime.now(timezone.utc).isoformat()}})


class PlanBoat(BaseModel):
    layout: str = Field(default="", max_length=80)
    layout_detail: str = Field(default="", max_length=600)
    layout_galley: str = Field(default="", pattern=r"^(port|starboard|centre|aft|forward|)$")
    layout_ref: str = Field(default="", pattern=r"^([a-f0-9-]{36}/[0-9])?$")
    layouts_job: str = Field(default="", pattern=r"^([a-f0-9-]{36})?$")
    boat_type: str = Field(default="", max_length=60)
    make: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=60)
    year_built: str = Field(default="", max_length=10)
    loa: str = Field(default="", max_length=20)
    units: str = Field(default="m", pattern="^(m|ft)$")


async def _layout_ref(user_id: str, ref: str) -> dict | None:
    """The picked layout from a Layout check: its drawn plan, plus the builder's drawing it was traced from (if any)."""
    if not ref:
        return None
    job_id, img_id = ref.split("/")
    job = await db.zone_schematics.find_one({"job_id": job_id, "owner_id": user_id, "kind": "layouts"}, {"_id": 0, "images": 1})
    img = next((i for i in (job or {}).get("images") or [] if i["id"] == img_id), None)
    return img and {"path": img["path"], "builder_path": img.get("ref_path", ""), "source_url": img.get("source_url", ""), "source_title": img.get("source_title", "")}


@router.post("/boats/{boat_id}/zone-schematics")
async def start_schematics(boat_id: BoatPath, payload: PlanBoat, user: dict = Depends(require_premium)):
    """Magic Mariner draws top-down layout plans of the boat, traced from its picked layout; runs in the background."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump()
    if not (str(boat.get("make") or "").strip() and str(boat.get("model") or "").strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    sig = "|".join(str(boat.get(k) or "").strip().lower() for k in ("boat_type", "make", "model", "year_built", "layout", "layout_ref"))
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": {"$ne": "layouts"}, "status": {"$in": ["running", "done"]}, "created_at": {"$gte": week_ago}},
                                               {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
    if recent:
        return {"job_id": recent["job_id"], "total": len(PLANS), "scans_left": await quota.left(user["user_id"]), "reused": True}
    ref = await _layout_ref(user["user_id"], boat.pop("layout_ref"))
    # Picking a layout from a fresh Layout check draws its plans without another Magic use (one use in total).
    free = boat.pop("layouts_job") and await db.zone_schematics.find_one_and_update(
        {"job_id": payload.layouts_job, "owner_id": user["user_id"], "boat_id": boat_id, "kind": "layouts", "plans_free": True}, {"$set": {"plans_free": False}})
    source = None if free else await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "status": "running", "images": [], "failed": 0,
                                         "total": len(PLANS), "source": source, "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)})
    task = asyncio.create_task(_run(job_id, user["user_id"], boat, source, ref))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "total": len(PLANS), "scans_left": await quota.left(user["user_id"])}


async def _job(job_id: str, user: dict) -> dict:
    job = await db.zone_schematics.find_one({"job_id": job_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Those layout plans are no longer available")
    return job


STALE_MINUTES = 10
IMG_KEYS = ("title", "summary", "galley", "based_on", "source_url", "source_title")


@router.get("/zone-schematics/{job_id}")
async def schematics_status(job_id: JobPath, user: dict = Depends(get_current_user)):
    job = await _job(job_id, user)
    stale = (datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)).isoformat()
    if job["status"] == "running" and job.get("created_at", "") < stale and await db.zone_schematics.find_one_and_update(
            {"job_id": job_id, "status": "running"}, {"$set": {"status": "done" if job["images"] else "failed", "plans_free": bool(job["images"]) and job.get("plans_free", False)}}):
        # Cut short (e.g. by an app update): keep what was drawn, or give the Magic use back.
        if not job["images"] and job.get("source"):
            await quota.refund(user["user_id"], job["source"])
        job = await _job(job_id, user)
    images = sorted(job["images"], key=lambda i: i["id"])
    return {"status": job["status"], "phase": job.get("phase", ""), "total": job.get("total", len(PLANS)), "failed": job.get("failed", 0),
            "images": [{"id": i["id"], **{k: i.get(k, "") for k in IMG_KEYS}} for i in images]}


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


async def _phase(job_id: str, phase: str, **extra):
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"phase": phase, **extra}})


async def _layout_image(job_id: str, owner: str, n: int, boat: dict, v: dict) -> bool:
    try:
        ref = v.get("drawing")
        b = {**boat, "layout": v["label"], "layout_detail": v["summary"], "layout_galley": v.get("galley", "")}
        data = await _draw(b, PLANS[3][1], f"zonelayout-{job_id}-{n}", ref["bytes"] if ref else None, check_galley=True)
        base = f"{APP_NAME}/zone-schematics/{owner}/{job_id}"
        await _put(f"{base}/{n}.jpg", data)
        item = {"id": str(n), "title": v["label"], "summary": v["summary"], "galley": v.get("galley", ""), "path": f"{base}/{n}.jpg",
                "based_on": v["based_on"], "source_url": v.get("source_url", ""), "source_title": v.get("source_title", "")}
        if ref:
            await _put(f"{base}/ref{n}.jpg", ref["bytes"])
            item["ref_path"] = f"{base}/ref{n}.jpg"
        await db.zone_schematics.update_one({"job_id": job_id}, {"$push": {"images": item}})
        return True
    except Exception as e:
        log.error(f"Zone layout {n} failed: {e}")
        await db.zone_schematics.update_one({"job_id": job_id}, {"$inc": {"failed": 1}})
        return False


def _match_drawings(layouts: list[dict], drawings: list[dict]):
    """Gives each layout the best verified builder drawing of it; a single layout takes the best drawing found."""
    def letter(s):
        m = re.match(r"\s*layout\s+([a-z])\b", str(s or ""), re.I)
        return m.group(1).lower() if m else str(s or "").strip().lower()
    used = set()
    for v in layouts:
        hit = next((d for d in drawings if d["url"] not in used and letter(d.get("matches")) == letter(v["label"])), None)
        if not hit and len(layouts) == 1:
            hit = next((d for d in drawings if d["url"] not in used), None)
        if hit:
            used.add(hit["url"])
            v.update(drawing=hit, based_on="drawing", source_url=hit["page"], source_title=hit.get("page_title") or urlparse(hit["page"]).hostname or "")
            if hit.get("galley") in SIDE_WORDS:
                v["galley"] = hit["galley"]


async def _finish_layouts(job_id: str, owner: str, boat: dict, source: str, layouts: list[dict]):
    await _phase(job_id, "drawing", total=len(layouts))
    done = await asyncio.gather(*[_layout_image(job_id, owner, n, boat, v) for n, v in enumerate(layouts)])
    if not any(done):
        await quota.refund(owner, source)
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "done" if any(done) else "failed", "finished_at": datetime.now(timezone.utc).isoformat(),
                                                                      **({} if any(done) else {"plans_free": False})}})


async def _layouts_run(job_id: str, owner: str, boat: dict, source: str):
    """Searches the web for the model's factory layouts and the builder's drawings, then draws a labelled plan of each, traced from the drawing when one is found."""
    kind = str(boat.get("boat_type") or "boat").strip()
    name = _name(boat)
    try:
        layouts, sources = await research(name, kind, f"zonelayouts-{job_id}")
    except Exception as e:
        log.error(f"Zone layouts search failed: {e}")
        await quota.refund(owner, source)
        await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "failed", "plans_free": False}})
        return
    layouts = [v for v in layouts if v["source_urls"] or v["image_urls"] or sources]
    if not layouts:
        # Nothing published online for this boat: no Magic used; the skipper describes the layout instead.
        await quota.refund(owner, source)
        await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "need_description", "plans_free": False, "phase": ""}})
        return
    await _phase(job_id, "checking", total=len(layouts))
    try:
        drawings = await verified_drawings(await find_drawings(layouts, sources), name, layouts, f"zonecheck-{job_id}")
    except Exception as e:
        log.warning(f"Builder drawing search failed: {e}")
        drawings = []
    _match_drawings(layouts, drawings)
    pages = await resolve_pages([v["source_urls"][0] for v in layouts if not v.get("drawing") and v["source_urls"]])
    for v in layouts:
        if not v.get("drawing"):
            url = pages.get(v["source_urls"][0], "") if v["source_urls"] else ""
            v.update(based_on="sources", source_url=url, source_title=urlparse(url).hostname or "" if url else "")
    await _finish_layouts(job_id, owner, boat, source, layouts)


@router.post("/boats/{boat_id}/zone-layouts")
async def start_layouts(boat_id: BoatPath, payload: PlanBoat, user: dict = Depends(require_premium)):
    """Magic Mariner finds up to 4 factory layouts of the make, model and year on the web; the picked one's plans are then drawn for the same Magic use."""
    if not await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    boat = payload.model_dump(exclude={"layout", "layout_detail", "layout_galley", "layout_ref", "layouts_job"})
    if not (str(boat.get("make") or "").strip() and str(boat.get("model") or "").strip()):
        raise HTTPException(status_code=400, detail="Add your boat's make and model first")
    sig = "|".join(str(boat.get(k) or "").strip().lower() for k in ("boat_type", "make", "model", "year_built"))
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.zone_schematics.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": "layouts", "v": 2, "status": {"$in": ["running", "done"]},
                                                "created_at": {"$gte": week_ago}}, {"_id": 0, "job_id": 1}, sort=[("created_at", -1)])
    if recent:
        return {"job_id": recent["job_id"], "scans_left": await quota.left(user["user_id"]), "reused": True}
    source = await quota.consume(user["user_id"])
    job_id = str(uuid.uuid4())
    await db.zone_schematics.insert_one({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "sig": sig, "kind": "layouts", "v": 2, "status": "running",
                                         "phase": "searching", "images": [], "failed": 0, "total": 4, "plans_free": True, "boat": boat, "source": source,
                                         "created_at": datetime.now(timezone.utc).isoformat(), "expires": datetime.now(timezone.utc) + timedelta(days=30)})
    task = asyncio.create_task(_layouts_run(job_id, user["user_id"], boat, source))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "scans_left": await quota.left(user["user_id"])}


class DescribeIn(BaseModel):
    description: str = Field(min_length=5, max_length=600)


def _side_from_text(text: str) -> str:
    m = re.search(r"galley\W+(?:\w+\W+){0,3}?(port|starboard|stbd)|(port|starboard|stbd)\W+(?:\w+\W+){0,2}?galley", text, re.I)
    side = (m.group(1) or m.group(2)).lower() if m else ""
    return "starboard" if side == "stbd" else side


@router.post("/boats/{boat_id}/zone-layouts/{job_id}/describe")
async def describe_layout(boat_id: BoatPath, job_id: JobPath, payload: DescribeIn, user: dict = Depends(require_premium)):
    """No factory layout online: the skipper's own description is drawn instead, for one Magic use including its plans."""
    job = await db.zone_schematics.find_one_and_update({"job_id": job_id, "owner_id": user["user_id"], "boat_id": boat_id, "kind": "layouts", "status": "need_description"},
                                                       {"$set": {"status": "running", "phase": "drawing", "total": 1, "failed": 0}})
    if not job:
        raise HTTPException(status_code=409, detail="That layout check has moved on. Close and try again.")
    try:
        source = await quota.consume(user["user_id"])
    except Exception:
        await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"status": "need_description"}})
        raise
    await db.zone_schematics.update_one({"job_id": job_id}, {"$set": {"plans_free": True, "source": source, "created_at": datetime.now(timezone.utc).isoformat()}})
    text = payload.description.strip()
    layouts = [{"label": "Layout: As you described", "summary": text, "galley": _side_from_text(text), "based_on": "description"}]
    task = asyncio.create_task(_finish_layouts(job_id, user["user_id"], job.get("boat") or {}, source, layouts))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"job_id": job_id, "scans_left": await quota.left(user["user_id"])}


class UseIn(BaseModel):
    image_ids: List[Annotated[str, Field(pattern=r"^[0-9]$")]] = Field(min_length=1, max_length=5)


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
        maps.append({"id": str(uuid.uuid4()), "path": i["path"], "content_type": "image/jpeg", "updated_at": now, "name": i["title"], "kind": "overview", "swatches": [],
                     **({"source_url": i["source_url"], "source_title": i.get("source_title", "")} if i.get("source_url") else {})})
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
