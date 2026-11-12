from fastapi import FastAPI, APIRouter, HTTPException, Path as PathParam, Query, Response, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId
import asyncio
import json
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator, field_validator, model_validator
from typing import Annotated, Literal, Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from urllib.parse import urlparse
from fastapi.responses import JSONResponse
from email_validator import validate_email, EmailNotValidError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from email_service import send_email, EMAIL_FROM_NAME  # noqa: E402
from ship_log import build_pdf, build_email_html, render_items, log_title, log_photo_ids  # noqa: E402
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
from sync_merge import galley_crew, keep_pushed, merge_state, merge_crew  # noqa: E402
from crew import router as crew_router, backfill_invite_keys, add_racing_roles  # noqa: E402
from crew_register import router as crew_register_router, record_walkthrough  # noqa: E402
from zone_schematics import router as zone_schematics_router  # noqa: E402
from templates import add_spars_attributes, seed_budget_template, seed_common_names, seed_log_help, seed_master_attributes, seed_trim_briefings  # noqa: E402
from role_briefings import seed_role_safety_briefings  # noqa: E402
from paper_log import router as paper_log_router  # noqa: E402
from crew_agreement import router as crew_agreement_router, seed_terms_template, crew_skip  # noqa: E402
from crew_briefings import router as crew_briefings_router  # noqa: E402
from zone_colours import router as zone_colours_router, seed_colour_presets  # noqa: E402
from template_backup import router as template_backup_router  # noqa: E402
from meals import router as meals_router, seed_common_meals  # noqa: E402
from folder_cards import router as folder_cards_router  # noqa: E402
from bartender import router as bartender_router  # noqa: E402
from fish import router as fish_router  # noqa: E402
from admin_analytics import router as admin_analytics_router  # noqa: E402
import quota  # noqa: E402
import joincrew  # noqa: E402
from shore import router as shore_router, tracking_brief, ensure_indexes as shore_indexes  # noqa: E402
from shore_alert import router as shore_alert_router  # noqa: E402
from trip_archive import router as trip_archive_router, ensure_indexes as trip_archive_indexes  # noqa: E402
import auth as auth_module  # noqa: E402
from usage import backfill_usage  # noqa: E402
from photos import router as photos_router, init_storage, get_object  # noqa: E402
from ai_scan import router as ai_scan_router  # noqa: E402
from boat_trash import router as boat_trash_router, trash_boat  # noqa: E402
from charter import router as charter_router, claim_charters  # noqa: E402
from features import router as features_router, seed_later_rows  # noqa: E402
from ai_lists import router as ai_lists_router  # noqa: E402
from maint_ai import router as maint_ai_router  # noqa: E402
from stores_ai import router as stores_ai_router  # noqa: E402
from go_decision import router as go_decision_router  # noqa: E402
import setup_stripe  # noqa: E402
from distress_email import router as distress_email_router  # noqa: E402
from quick_invite import router as quick_invite_router, claim_quick  # noqa: E402
from area_photos import router as area_photos_router  # noqa: E402
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


class Pet(BaseModel):
    id: str = Field(default="", max_length=40)
    type: str = Field(default="", max_length=40)
    name: str = Field(default="", max_length=60)
    breed: str = Field(default="", max_length=60)
    weight: str = Field(default="", max_length=8)


class Battery(BaseModel):
    id: str = Field(default="", max_length=40)
    role: Literal["engine", "house", "portable"] = "portable"
    make: str = Field(default="", max_length=60)
    volts: Literal["", "12", "24", "48"] = ""
    ah: str = Field(default="", max_length=6)
    chem: Literal["", "lithium", "flooded", "agm", "gel"] = ""
    notes: str = Field(default="", max_length=200)


TANK_FIELDS = ("fuel_tank", "fuel_jerry", "fuel_jerry_size", "water_tank", "water_jerry", "water_jerry_size", "gas_bottles", "gas_kg", "gas_extra", "cruise_kn")
WEIGHT_FIELDS = ("boat_weight", "crew_weight")


class BoatDetails(BaseModel):
    vessel: str = ""
    skipper: str = ""
    skipper_phone: str = Field(default="", max_length=30)
    callsign: str = ""
    log_email: str = ""
    shore_email: str = ""
    shore_enabled: bool = False
    boat_type: str = ""
    pob: int = Field(default=1)
    children: int = 0
    pob_manual: bool = False
    mmsi: str = ""
    units: Literal["m", "ft"] = "m"
    loa: str = ""
    lwl: str = ""
    beam: str = ""
    draft: str = ""
    mast_height: str = ""
    trip_days: int = 0
    route_start: str = Field(default="", max_length=80)
    route_dest: str = Field(default="", max_length=80)
    pets: List[Pet] = Field(default_factory=list, max_length=20)
    make: str = ""
    model: str = ""
    year_built: str = ""
    hull_colour: str = ""
    deck_colour: str = ""
    budget_currency: str = ""
    budget_notes: str = ""
    tank_units: Literal["L", "gal"] = "L"
    fuel_tank: str = ""
    fuel_jerry: str = ""
    fuel_jerry_size: str = ""
    water_tank: str = ""
    water_jerry: str = ""
    water_jerry_size: str = ""
    gas_bottles: str = ""
    gas_kg: str = ""
    gas_extra: str = ""
    cruise_kn: str = "6"
    battery_voltage: str = Field(default="12", pattern=r"^(\d{1,3}(\.\d)?)?$")
    electrical: Dict[str, bool] = {}
    boat_weight: str = ""
    crew_weight: str = ""
    batteries: List[Battery] = Field(default_factory=list, max_length=12)
    depart: Dict[str, Any] = Field(default_factory=dict)
    arrive: Dict[str, Any] = Field(default_factory=dict)
    weather: Dict[str, Any] = Field(default_factory=dict)
    trips: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("trips", mode="before")
    @classmethod
    def trips_size(cls, v):
        return v if isinstance(v, dict) and len(v) <= 30 and len(json.dumps(v, default=str)) <= 120000 else {}

    @field_validator(*TANK_FIELDS, mode="before")
    @classmethod
    def tank_number(cls, v):
        v = str(v if v is not None else "").strip().replace(",", ".")
        return v if re.fullmatch(r"\d{0,5}(\.\d{0,2})?", v) else ""

    @field_validator(*WEIGHT_FIELDS, mode="before")
    @classmethod
    def weight_number(cls, v):
        v = str(v if v is not None else "").strip().replace(",", ".")
        return v if re.fullmatch(r"\d{0,6}(\.\d{0,2})?", v) else ""

    @field_validator("depart", "arrive", mode="before")
    @classmethod
    def depart_size(cls, v):
        return v if isinstance(v, dict) and len(json.dumps(v, default=str)) <= 12000 else {}

    @field_validator("weather", mode="before")
    @classmethod
    def weather_size(cls, v):
        return v if isinstance(v, dict) and len(json.dumps(v, default=str)) <= 24000 else {}

    @field_validator("year_built", mode="before")
    @classmethod
    def year_digits(cls, v):
        v = re.sub(r"\D", "", str(v or ""))[:4]
        return v if not v or 1800 <= int(v) <= datetime.now(timezone.utc).year + 1 else ""

    @field_validator("hull_colour", "deck_colour", mode="before")
    @classmethod
    def colour_text(cls, v):
        return str(v or "")[:40]

    @field_validator("make", "model", mode="before")
    @classmethod
    def trim_make(cls, v):
        return str(v or "")[:60]

    @field_validator("budget_currency", mode="before")
    @classmethod
    def currency_code(cls, v):
        v = str(v or "").upper()
        return v if re.fullmatch(r"[A-Z]{3}", v) else ""

    @field_validator("budget_notes", mode="before")
    @classmethod
    def trim_notes(cls, v):
        return str(v or "")[:4000]

    @field_validator("children", "trip_days", mode="before")
    @classmethod
    def clamp_count(cls, v):
        try:
            return min(999, max(0, int(v or 0)))
        except (TypeError, ValueError):
            return 0

    @field_validator("mmsi", mode="before")
    @classmethod
    def digits_only(cls, v):
        return re.sub(r"\D", "", str(v or ""))[:9]

    @field_validator("units", mode="before")
    @classmethod
    def unit_or_metres(cls, v):
        return v if v in ("m", "ft") else "m"

    @field_validator("loa", "lwl", "beam", "draft", "mast_height", mode="before")
    @classmethod
    def dimension(cls, v):
        v = str(v or "").strip().replace(",", ".")[:8]
        return v if re.fullmatch(r"\d{0,4}(\.\d{0,2})?", v) else ""

    @model_validator(mode="after")
    def children_fit(self):
        self.children = min(self.children, self.pob - 1)
        self.trip_days = min(self.trip_days, 365)
        return self

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
    rigging_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    list_hidden: List[str] = []
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
    rigging_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    list_hidden: List[str] = []
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
    rigging_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    emergency_checked: Dict[str, bool] = {}
    list_hidden: List[str] = []
    template_versions: Dict[str, str] = {}
    sec_ts: Dict[str, str] = {}
    list_ts: Dict[str, str] = {}
    areas: List[Dict[str, Any]] = []
    synced_at: str
    role: str = "owner"


ID_PATTERN = r"^[A-Za-z0-9_-]{1,40}$"
BoatId = Annotated[str, Query(pattern=ID_PATTERN)]
OwnerId = Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
KEEP_IF_OMITTED = ("emergency_checked", "template_versions", "areas", "electrical_log", "rigging_log", "list_hidden")
STATE_FIELDS = ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "electrical_log", "rigging_log", "deleted_lists", "emergency_checked", "template_versions", "sec_ts", "list_ts", "areas", "list_hidden")


def to_out(state: BoatState, role: str = "owner") -> BoatStateOut:
    out = BoatStateOut(**state.model_dump(exclude={"id"}), role=role)
    if role == "crew":
        out.boat = out.boat.model_copy(update={"log_email": "", "shore_email": "", "shore_enabled": False, "budget_notes": ""})
        hidden = {l.get("id") for l in out.registry if l.get("kind") == "budget"}
        out.registry = [l for l in out.registry if l.get("id") not in hidden]
        out.data = {k: v for k, v in out.data.items() if k not in hidden}
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
    if prev and (prev.get("charter_lock") or (prev.get("charter") or {}).get("returned_at")):
        # Out on charter: the owner's boat stays exactly as handed over until the charter ends.
        return to_out(BoatState(**key, **{f: prev.get(f) for f in STATE_FIELDS if prev.get(f) is not None}, synced_at=prev.get("synced_at") or prev.get("updated_at")), role)
    if role == "crew":
        if not prev:
            raise HTTPException(status_code=404, detail="Boat not found")
        by = (prev.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user["email"].split("@")[0]
        merged, crew_log = merge_crew(prev, payload.model_dump(), galley_crew((prev.get("crew_roles") or {}).get(user["user_id"])), str(by).strip())
        have = []
    else:
        if not prev and not to_user_out(user).premium and await db.user_boats.count_documents({"owner_id": user["user_id"]}) >= 1:
            raise HTTPException(status_code=403, detail="Upgrade to Pro to add more boats")
        inc = payload.model_dump()
        for f in KEEP_IF_OMITTED:
            if f not in payload.model_fields_set:
                inc[f] = (prev or {}).get(f, inc[f])
        merged = merge_state(prev, inc) if prev else inc
        merged, have = keep_pushed(merged, inc, (prev or {}).get("pushed_items"))
    state = BoatState(**key, **{f: merged.get(f) for f in STATE_FIELDS if merged.get(f) is not None}, synced_at=datetime.now(timezone.utc).isoformat())
    update = {"$set": state.to_mongo(), "$setOnInsert": {"created_at": state.synced_at, "crew": []}}
    if role != "crew" and have:
        update["$pull"] = {"pushed_items": {"item.id": {"$in": have}}}
    if role == "crew" and crew_log:
        update["$push"] = {"pushed_items": {"$each": [{"list": "shipsLog", "item": i} for i in crew_log]}}
    await db.user_boats.update_one(key, update, upsert=True)
    return to_out(state, role)


class SignOffIn(BaseModel):
    when: str = Field(min_length=1, max_length=60)
    stops: int = Field(ge=1, le=1000)


@api_router.post("/me/boat/walkthrough-signoff")
async def walkthrough_signoff(payload: SignOffIn, user: dict = Depends(get_current_user), boat_id: BoatId = "main", owner: OwnerId = None):
    key, role = await boat_access(user, boat_id, owner)
    now = datetime.now(timezone.utc)
    name = (user.get("name") or user.get("email") or "crew").strip()[:80]
    when = re.sub(r"[^\w ,:/.\-]", "", payload.when).strip()
    item = {"id": int(now.timestamp() * 1000), "label": f"Crew Walkthrough signed off by {name} on {when} ({payload.stops} {'stop' if payload.stops == 1 else 'stops'})",
            "checked": False, "ts": now.isoformat()}
    res = await db.user_boats.update_one(key, {"$push": {"data.shipsLog": item, "pushed_items": {"list": "shipsLog", "item": item}}, "$set": {"updated_at": now.isoformat()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Boat not found")
    if role == "crew":
        await record_walkthrough(key["owner_id"], boat_id, user)
    return {"item": item}


class LastBoatIn(BaseModel):
    key: str = Field(pattern=r"^[A-Za-z0-9_-]{1,140}$")


@api_router.put("/me/last-boat")
async def set_last_boat(payload: LastBoatIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_boat": payload.key}})
    return {"ok": True}


def boat_summary(d: dict, crew_role: bool, owners: dict, uid: str | None = None) -> dict:
    photo = d.get("photo") or {}
    owner = owners.get(d["owner_id"]) or {}
    return {
        "boat_id": d.get("boat_id", "main"), "vessel": d.get("boat", {}).get("vessel", ""), "crew": crew_role,
        "owner_id": d["owner_id"] if crew_role else None, "owner_name": (owner.get("name") or owner.get("email", "")) if crew_role else "",
        "owner_pro": bool(owner) and crew_role and to_user_out(owner).premium,
        "crew_count": len(d.get("crew") or []), "photo_v": photo.get("updated_at") if not photo.get("is_deleted") else None,
        "zone_maps": boat_maps(d), "walk_skip": crew_skip(d, uid if crew_role else None),
        "charter_lock": d.get("charter_lock"), "charter": d.get("charter"), "tracking": tracking_brief(d),
    }


@api_router.get("/me/boats")
async def list_boats(user: dict = Depends(get_current_user)):
    await claim_charters(user)
    await claim_quick(user)
    proj = {"_id": 0, "boat_id": 1, "owner_id": 1, "boat.vessel": 1, "created_at": 1, "crew": 1, "photo": 1, "zone_maps": 1, "walk_skip": 1, "walk_skip_crew": 1, "tracking": 1, "charter_lock": 1, "charter": 1, f"crew_roles.{user['user_id']}": 1, f"crew_names.{user['user_id']}": 1}
    mine = await db.user_boats.find({"owner_id": user["user_id"]}, proj).to_list(200)
    mine.sort(key=lambda d: (d.get("boat_id") != "main", d.get("created_at") or ""))
    shared = await db.user_boats.find({"crew": user["user_id"]}, proj).to_list(200)
    owners = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": [d["owner_id"] for d in shared]}}, {"_id": 0, "password_hash": 0}).to_list(200)}
    return {"boats": [boat_summary(d, False, owners) for d in mine]
            + [{**boat_summary(d, True, owners, user["user_id"]), "my_roles": (d.get("crew_roles") or {}).get(user["user_id"]) or [],
                "my_name": (d.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or ""} for d in shared], "last": user.get("last_boat")}


@api_router.delete("/me/boats/{boat_id}")
async def delete_boat(boat_id: Annotated[str, PathParam(pattern=ID_PATTERN)], user: dict = Depends(get_current_user)):
    owner_id = user["user_id"]
    if not await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found")
    if await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "charter_lock": {"$ne": None}}, {"_id": 1}):
        raise HTTPException(status_code=423, detail="This boat is out on charter. End the charter before deleting it.")
    if await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "charter": {"$ne": None}, "charter.returned_at": None}, {"_id": 1}):
        raise HTTPException(status_code=423, detail="This is a charter boat. It goes when the owner ends the charter.")
    if await db.user_boats.count_documents({"owner_id": owner_id}) <= 1:
        raise HTTPException(status_code=400, detail="You need at least one boat")
    await trash_boat(owner_id, boat_id)
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
        "local_date": payload.local_date.strip(), "boat_type": b.boat_type.strip(), "pob": b.pob, "children": min(b.children, b.pob),
        "mmsi": b.mmsi if len(b.mmsi) == 9 else "",
    }
    ctx = {"vessel": log["vessel"], "callsign": log["callsign"], "position": payload.position.strip(), "local_date": log["local_date"], "pob": log["pob"],
           "boat_type": log["boat_type"], "children": log["children"], "mmsi": log["mmsi"], "pets": [p.model_dump() for p in b.pets]}
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
    return Response(build_pdf(log, await log_images(log)), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{filename}"'})


async def log_images(log: dict) -> dict:
    """Photos logged with a departure stay readable in the PDF even if the skipper later swaps them in the Navigator."""
    ids = list(log_photo_ids(log))
    if not ids:
        return {}
    docs = await db.item_photos.find({"photo_id": {"$in": ids}, "owner_id": log.get("owner_id")}, {"_id": 0, "photo_id": 1, "path": 1}).to_list(50)
    out = {}
    for d in docs:
        try:
            out[d["photo_id"]] = await asyncio.to_thread(get_object, d["path"])
        except Exception:
            logging.getLogger(__name__).warning("ship log photo %s could not be loaded", d["photo_id"])
    return out


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(payments_router)
app.include_router(tips_router)
app.include_router(password_router)
app.include_router(media_router)
app.include_router(faq_router)
app.include_router(feedback_router)
app.include_router(templates_router)
app.include_router(bartender_router)
app.include_router(fish_router)
app.include_router(promo_codes_router)
app.include_router(service_history_router)
app.include_router(crew_router)
app.include_router(crew_agreement_router)
app.include_router(shore_router)
app.include_router(trip_archive_router)
app.include_router(shore_alert_router)
app.include_router(crew_briefings_router)
app.include_router(zone_colours_router)
app.include_router(template_backup_router)
app.include_router(meals_router)
app.include_router(folder_cards_router)
app.include_router(photos_router)
app.include_router(inventory_router)
app.include_router(ai_scan_router)
app.include_router(boat_trash_router)
app.include_router(charter_router)
app.include_router(features_router)
app.include_router(paper_log_router)
app.include_router(ai_lists_router)
app.include_router(maint_ai_router)
app.include_router(stores_ai_router)
app.include_router(go_decision_router)
app.include_router(admin_analytics_router)
app.include_router(quota.router)
app.include_router(crew_register_router)
app.include_router(zone_schematics_router)
app.include_router(distress_email_router)
app.include_router(quick_invite_router)
app.include_router(area_photos_router)
app.add_exception_handler(quota.QuotaExceeded, quota.quota_exceeded_handler)


@app.middleware("http")
async def same_origin_writes(request: Request, call_next):
    # Session cookies are SameSite=None, so block cross-site writes to the API.
    quota.current_tz.set((request.headers.get("x-timezone") or "")[:64] or None)
    auth_module.on_preview.set(request_host(request).endswith(auth_module.PREVIEW_HOST_SUFFIX))
    origin = request.headers.get("origin")
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/") \
            and request.url.path != "/api/stripe/webhook" and origin and urlparse(origin).netloc.lower() != request_host(request):
        return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})
    note = {}
    quota.quota_note.set(note)
    response = await call_next(request)
    if "free_left" in note:
        response.headers["X-Magic-Free-Left"] = str(note["free_left"])
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    expose_headers=["X-Magic-Free-Left"],
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
    await db.users.create_index("joincrew.email_key", sparse=True)
    await shore_indexes()
    await trip_archive_indexes()
    asyncio.create_task(joincrew.lock_stripe_box())
    await db.deleted_boats.create_index("deleted_at", expireAfterSeconds=7 * 86400)
    await db.user_boats.create_index("charter_expires_at", expireAfterSeconds=0)
    await db.deleted_boats.create_index([("owner_id", 1), ("boat_id", 1)])
    await db.crew_invites.create_index("token_hash", unique=True)
    await db.crew_invites.create_index("email_key")
    await db.crew_register.create_index("entry_id", unique=True)
    await db.crew_register.create_index([("owner_id", 1), ("kind", 1)])
    await db.crew_register.create_index("email_key")
    await db.user_activity.create_index([("user_id", 1), ("hour", 1)], unique=True)
    await db.user_activity.create_index([("last", 1), ("first", 1)])
    await db.user_activity.create_index("expires", expireAfterSeconds=0)
    await db.zone_schematics.create_index("job_id", unique=True)
    await db.zone_schematics.create_index("expires", expireAfterSeconds=0)
    await db.invite_sends.create_index("at", expireAfterSeconds=2 * 86400)
    await backfill_invite_keys()
    await db.ai_usage.create_index([("user_id", 1), ("created_at", 1)])
    await db.ai_usage.create_index([("feature", 1), ("created_at", 1)])
    await backfill_usage()
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
    await add_racing_roles()
    await seed_trim_briefings()
    await seed_role_safety_briefings()
    await seed_common_meals()
    await db.user_meals.create_index([("user_id", 1), ("id", 1)], unique=True)
    await seed_budget_template()
    await seed_master_attributes()
    await add_spars_attributes()
    await seed_log_help()
    await quota.migrate_running_total()
    await seed_later_rows()
    await seed_common_names()
    await seed_terms_template()
    await seed_colour_presets()


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
