from fastapi import FastAPI, APIRouter, HTTPException, Path as PathParam, Query, Response, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId
import asyncio
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator, field_validator
from typing import Annotated, Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from urllib.parse import urlparse
from fastapi.responses import JSONResponse
from email_validator import validate_email, EmailNotValidError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from email_service import send_email, EMAIL_FROM_NAME  # noqa: E402
from ship_log import build_pdf, build_email_html, render_items, log_title  # noqa: E402
from db import db, client  # noqa: E402
from auth import router as auth_router, get_current_user, require_premium, to_user_out  # noqa: E402
from payments import router as payments_router  # noqa: E402
from tips import router as tips_router, load_tips, TIPS_KEY  # noqa: E402

from urls import public_base, request_host  # noqa: E402
from password_auth import router as password_router  # noqa: E402
from media import router as media_router, MEDIA_LISTS, media_list_for_pdf  # noqa: E402
from faq import router as faq_router, FAQ_ID, faq_list_for_pdf  # noqa: E402
from feedback import router as feedback_router  # noqa: E402
from templates import router as templates_router  # noqa: E402
from promo_codes import router as promo_codes_router  # noqa: E402
from service_history import router as service_history_router  # noqa: E402
from sync_merge import merge_state, merge_crew_ticks  # noqa: E402
from crew import router as crew_router  # noqa: E402
from photos import router as photos_router, init_storage  # noqa: E402
from ai_scan import router as ai_scan_router  # noqa: E402
from ai_lists import router as ai_lists_router  # noqa: E402
import setup_stripe  # noqa: E402
from inventory import router as inventory_router, INVENTORY_ID, inventory_list_for_pdf, boat_maps  # noqa: E402


DAILY_EMAIL_LIMIT = 10

app = FastAPI()
api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data


class BoatDetails(BaseModel):
    vessel: str = ""
    skipper: str = ""
    callsign: str = ""
    log_email: str = ""
    shore_email: str = ""
    shore_enabled: bool = False
    boat_type: str = ""
    pob: int = Field(default=1)

    @field_validator("boat_type", mode="before")
    @classmethod
    def trim_type(cls, v):
        return str(v or "")[:60]

    @field_validator("pob", mode="before")
    @classmethod
    def clamp_pob(cls, v):
        try:
            return min(999, max(1, int(v)))
        except (TypeError, ValueError):
            return 1


class BoatStateIn(BaseModel):
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    electrical_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    template_versions: Dict[str, str] = {}
    sec_ts: Dict[str, str] = {}
    list_ts: Dict[str, str] = {}
    areas: List[Dict[str, Any]] = []


class BoatState(BaseDocument):
    owner_id: str
    boat_id: str = "main"
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    electrical_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    template_versions: Dict[str, str] = {}
    sec_ts: Dict[str, str] = {}
    list_ts: Dict[str, str] = {}
    areas: List[Dict[str, Any]] = []
    synced_at: str


class BoatStateOut(BaseModel):
    owner_id: str
    boat_id: str = "main"
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    electrical_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    template_versions: Dict[str, str] = {}
    sec_ts: Dict[str, str] = {}
    list_ts: Dict[str, str] = {}
    areas: List[Dict[str, Any]] = []
    synced_at: str
    role: str = "owner"


ID_PATTERN = r"^[A-Za-z0-9_-]{1,40}$"
BoatId = Annotated[str, Query(pattern=ID_PATTERN)]
OwnerId = Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
KEEP_IF_OMITTED = ("emergency_checked", "template_versions", "areas", "electrical_log")
STATE_FIELDS = ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "electrical_log", "deleted_lists", "emergency_checked", "template_versions", "sec_ts", "list_ts", "areas")


def to_out(state: BoatState, role: str = "owner") -> BoatStateOut:
    out = BoatStateOut(**state.model_dump(exclude={"id"}), role=role)
    if role == "crew":
        out.boat = out.boat.model_copy(update={"log_email": "", "shore_email": "", "shore_enabled": False})
    return out


async def boat_access(user: dict, boat_id: str, owner: Optional[str]) -> tuple[dict, str]:
    """Return the Mongo key for a boat and the caller's role on it (owner or crew)."""
    if not owner or owner == user["user_id"]:
        return {"owner_id": user["user_id"], "boat_id": boat_id}, "owner"
    key = {"owner_id": owner, "boat_id": boat_id}
    if not await db.user_boats.find_one({**key, "crew": user["user_id"]}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found")
    return key, "crew"


@api_router.get("/")
async def root():
    return {"message": "My Boat Prep API"}


@api_router.get("/me/boat", response_model=BoatStateOut)
async def get_boat(user: dict = Depends(get_current_user), boat_id: BoatId = "main", owner: OwnerId = None):
    key, role = await boat_access(user, boat_id, owner)
    doc = await db.user_boats.find_one(key)
    if not doc:
        raise HTTPException(status_code=404, detail="No saved boat yet")
    return to_out(BoatState.from_mongo(doc), role)


@api_router.put("/me/boat", response_model=BoatStateOut)
async def save_boat(payload: BoatStateIn, user: dict = Depends(get_current_user), boat_id: BoatId = "main", owner: OwnerId = None):
    key, role = await boat_access(user, boat_id, owner)
    prev = await db.user_boats.find_one(key, {"_id": 0})
    if role == "crew":
        if not prev:
            raise HTTPException(status_code=404, detail="Boat not found")
        merged = merge_crew_ticks(prev, payload.model_dump())
    else:
        if not prev and not to_user_out(user).premium and await db.user_boats.count_documents({"owner_id": user["user_id"]}) >= 1:
            raise HTTPException(status_code=403, detail="Upgrade to Pro to add more boats")
        inc = payload.model_dump()
        for f in KEEP_IF_OMITTED:
            if f not in payload.model_fields_set:
                inc[f] = (prev or {}).get(f, inc[f])
        merged = merge_state(prev, inc) if prev else inc
    state = BoatState(**key, **{f: merged.get(f) for f in STATE_FIELDS if merged.get(f) is not None}, synced_at=datetime.now(timezone.utc).isoformat())
    await db.user_boats.update_one(key, {"$set": state.to_mongo(), "$setOnInsert": {"created_at": state.synced_at, "crew": []}}, upsert=True)
    return to_out(state, role)


class LastBoatIn(BaseModel):
    key: str = Field(pattern=r"^[A-Za-z0-9_-]{1,140}$")


@api_router.put("/me/last-boat")
async def set_last_boat(payload: LastBoatIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_boat": payload.key}})
    return {"ok": True}


def boat_summary(d: dict, crew_role: bool, owners: dict) -> dict:
    photo = d.get("photo") or {}
    return {
        "boat_id": d.get("boat_id", "main"), "vessel": d.get("boat", {}).get("vessel", ""), "crew": crew_role,
        "owner_id": d["owner_id"] if crew_role else None, "owner_name": owners.get(d["owner_id"], "") if crew_role else "",
        "crew_count": len(d.get("crew") or []), "photo_v": photo.get("updated_at") if not photo.get("is_deleted") else None,
        "zone_maps": boat_maps(d),
    }


@api_router.get("/me/boats")
async def list_boats(user: dict = Depends(get_current_user)):
    proj = {"_id": 0, "boat_id": 1, "owner_id": 1, "boat.vessel": 1, "created_at": 1, "crew": 1, "photo": 1, "zone_maps": 1}
    mine = await db.user_boats.find({"owner_id": user["user_id"]}, proj).to_list(200)
    mine.sort(key=lambda d: (d.get("boat_id") != "main", d.get("created_at") or ""))
    shared = await db.user_boats.find({"crew": user["user_id"]}, proj).to_list(200)
    owners = {u["user_id"]: u.get("name") or u.get("email", "") for u in await db.users.find(
        {"user_id": {"$in": [d["owner_id"] for d in shared]}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(200)}
    return {"boats": [boat_summary(d, False, owners) for d in mine] + [boat_summary(d, True, owners) for d in shared], "last": user.get("last_boat")}


@api_router.delete("/me/boats/{boat_id}")
async def delete_boat(boat_id: Annotated[str, PathParam(pattern=ID_PATTERN)], user: dict = Depends(get_current_user)):
    owner_id = user["user_id"]
    if not await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found")
    if await db.user_boats.count_documents({"owner_id": owner_id}) <= 1:
        raise HTTPException(status_code=400, detail="You need at least one boat")
    await db.user_boats.delete_one({"owner_id": owner_id, "boat_id": boat_id})
    await db.crew_invites.delete_many({"owner_id": owner_id, "boat_id": boat_id})
    return {"ok": True}


class EmailLogIn(BaseModel):
    local_date: str = Field(min_length=4, max_length=60)
    list_ids: List[str] = Field(default=["shipsLog"], min_length=1, max_length=60)
    position: str = Field(default="Position unavailable", max_length=80)
    boat_id: str = Field(default="main", pattern=r"^[A-Za-z0-9_-]{1,40}$")


LogId = Annotated[str, PathParam(pattern=r"^[a-f0-9\-]{36}$")]


@api_router.post("/me/email-log")
async def email_ship_log(payload: EmailLogIn, request: Request, user: dict = Depends(require_premium)):
    owner_id = user["user_id"]
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": payload.boat_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No saved boat yet")
    state = BoatState.from_mongo(doc)
    b = state.boat
    if not (b.vessel.strip() and b.skipper.strip() and b.callsign.strip()):
        raise HTTPException(status_code=400, detail="Please enter vessel details first")
    try:
        to = validate_email(b.log_email.strip(), check_deliverability=False).normalized
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.ship_logs.count_documents({"owner_id": owner_id, "created_at": {"$gte": since}}) >= DAILY_EMAIL_LIMIT:
        raise HTTPException(status_code=429, detail="Daily email limit reached, try again tomorrow")
    now = datetime.now(timezone.utc).isoformat()
    log = {
        "log_id": str(uuid.uuid4()), "owner_id": owner_id, "to": to, "created_at": now,
        "vessel": b.vessel.strip(), "skipper": b.skipper.strip(), "callsign": b.callsign.strip(),
        "local_date": payload.local_date.strip(), "boat_type": b.boat_type.strip(), "pob": b.pob,
    }
    ctx = {"vessel": log["vessel"], "callsign": log["callsign"], "position": payload.position.strip(), "local_date": log["local_date"], "pob": log["pob"], "boat_type": log["boat_type"]}
    names = {"shipsLog": "Ship's Log", **{r.get("id"): r.get("name", "") for r in state.registry if r.get("name") != "Ship Log"}}
    numbered = {r.get("id") for r in state.registry if r.get("kind") in ("youtube", "movies", "tips")}
    tips = (await load_tips())["items"] if "skippersTips" in payload.list_ids else []
    log["lists"] = [
        {"name": "Skipper's Tips", "items": render_items(tips, ctx), "numbered": True} if i == "skippersTips"
        else await media_list_for_pdf(i) if i in MEDIA_LISTS
        else await faq_list_for_pdf() if i == FAQ_ID
        else inventory_list_for_pdf(state.areas, state.registry, state.data) if i == INVENTORY_ID
        else {"name": names[i], "items": render_items(state.data.get(i, []), ctx), "numbered": i in numbered}
        for i in payload.list_ids if i in names or i in ("skippersTips", FAQ_ID, INVENTORY_ID) or i in MEDIA_LISTS
    ]
    if not log["lists"]:
        raise HTTPException(status_code=400, detail="Nothing to email")
    pdf_url = f"{public_base(request)}/api/ship-logs/{log['log_id']}.pdf"
    recipients = [to]
    shore = b.shore_email.strip()
    if payload.list_ids == ["shipsLog"] and b.shore_enabled and shore:
        try:
            shore = validate_email(shore, check_deliverability=False).normalized
        except EmailNotValidError:
            raise HTTPException(status_code=400, detail="Please enter a valid Shore Contact email")
        if shore.lower() != to.lower():
            recipients.append(shore)
    email_id = await send_email(to=recipients, subject=log_title(log), html=build_email_html(log, pdf_url, EMAIL_FROM_NAME))
    await db.ship_logs.insert_one({**log, "email_id": email_id})
    log_sent = {"to": to, "shore": recipients[1] if len(recipients) > 1 else None, "at": now, "log_id": log["log_id"], "pdf_url": pdf_url, "title": log_title(log)}
    if payload.list_ids == ["shipsLog"]:
        await db.user_boats.update_one({"owner_id": owner_id, "boat_id": payload.boat_id}, {"$set": {"log_sent": log_sent}})
    return {"log_sent": log_sent}


@api_router.get("/ship-logs/{log_id}.pdf")
async def ship_log_pdf(log_id: LogId):
    log = await db.ship_logs.find_one({"log_id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Ship's Log not found")
    filename = log_title(log).replace("'", "").replace("/", "-") + ".pdf"
    return Response(build_pdf(log), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{filename}"'})


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(payments_router)
app.include_router(tips_router)
app.include_router(password_router)
app.include_router(media_router)
app.include_router(faq_router)
app.include_router(feedback_router)
app.include_router(templates_router)
app.include_router(promo_codes_router)
app.include_router(service_history_router)
app.include_router(crew_router)
app.include_router(photos_router)
app.include_router(inventory_router)
app.include_router(ai_scan_router)
app.include_router(ai_lists_router)


@app.middleware("http")
async def same_origin_writes(request: Request, call_next):
    # Session cookies are SameSite=None, so block cross-site writes to the API.
    origin = request.headers.get("origin")
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/") \
            and request.url.path != "/api/stripe/webhook" and origin and urlparse(origin).netloc.lower() != request_host(request):
        return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


async def _sync_stripe_catalog():
    try:
        await asyncio.to_thread(setup_stripe.setup)
    except Exception as e:
        logging.getLogger(__name__).error(f"Stripe catalog sync failed: {e}")


@app.on_event("startup")
async def create_indexes():
    await db.user_boats.update_many({"boat_id": {"$exists": False}}, {"$set": {"boat_id": "main"}})
    if "owner_id_1" in await db.user_boats.index_information():
        await db.user_boats.drop_index("owner_id_1")
    await db.user_boats.create_index([("owner_id", 1), ("boat_id", 1)], unique=True)
    await db.user_boats.create_index("crew")
    await db.crew_invites.create_index("token_hash", unique=True)
    await db.ai_scans.create_index([("user_id", 1), ("created_at", 1)])
    await db.ai_drafts.create_index([("user_id", 1), ("created_at", 1)])
    try:
        await asyncio.to_thread(init_storage)
    except Exception as e:
        logging.getLogger(__name__).error(f"Storage init failed: {e}")
    asyncio.create_task(_sync_stripe_catalog())
    await db.users.create_index("email", unique=True)
    await db.promo_codes.create_index("code", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await _upgrade_pob_lines()


OLD_POB = ["Number of persons on board POB and vital information", "State Number of persons on board POB and vessel description"]
POB_LABEL = "There are <PERSONS ON BOARD> persons on board POB. The boat is a white <BOAT_TYPE>. NOTE: If not white state correct colour of boat."
UPGRADES = {
    **{o.lower(): {"dynamic": "pobDescription", "label": POB_LABEL} for o in OLD_POB},
    "state current position lat long": {"dynamic": "panPanPosition", "label": "Report position [Position]"},
    "state vessel name call sign and mmsi number": {"dynamic": "panPanVessel", "label": "This is [Vessel Name], [Vessel Name], [Vessel Name]. Callsign <Callsign>"},
}
MMSI_ITEM = {"id": 400, "label": "or MMSI Number (Optional, skipper to delete or add one)", "checked": False}
ALL_STATIONS = {"id": 401, "label": "ALL STATIONS, ALL STATIONS, ALL STATIONS", "checked": False}
PANPAN_TX = ("transmit: pan pan pan pan pan pan", "transmit: pan-pan pan-pan pan-pan")
RADIO_NAMES = {"mayDay": "Mayday", "panPan": "Pan-Pan"}
RADIO_TEXT = [(re.compile(r"\b(May|MAY|may) (Day|DAY|day)\b"), lambda m: m.group(1) + m.group(2).lower() if m.group(1) != "MAY" else "MAYDAY"),
              (re.compile(r"(?<![-\w])(Pan|PAN|pan) (Pan|PAN|pan)(?![-\w])"), lambda m: f"{m.group(1)}-{m.group(2)}")]


def radio_text(s: str) -> str:
    for rx, fn in RADIO_TEXT:
        s = rx.sub(fn, s)
    return s


def upgrade_items(items: list) -> Optional[list]:
    out, changed = [], False
    has_all = any(x.get("id") == ALL_STATIONS["id"] or (x.get("label") or "").lower().startswith("all stations") for x in items)
    for raw in items:
        i = raw if raw.get("dynamic") or not raw.get("label") else {**raw, "label": radio_text(raw["label"])}
        changed = changed or i is not raw and i["label"] != raw["label"]
        if (i.get("label") or "").strip().lower() in PANPAN_TX and not has_all:
            out += [i, dict(ALL_STATIONS)]
            has_all = changed = True
            continue
        up = None if i.get("dynamic") else UPGRADES.get((i.get("label") or "").strip().lower())
        if not up:
            out.append(i)
            continue
        changed = True
        out.append({**i, **up})
        if up["dynamic"] == "panPanVessel" and not any(x.get("id") == MMSI_ITEM["id"] for x in items):
            out.append({**MMSI_ITEM, **({"indent": True} if i.get("indent") else {})})
    return out if changed else None


def rename_radio_lists(registry: list) -> Optional[list]:
    if not any(RADIO_NAMES.get(r.get("id")) and not r.get("radio_v2") for r in registry):
        return None
    return [{**r, "name": RADIO_NAMES[r["id"]], "radio_v2": True} if RADIO_NAMES.get(r.get("id")) and not r.get("radio_v2") else r for r in registry]


async def _upgrade_pob_lines():
    # Runs once: Mayday / Pan-Pan renames and the lines filled in from Boat Details and GPS.
    if await db.migrations.find_one({"_id": "radio_calls_v2"}):
        return
    async for d in db.user_boats.find({"registry.id": {"$in": list(RADIO_NAMES)}}, {"_id": 1, "registry": 1, "data.mayDay": 1, "data.panPan": 1}):
        upd = {f"data.{k}": new for k in RADIO_NAMES if (new := upgrade_items((d.get("data") or {}).get(k) or [])) is not None}
        if (reg := rename_radio_lists(d.get("registry") or [])) is not None:
            upd["registry"] = reg
        if upd:
            await db.user_boats.update_one({"_id": d["_id"]}, {"$set": upd})
    async for d in db.list_templates.find({"list_id": {"$in": list(RADIO_NAMES)}}, {"_id": 1, "items": 1}):
        if (new := upgrade_items(d.get("items") or [])) is not None:
            await db.list_templates.update_one({"_id": d["_id"]}, {"$set": {"items": new}})
    tips = await db.tips.find_one({"key": TIPS_KEY}, {"_id": 0, "items": 1})
    if tips:
        await db.tips.update_one({"key": TIPS_KEY}, {"$set": {"items": [{**t, "label": radio_text(t.get("label", ""))} for t in tips.get("items", [])]}})
    faq = await db.faq.find_one({"key": "master"}, {"_id": 0, "items": 1})
    if faq:
        await db.faq.update_one({"key": "master"}, {"$set": {"items": [{**f, "question": radio_text(f.get("question", "")), "answer": radio_text(f.get("answer", ""))} for f in faq.get("items", [])]}})
    await db.migrations.insert_one({"_id": "radio_calls_v2", "at": datetime.now(timezone.utc).isoformat()})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
