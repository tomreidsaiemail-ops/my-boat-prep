import re
import uuid
from datetime import datetime, timezone, timedelta, date
from html import escape
from typing import Annotated, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field
from email_validator import validate_email, EmailNotValidError
from db import db
from auth import get_current_user, require_premium
from email_service import send_email
from urls import public_base
from crew import email_key, owned_boat, BoatPath, tick

router = APIRouter(prefix="/api/crew-register")
DAILY_SEND_LIMIT = 60
EntryPath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]
DATE = r"^\d{4}-\d{2}-\d{2}$"
PHONE = r"^\+[1-9]\d{0,3}[ -]?\(?\d[\d ()-]{4,}$"  # must start with + and a country code
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
    quick: bool = False  # Quick Reg: the skipper registers the crew member straight away (name and email are enough).


class CrewForm(Details):
    height_cm: float = Field(ge=50, le=250)
    weight_kg: float = Field(ge=20, le=300)


class RequestIn(BaseModel):
    entry_ids: Optional[List[Annotated[str, Field(pattern=r"^[a-f0-9-]{36}$")]]] = Field(default=None, max_length=200)
    send_email: bool = True
    boat_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,40}$")


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
    for k, label in (("phone", "phone number"), ("nok_phone", "next of kin phone number")):
        if out[k] and not re.match(PHONE, out[k]):
            raise HTTPException(status_code=400, detail=f"Start the {label} with + and the country code, e.g. +64 21 555 1234")
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
    rows = await db.crew_register.find({"owner_id": user["user_id"]}, {"_id": 0, "owner_id": 0}).sort("created_at", 1).to_list(500)
    walks = await db.walkthroughs.find({"owner_id": user["user_id"]}, {"_id": 0}).sort("at", 1).to_list(1000)
    boats = {b["boat_id"]: ((b.get("boat") or {}).get("vessel") or "").strip() or "Your boat"
             async for b in db.user_boats.find({"owner_id": user["user_id"]}, {"_id": 0, "boat_id": 1, "boat.vessel": 1})}
    keys = [r["email_key"] for r in rows if r["kind"] == "crew" and r.get("email_key")]
    jcs = {u["joincrew"]["email_key"]: u["joincrew"] async for u in db.users.find({"joincrew.email_key": {"$in": keys}}, {"_id": 0, "joincrew": 1})}
    for r in rows:
        r["joincrew"] = tick(jcs.get(r.get("email_key")), user["user_id"]) if r["kind"] == "crew" else None
        r["walkthroughs"] = [{"boat_id": w["boat_id"], "vessel": boats[w["boat_id"]], "at": w["at"], "full_at": w.get("full_at") or w["at"], "quick": bool(w.get("quick"))}
                             for w in walks if w["email_key"] == r.get("email_key") and w["boat_id"] in boats] if r["kind"] == "crew" else []
        r.pop("email_key", None)
    return {"crew": [r for r in rows if r["kind"] == "crew"], "parties": [r for r in rows if r["kind"] == "party"]}


async def record_walkthrough(owner_id: str, boat_id: str, user: dict, quick: bool = False):
    """Crew signed off the boat's Crew walkthrough (or quick-accepted after an earlier full one): keep it for their register badge, adding them to the skipper's register if they aren't on it."""
    key, now = email_key(user["email"]), datetime.now(timezone.utc).isoformat()
    prev = await db.walkthroughs.find_one({"owner_id": owner_id, "boat_id": boat_id, "user_id": user["user_id"]}, {"_id": 0, "at": 1, "full_at": 1})
    full_at = ((prev or {}).get("full_at") or (prev or {}).get("at")) if quick else now
    await db.walkthroughs.update_one({"owner_id": owner_id, "boat_id": boat_id, "user_id": user["user_id"]},
                                     {"$set": {"email_key": key, "at": now, "full_at": full_at or now, "quick": quick}}, upsert=True)
    if not await db.crew_register.find_one({"owner_id": owner_id, "kind": "crew", "email_key": key}, {"_id": 1}):
        boat = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0, f"crew_names.{user['user_id']}": 1})
        name = ((boat or {}).get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user["email"].split("@")[0]
        await db.crew_register.insert_one({"entry_id": str(uuid.uuid4()), "owner_id": owner_id, "kind": "crew", **{k: "" for k in TEXT}, "height_cm": None, "weight_kg": None,
                                           "name": str(name).strip()[:60], "email": user["email"].lower(), "email_key": key, "status": "unregistered", "created_at": now, "updated_at": now})


@router.get("/my-phone")
async def my_phone(user: dict = Depends(get_current_user)):
    """The phone number from the latest crew registration with this user's email, to fill the Skipper's Phone box."""
    r = await db.crew_register.find_one({"email_key": email_key(user["email"]), "phone": {"$nin": ["", None]}}, {"_id": 0, "phone": 1}, sort=[("updated_at", -1)])
    return {"phone": (r or {}).get("phone", "")}


@router.get("/walkthrough")
async def walkthrough_done(owner_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")], boat_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")],
                           user: dict = Depends(get_current_user)):
    return {"done": bool(await db.walkthroughs.find_one({"owner_id": owner_id, "boat_id": boat_id, "user_id": user["user_id"]}, {"_id": 1}))}


@router.post("")
async def add_entry(payload: EntryIn, user: dict = Depends(get_current_user)):
    data = clean(payload, ("name", "email") if payload.kind == "crew" else ("name", "phone", "email"))
    await no_duplicate(user, payload.kind, data["email"])
    if await db.crew_register.count_documents({"owner_id": user["user_id"]}) >= 300:
        raise HTTPException(status_code=400, detail="Your register is full (300 people)")
    now = datetime.now(timezone.utc).isoformat()
    quick = payload.quick and payload.kind == "crew"
    e = {"entry_id": str(uuid.uuid4()), "owner_id": user["user_id"], "kind": payload.kind, **data, "email_key": email_key(data["email"]),
         "status": "registered" if payload.kind == "party" or quick else "unregistered", "created_at": now, "updated_at": now,
         **({"quick_reg": True, "registered_at": now} if quick else {})}
    await db.crew_register.insert_one(e)
    return public(e)


class QuickPerson(BaseModel):
    name: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=254)


class QuickBulkIn(BaseModel):
    people: List[QuickPerson] = Field(min_length=1, max_length=50)


@router.post("/quick-bulk")
async def quick_bulk(payload: QuickBulkIn, user: dict = Depends(get_current_user)):
    """Bulk Quick Reg: a pasted list of names and emails, each registered straight away. Bad or repeated lines are skipped with a reason."""
    room = 300 - await db.crew_register.count_documents({"owner_id": user["user_id"]})
    added, skipped, now = [], [], datetime.now(timezone.utc).isoformat()
    for p in payload.people:
        label = p.name.strip() or p.email.strip() or "A line"
        try:
            data = clean(Details(name=p.name, email=p.email), ("name", "email"))
            await no_duplicate(user, "crew", data["email"])
        except HTTPException as e:
            skipped.append({"name": label, "reason": e.detail})
            continue
        if len(added) >= room:
            skipped.append({"name": label, "reason": "Your register is full (300 people)"})
            continue
        await db.crew_register.insert_one({"entry_id": str(uuid.uuid4()), "owner_id": user["user_id"], "kind": "crew", **data, "email_key": email_key(data["email"]),
                                           "status": "registered", "quick_reg": True, "registered_at": now, "created_at": now, "updated_at": now})
        added.append(data["name"])
    return {"added": added, "skipped": skipped}


@router.put("/{entry_id}")
async def edit_entry(entry_id: EntryPath, payload: Details, user: dict = Depends(get_current_user)):
    e = await mine(user, entry_id)
    data = clean(payload, ("name", "email") if e["kind"] == "crew" else ("name", "phone", "email"))
    await no_duplicate(user, e["kind"], data["email"], entry_id)
    upd = {**data, "email_key": email_key(data["email"]), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.crew_register.update_one({"owner_id": user["user_id"], "entry_id": entry_id}, {"$set": upd})
    return public({**e, **upd})


@router.delete("/{entry_id}/walkthroughs/{boat_id}")
async def clear_walkthrough(entry_id: EntryPath, boat_id: Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")], user: dict = Depends(get_current_user)):
    """The skipper wipes a crew member's walkthrough of a boat: no quick accept, and crew on board must accept and walk it again."""
    e = await db.crew_register.find_one({"owner_id": user["user_id"], "entry_id": entry_id, "kind": "crew"}, {"_id": 0, "email_key": 1})
    if not e:
        raise HTTPException(status_code=404, detail="Crew member not found")
    q = {"owner_id": user["user_id"], "boat_id": boat_id, "email_key": e["email_key"]}
    uids = [w["user_id"] async for w in db.walkthroughs.find(q, {"_id": 0, "user_id": 1})]
    await db.walkthroughs.delete_many(q)
    if uids:
        await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$unset": {f"agreements.{u}": "" for u in uids}})
    return {"ok": True, "cleared": len(uids)}


@router.delete("/{entry_id}")
async def delete_entry(entry_id: EntryPath, user: dict = Depends(get_current_user)):
    await db.crew_register.delete_one({"owner_id": user["user_id"], "entry_id": entry_id})
    return {"ok": True}


def request_html(skipper: str, name: str, email: str, link: str, quick: bool = False) -> str:
    ask = (f'<p>{escape(skipper)} has registered you as crew on My Boat Prep with Quick Reg. Please add your own registration details, '
           'like your next of kin, allergies and food preferences. You only do this once, and it keeps them ready for every trip.</p>') if quick else (
           f'<p>{escape(skipper)} has asked you to register as crew on My Boat Prep. You only do this once, '
           'and it keeps your contact, health and next of kin details ready for every trip.</p>')
    return (
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
        f'<h2 style="margin:0 0 12px">Hi {escape(name)}, please complete your crew registration</h2>{ask}'
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open My Boat Prep</a></p>'
        f'<p style="font-size:13px;color:#64748b">Sign up or log in with <b>{escape(email)}</b> and the app will show your registration form. '
        f'<b>When you are done, text {escape(skipper)} to say you have completed your registration.</b></p></div>'
    )


@router.post("/requests")
async def send_requests(payload: RequestIn, request: Request, user: dict = Depends(require_premium)):
    if payload.boat_id:
        await owned_boat(user, payload.boat_id)
    q = {"owner_id": user["user_id"], "kind": "crew"}
    if payload.entry_ids is not None:
        q["entry_id"] = {"$in": payload.entry_ids}
    rows = await db.crew_register.find(q, {"_id": 0}).sort("created_at", 1).to_list(300)
    # Quick Reg crew are already registered: they're only asked to add their own details when the skipper picks them.
    todo = [r for r in rows if r.get("email") and (r.get("status") != "registered" or (payload.entry_ids is not None and quick_open(r)))]
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
                             html=request_html(skipper, r["name"], r["email"], f"{public_base(request)}/", quick_open(r)))
            await db.register_sends.insert_one({"owner_id": user["user_id"], "at": now})
        status = {} if quick_open(r) else {"status": "pending"}
        await db.crew_register.update_one({"entry_id": r["entry_id"]}, {"$set": {**status, "requested_at": now.isoformat(), **({"boat_id": payload.boat_id} if payload.boat_id else {})}})
        sent.append(r["name"])
    return {"sent": sent, "skipped": [r["name"] for r in rows if r not in todo]}


BOAT_FACTS = (("Boat type", "boat_type"), ("Make", "make"), ("Model", "model"), ("Year of manufacture", "year_built"), ("Hull colour", "hull_colour"))


def when_text(v: str) -> str:
    try:
        return datetime.fromisoformat(v).strftime("%-d %b %Y" if len(v) == 10 else "%-d %b %Y %H:%M")
    except (TypeError, ValueError):
        return ""


def summary_html(skipper: str, crew: list, allergies: bool = False, boat: Optional[dict] = None, email: str = "") -> str:
    cell = 'style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top"'
    cols = ("Name", "Phone", "Email", "Age", "Height", "Next of kin") + (("Allergies",) if allergies else ()) + ("Status",)
    head = "".join(f"<th {cell}>{h}</th>" for h in cols)
    body = ""
    for c in crew:
        nok = "<br/>".join(escape(x) for x in (c.get("nok_name"), c.get("nok_phone"), c.get("nok_email")) if x)
        status = "Registered (Quick Reg)" if c.get("quick_reg") and c.get("status") == "registered" else "Registered" if c.get("status") == "registered" else "Not registered yet"
        vals = [escape(c.get("name", "")), escape(c.get("phone", "")), escape(c.get("email", "")), age(c.get("dob", "")),
                f'{c["height_cm"]:g} cm' if c.get("height_cm") else "", nok] + ([f'<b style="color:#b91c1c">{escape(c.get("allergies") or "Not given")}</b>'] if allergies else []) + [status]
        body += "<tr>" + "".join(f"<td {cell}>{v}</td>" for v in vals) + "</tr>"
    intro = f'<p>{escape(skipper)} has shared the crew list with you as an interested party.</p>'
    if boat is not None:
        vessel = (boat.get("vessel") or "").strip() or "their boat"
        contact = "".join(f"<b>{k}:</b> {escape(v)}<br/>" for k, v in (("Email", email), ("Phone", (boat.get("skipper_phone") or "").strip())) if v)
        facts = "".join(f"<tr><td {cell}><b>{k}</b></td><td {cell}>{escape(str(boat.get(f) or '').strip())}</td></tr>" for k, f in BOAT_FACTS if str(boat.get(f) or "").strip())
        intro = (f'<p><b>{escape(skipper)} is the skipper of {escape(vessel)}</b> and has shared the crew list with you as an interested party.</p>'
                 + (f"<p>{contact}</p>" if contact else "")
                 + (f'<p style="margin:12px 0 4px"><b>{escape(vessel)}</b></p><table style="border-collapse:collapse;font-size:13px;margin-bottom:12px">{facts}</table>' if facts else ""))
    return (
        '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">'
        f'<h2 style="margin:0 0 12px">Crew registration details from {escape(skipper)}</h2>{intro}'
        f'<table style="border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9">{head}</tr>{body}</table></div>'
    )


def summary_subject(skipper: str, boat: Optional[dict]) -> str:
    vessel = ((boat or {}).get("vessel") or "").strip()
    w = (boat or {}).get("weather") or {}
    event = " ".join(x for x in (str(w.get("event_name") or "").strip()[:100], when_text(w.get("event_at") or "")) if x)
    return f"{event + ' - ' if event else ''}Crew registration details from {skipper}{f' ({vessel})' if vessel else ''}"


class PartiesIn(BaseModel):
    crew_ids: List[Annotated[str, Field(pattern=r"^[a-f0-9-]{36}$")]] = Field(min_length=1, max_length=200)
    party_id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    include_allergies: bool = False
    boat_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,40}$")


@router.post("/parties-email")
async def email_parties(payload: PartiesIn, user: dict = Depends(require_premium)):
    party = await db.crew_register.find_one({"owner_id": user["user_id"], "kind": "party", "entry_id": payload.party_id}, {"_id": 0})
    if not party or not party.get("email"):
        raise HTTPException(status_code=400, detail="Pick the interested party to email")
    crew = await db.crew_register.find({"owner_id": user["user_id"], "kind": "crew", "entry_id": {"$in": payload.crew_ids}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    if not crew:
        raise HTTPException(status_code=400, detail="Pick the crew to include")
    now = datetime.now(timezone.utc)
    if await db.register_sends.count_documents({"owner_id": user["user_id"], "at": {"$gte": now - timedelta(days=1)}}) >= DAILY_SEND_LIMIT:
        raise HTTPException(status_code=429, detail=f"Daily limit reached ({DAILY_SEND_LIMIT} registration emails), try again tomorrow")
    boat = None
    if payload.boat_id:
        doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": payload.boat_id}, {"_id": 0, "boat": 1})
        boat = (doc or {}).get("boat")
    skipper = ((boat or {}).get("skipper") or "").strip() or user.get("name") or user["email"]
    email = ((boat or {}).get("log_email") or "").strip() or user["email"]
    await send_email(to=[party["email"]], subject=summary_subject(skipper, boat), html=summary_html(skipper, crew, payload.include_allergies, boat, email))
    await db.register_sends.insert_one({"owner_id": user["user_id"], "at": now})
    return {"sent_to": party["name"], "email": party["email"], "crew": len(crew), "unregistered": [c["name"] for c in crew if c.get("status") != "registered"]}


@router.get("/on-board/{boat_id}")
async def on_board(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    """Crew on this boat (those who replied 'in', if anyone has) with their registered allergies, food preferences and weight. Skipper only."""
    doc = await owned_boat(user, boat_id, allow_charter=True)
    ids = doc.get("crew") or []
    rsvp = doc.get("rsvp") or {}
    if any((rsvp.get(i) or {}).get("status") == "in" for i in ids):
        ids = [i for i in ids if (rsvp.get(i) or {}).get("status") == "in"]
    members = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}).to_list(100)
    keys = {email_key(m.get("email", "")): m for m in members}
    rows = await db.crew_register.find({"owner_id": user["user_id"], "kind": "crew", "email_key": {"$in": list(keys)}}, {"_id": 0}).to_list(100)
    names = doc.get("crew_names") or {}
    people = [{"name": r["name"], "allergies": r.get("allergies", ""), "food": r.get("food", ""), "weight_kg": r.get("weight_kg"), "status": r.get("status")} for r in rows]
    found = {r["email_key"] for r in rows}
    missing = [names.get(m["user_id"]) or m.get("name") or m.get("email") for k, m in keys.items() if k not in found]
    return {"people": people, "not_on_register": missing, "rsvp_only": len(ids) != len(doc.get("crew") or []),
            "in_count": sum(1 for i in doc.get("crew") or [] if (rsvp.get(i) or {}).get("status") == "in")}


def quick_open(r: dict) -> bool:
    """A Quick Reg entry the crew member hasn't added their own details to yet."""
    return bool(r.get("quick_reg")) and r.get("status") == "registered"


async def asked(r: dict, user: dict) -> bool:
    """A crew member can fill in an entry once the skipper has sent a request, invited them, or has them as crew.
    Quick Reg entries only once the skipper has asked them to add their details."""
    if quick_open(r):
        return bool(r.get("requested_at"))
    if r["status"] == "pending":
        return True
    if await db.crew_invites.find_one({"owner_id": r["owner_id"], "email_key": r["email_key"]}, {"_id": 1}):
        return True
    return bool(await db.user_boats.find_one({"owner_id": r["owner_id"], "crew": user["user_id"]}, {"_id": 1}))


@router.get("/mine")
async def my_requests(user: dict = Depends(get_current_user)):
    rows = await db.crew_register.find({"kind": "crew", "email_key": email_key(user["email"]), "owner_id": {"$ne": user["user_id"]},
                                        "$or": [{"status": {"$ne": "registered"}}, {"quick_reg": True}]}, {"_id": 0}).to_list(20)
    out = []
    for r in rows:
        if not await asked(r, user):
            continue
        owner = await db.users.find_one({"user_id": r["owner_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
        out.append({**public(r), "skipper": owner.get("name") or owner.get("email") or "Your skipper", "vessel": await request_vessel(r),
                    "already_crew": bool(await db.user_boats.find_one({"owner_id": r["owner_id"], "crew": user["user_id"]}, {"_id": 1}))})
    has_boat = bool(await db.user_boats.find_one({"$or": [{"crew": user["user_id"]}, {"owner_id": user["user_id"], "boat.vessel": {"$regex": r"\S"}}]}, {"_id": 1}))
    return {"requests": out, "has_boat": has_boat, "waiting": None if has_boat or out else await waiting_for(user)}


async def waiting_for(user: dict):
    """Registered with a skipper, no boat of their own and no invite yet: they're waiting for that skipper's crew invite."""
    key = email_key(user["email"])
    r = await db.crew_register.find_one({"kind": "crew", "email_key": key, "status": "registered", "owner_id": {"$ne": user["user_id"]}}, {"_id": 0}, sort=[("registered_at", -1)])
    if not r or await db.crew_invites.find_one({"email_key": key, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 1}):
        return None
    owner = await db.users.find_one({"user_id": r["owner_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
    return {"skipper": owner.get("name") or owner.get("email") or "Your skipper", "vessel": await request_vessel(r)}


async def request_vessel(r: dict) -> str:
    """The boat the skipper asked from: the one the request or a pending invite came from, else their only named boat."""
    inv = await db.crew_invites.find_one({"owner_id": r["owner_id"], "email_key": r["email_key"]}, {"_id": 0, "boat_id": 1}, sort=[("created_at", -1)])
    boat_id = r.get("boat_id") or (inv or {}).get("boat_id")
    names = {b["boat_id"]: ((b.get("boat") or {}).get("vessel") or "").strip()
             async for b in db.user_boats.find({"owner_id": r["owner_id"]}, {"_id": 0, "boat_id": 1, "boat.vessel": 1})}
    named = [v for v in names.values() if v]
    return names.get(boat_id) or (named[0] if len(named) == 1 else "")


@router.put("/mine/{entry_id}")
async def submit_mine(entry_id: EntryPath, payload: CrewForm, user: dict = Depends(get_current_user)):
    data = clean(payload, TEXT)
    e = await db.crew_register.find_one({"entry_id": entry_id, "kind": "crew", "email_key": email_key(user["email"])}, {"_id": 0})
    if not e or e["owner_id"] == user["user_id"] or not await asked(e, user):
        raise HTTPException(status_code=404, detail="This registration request was cancelled. Ask your skipper for a new one.")
    await no_duplicate({"user_id": e["owner_id"]}, "crew", data["email"], entry_id)
    now = datetime.now(timezone.utc).isoformat()
    upd = {**data, "email_key": email_key(data["email"]), "status": "registered", "registered_at": now, "user_id": user["user_id"], "updated_at": now,
           "crew_added_at": now, "quick_reg": False}
    await db.crew_register.update_one({"entry_id": entry_id}, {"$set": upd})
    return {"status": "registered"}
