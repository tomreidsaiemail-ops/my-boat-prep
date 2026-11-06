import re
import uuid
from datetime import datetime, timezone, timedelta, date
from html import escape
from typing import Annotated, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field
from email_validator import validate_email, EmailNotValidError
from db import db
from auth import get_current_user, require_premium
from email_service import send_email
from urls import public_base
from crew import email_key

router = APIRouter(prefix="/api/crew-register")
DAILY_SEND_LIMIT = 60
EntryPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
DATE = r"^\d{4}-\d{2}-\d{2}$"
TEXT = ("name", "phone", "email", "dob", "allergies", "food", "nok_name", "nok_email", "nok_phone", "comments")


class Details(BaseModel):
    name: str = Field(default="", max_length=60)
    phone: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=254)
    dob: str = Field(default="", max_length=10)
    height_cm: Optional[float] = Field(default=None, ge=50, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=20, le=300)
    allergies: str = Field(default="", max_length=500)
    food: str = Field(default="", max_length=500)
    nok_name: str = Field(default="", max_length=60)
    nok_email: str = Field(default="", max_length=254)
    nok_phone: str = Field(default="", max_length=30)
    comments: str = Field(default="", max_length=1000)


class EntryIn(Details):
    kind: Literal["crew", "party"] = "crew"


class CrewForm(Details):
    height_cm: float = Field(ge=50, le=250)
    weight_kg: float = Field(ge=20, le=300)


class RequestIn(BaseModel):
    entry_ids: Optional[List[Annotated[str, Field(pattern=r"^[a-f0-9-]{36}$")]]] = Field(default=None, max_length=200)
    send_email: bool = True


def _mail(value: str, label: str) -> str:
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail=f"Please enter a valid {label}")


def clean(d: Details, need: tuple) -> dict:
    out = {k: re.sub(r"[ \t]+", " ", str(getattr(d, k))).strip() for k in TEXT}
    out["height_cm"], out["weight_kg"] = d.height_cm, d.weight_kg
    missing = [k for k in need if out.get(k) in ("", None)]
    if missing:
        raise HTTPException(status_code=400, detail="Please fill in every field" if len(need) > 3 else "Please enter a name, phone number and email" if len(need) == 3 else "Please enter a name and email")
    if out["dob"] and not re.match(DATE, out["dob"]):
        raise HTTPException(status_code=400, detail="Please enter a valid date of birth")
    if out["dob"] and not ("1900-01-01" <= out["dob"] <= date.today().isoformat()):
        raise HTTPException(status_code=400, detail="Please enter a valid date of birth")
    if out["email"]:
        out["email"] = _mail(out["email"], "email address")
    if out["nok_email"]:
        out["nok_email"] = _mail(out["nok_email"], "next of kin email")
    return out


def age(dob: str) -> str:
    if not re.match(DATE, dob or ""):
        return ""
    b, t = date.fromisoformat(dob), date.today()
    return str(t.year - b.year - ((t.month, t.day) < (b.month, b.day)))


def public(e: dict) -> dict:
    return {k: v for k, v in e.items() if k not in ("_id", "owner_id", "email_key")}


async def mine(user: dict, entry_id: str) -> dict:
    e = await db.crew_register.find_one({"owner_id": user["user_id"], "entry_id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="That person is no longer on your register")
    return e


async def no_duplicate(user: dict, kind: str, email: str, skip: str = ""):
    if email and await db.crew_register.find_one({"owner_id": user["user_id"], "kind": kind, "email_key": email_key(email), "entry_id": {"$ne": skip}}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="That email is already on your list")


@router.get("")
async def list_register(user: dict = Depends(get_current_user)):
    rows = await db.crew_register.find({"owner_id": user["user_id"]}, {"_id": 0, "owner_id": 0, "email_key": 0}).sort("created_at", 1).to_list(500)
    return {"crew": [r for r in rows if r["kind"] == "crew"], "parties": [r for r in rows if r["kind"] == "party"]}


@router.post("")
async def add_entry(payload: EntryIn, user: dict = Depends(get_current_user)):
    data = clean(payload, ("name", "email") if payload.kind == "crew" else ("name", "phone", "email"))
    await no_duplicate(user, payload.kind, data["email"])
    if await db.crew_register.count_documents({"owner_id": user["user_id"]}) >= 300:
        raise HTTPException(status_code=400, detail="Your register is full (300 people)")
    now = datetime.now(timezone.utc).isoformat()
    e = {"entry_id": str(uuid.uuid4()), "owner_id": user["user_id"], "kind": payload.kind, **data, "email_key": email_key(data["email"]),
         "status": "registered" if payload.kind == "party" else "unregistered", "created_at": now, "updated_at": now}
    await db.crew_register.insert_one(e)
    return public(e)


@router.put("/{entry_id}")
async def edit_entry(entry_id: EntryPath, payload: Details, user: dict = Depends(get_current_user)):
    e = await mine(user, entry_id)
    data = clean(payload, ("name", "email") if e["kind"] == "crew" else ("name", "phone", "email"))
    await no_duplicate(user, e["kind"], data["email"], entry_id)
    upd = {**data, "email_key": email_key(data["email"]), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.crew_register.update_one({"owner_id": user["user_id"], "entry_id": entry_id}, {"$set": upd})
    return public({**e, **upd})


@router.delete("/{entry_id}")
async def delete_entry(entry_id: EntryPath, user: dict = Depends(get_current_user)):
    await db.crew_register.delete_one({"owner_id": user["user_id"], "entry_id": entry_id})
    return {"ok": True}


def request_html(skipper: str, name: str, email: str, link: str) -> str:
    return (
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
        f'<h2 style="margin:0 0 12px">Hi {escape(name)}, please complete your crew registration</h2>'
        f'<p>{escape(skipper)} has asked you to register as crew on My Boat Prep. You only do this once, '
        'and it keeps your contact, health and next of kin details ready for every trip.</p>'
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open My Boat Prep</a></p>'
        f'<p style="font-size:13px;color:#64748b">Sign up or log in with <b>{escape(email)}</b> and the app will show your registration form. '
        f'<b>When you are done, text {escape(skipper)} to say you have completed your registration.</b></p></div>'
    )


@router.post("/requests")
async def send_requests(payload: RequestIn, request: Request, user: dict = Depends(require_premium)):
    q = {"owner_id": user["user_id"], "kind": "crew"}
    if payload.entry_ids is not None:
        q["entry_id"] = {"$in": payload.entry_ids}
    rows = await db.crew_register.find(q, {"_id": 0}).sort("created_at", 1).to_list(300)
    todo = [r for r in rows if r.get("status") != "registered" and r.get("email")]
    now = datetime.now(timezone.utc)
    if payload.send_email:
        used = await db.register_sends.count_documents({"owner_id": user["user_id"], "at": {"$gte": now - timedelta(days=1)}})
        if used + len(todo) > DAILY_SEND_LIMIT:
            raise HTTPException(status_code=429, detail=f"Daily limit reached ({DAILY_SEND_LIMIT} registration emails), try again tomorrow")
    skipper = user.get("name") or user["email"]
    sent = []
    for r in todo:
        if payload.send_email:
            await send_email(to=[r["email"]], subject=f"{skipper} asks you to complete your crew registration",
                             html=request_html(skipper, r["name"], r["email"], f"{public_base(request)}/"))
            await db.register_sends.insert_one({"owner_id": user["user_id"], "at": now})
        await db.crew_register.update_one({"entry_id": r["entry_id"]}, {"$set": {"status": "pending", "requested_at": now.isoformat()}})
        sent.append(r["name"])
    return {"sent": sent, "skipped": [r["name"] for r in rows if r not in todo]}


def summary_html(skipper: str, crew: list) -> str:
    cell = 'style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top"'
    head = "".join(f"<th {cell}>{h}</th>" for h in ("Name", "Phone", "Email", "Age", "Height", "Next of kin", "Status"))
    body = ""
    for c in crew:
        nok = "<br/>".join(escape(x) for x in (c.get("nok_name"), c.get("nok_phone"), c.get("nok_email")) if x)
        status = "Registered" if c.get("status") == "registered" else "Not registered yet"
        vals = [escape(c.get("name", "")), escape(c.get("phone", "")), escape(c.get("email", "")), age(c.get("dob", "")),
                f'{c["height_cm"]:g} cm' if c.get("height_cm") else "", nok, status]
        body += "<tr>" + "".join(f"<td {cell}>{v}</td>" for v in vals) + "</tr>"
    return (
        '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">'
        f'<h2 style="margin:0 0 12px">Crew registration details from {escape(skipper)}</h2>'
        f'<p>{escape(skipper)} has shared the crew list with you as an interested party.</p>'
        f'<table style="border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9">{head}</tr>{body}</table></div>'
    )


@router.post("/parties-email")
async def email_parties(user: dict = Depends(require_premium)):
    rows = await db.crew_register.find({"owner_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    parties = [r["email"] for r in rows if r["kind"] == "party" and r.get("email")]
    crew = [r for r in rows if r["kind"] == "crew"]
    if not parties:
        raise HTTPException(status_code=400, detail="Add an interested party first")
    if not crew:
        raise HTTPException(status_code=400, detail="Add crew to your register first")
    skipper = user.get("name") or user["email"]
    await send_email(to=parties, subject=f"Crew registration details from {skipper}", html=summary_html(skipper, crew))
    return {"sent_to": parties, "crew": len(crew), "unregistered": [c["name"] for c in crew if c.get("status") != "registered"]}


@router.get("/mine")
async def my_requests(user: dict = Depends(get_current_user)):
    rows = await db.crew_register.find({"kind": "crew", "email_key": email_key(user["email"]), "status": {"$ne": "registered"}, "owner_id": {"$ne": user["user_id"]}}, {"_id": 0}).to_list(20)
    out = []
    for r in rows:
        if r["status"] != "pending":
            invited = await db.crew_invites.find_one({"owner_id": r["owner_id"], "email_key": r["email_key"]}, {"_id": 1})
            if not invited and not await db.user_boats.find_one({"owner_id": r["owner_id"], "crew": user["user_id"]}, {"_id": 1}):
                continue
        owner = await db.users.find_one({"user_id": r["owner_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
        out.append({**public(r), "skipper": owner.get("name") or owner.get("email") or "Your skipper"})
    return {"requests": out}


@router.put("/mine/{entry_id}")
async def submit_mine(entry_id: EntryPath, payload: CrewForm, user: dict = Depends(get_current_user)):
    data = clean(payload, TEXT)
    e = await db.crew_register.find_one({"entry_id": entry_id, "kind": "crew", "email_key": email_key(user["email"])}, {"_id": 0})
    if not e or e["owner_id"] == user["user_id"]:
        raise HTTPException(status_code=404, detail="This registration request was cancelled. Ask your skipper for a new one.")
    now = datetime.now(timezone.utc).isoformat()
    upd = {**data, "email_key": email_key(data["email"]), "status": "registered", "registered_at": now, "user_id": user["user_id"], "updated_at": now}
    await db.crew_register.update_one({"entry_id": entry_id}, {"$set": upd})
    return {"status": "registered"}
