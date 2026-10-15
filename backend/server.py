from fastapi import FastAPI, APIRouter, HTTPException, Path as PathParam, Response, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from typing import Annotated, Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from email_validator import validate_email, EmailNotValidError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from email_service import send_email, EMAIL_FROM_NAME  # noqa: E402
from ship_log import build_pdf, build_email_html, render_items, log_title  # noqa: E402
from db import db, client  # noqa: E402
from auth import router as auth_router, get_current_user, require_premium  # noqa: E402
from payments import router as payments_router  # noqa: E402

PUBLIC_APP_URL = os.environ['PUBLIC_APP_URL'].rstrip('/')
HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def public_base(request: Request) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip().lower()
    return f"https://{host}" if HOST_RE.match(host) else PUBLIC_APP_URL


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


class BoatStateIn(BaseModel):
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []


class BoatState(BaseDocument):
    owner_id: str
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    synced_at: str


class BoatStateOut(BaseModel):
    owner_id: str
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    log_sent: Optional[Dict[str, Any]] = None
    engine_log: List[Dict[str, Any]] = []
    deleted_lists: List[str] = []
    synced_at: str


def to_out(state: BoatState) -> BoatStateOut:
    return BoatStateOut(**state.model_dump(exclude={"id"}))


@api_router.get("/")
async def root():
    return {"message": "My Boat Prep API"}


@api_router.get("/me/boat", response_model=BoatStateOut)
async def get_boat(user: dict = Depends(get_current_user)):
    doc = await db.user_boats.find_one({"owner_id": user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="No saved boat yet")
    return to_out(BoatState.from_mongo(doc))


@api_router.put("/me/boat", response_model=BoatStateOut)
async def save_boat(payload: BoatStateIn, user: dict = Depends(get_current_user)):
    owner_id = user["user_id"]
    state = BoatState(
        owner_id=owner_id,
        boat=payload.boat,
        registry=payload.registry,
        data=payload.data,
        updated_at=payload.updated_at,
        log_sent=payload.log_sent,
        engine_log=payload.engine_log,
        deleted_lists=payload.deleted_lists,
        synced_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.user_boats.update_one({"owner_id": owner_id}, {"$set": state.to_mongo()}, upsert=True)
    return to_out(state)


class EmailLogIn(BaseModel):
    local_date: str = Field(min_length=4, max_length=60)
    list_ids: List[str] = Field(default=["shipsLog"], min_length=1, max_length=60)
    position: str = Field(default="Position unavailable", max_length=80)


LogId = Annotated[str, PathParam(pattern=r"^[a-f0-9\-]{36}$")]


@api_router.post("/me/email-log")
async def email_ship_log(payload: EmailLogIn, request: Request, user: dict = Depends(require_premium)):
    owner_id = user["user_id"]
    doc = await db.user_boats.find_one({"owner_id": owner_id})
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
        "local_date": payload.local_date.strip(),
    }
    ctx = {"vessel": log["vessel"], "callsign": log["callsign"], "position": payload.position.strip(), "local_date": log["local_date"]}
    names = {"shipsLog": "Ship's Log", **{r.get("id"): r.get("name", "") for r in state.registry if r.get("name") != "Ship Log"}}
    log["lists"] = [{"name": names[i], "items": render_items(state.data.get(i, []), ctx)} for i in payload.list_ids if i in names]
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
        await db.user_boats.update_one({"owner_id": owner_id}, {"$set": {"log_sent": log_sent}})
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def create_indexes():
    await db.user_boats.create_index("owner_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
