import hashlib
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Annotated, Dict, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field
from email_validator import validate_email, EmailNotValidError
from db import db
from auth import get_current_user, require_premium
from email_service import send_email
from urls import public_base

router = APIRouter(prefix="/api")
INVITE_DAYS = 7
DAILY_INVITE_LIMIT = 20
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def owned_boat(user: dict, boat_id: str) -> dict:
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "boat": 1, "crew": 1, "crew_roles": 1, "crew_names": 1, "agreements": 1, "boat_terms": 1, "voyage_notes": 1, "rsvp": 1, "watch_rota": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    return doc


def email_key(email: str) -> str:
    # Gmail ignores dots and +tags, and googlemail.com is the same mailbox as gmail.com.
    local, _, domain = email.strip().lower().rpartition("@")
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.split("+", 1)[0].replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def clean_roles(roles: List[str], limit: int = 12) -> List[str]:
    out, seen = [], set()
    for r in roles:
        r = re.sub(r"\s+", " ", r).strip()[:40]
        if r and r.lower() not in seen:
            seen.add(r.lower())
            out.append(r)
    return out[:limit]


def list_roles(items: list) -> List[str]:
    """Roles from a Crew Roles list: headings (a line with indented lines under it) and '*' default marks left out; ticked roles only, if any are ticked."""
    rows = [(i, not i.get("indent") and k + 1 < len(items) and bool(items[k + 1].get("indent"))) for k, i in enumerate(items)]
    roles = [i for i, head in rows if not head]
    if any(i.get("checked") for i in roles):
        roles = [i for i in roles if i.get("checked")]
    return [re.sub(r"^\s*\*\s*", "", re.sub(r"^\s*\d+[.)]\s*", "", str(i.get("label", "")))) for i in roles]


class InviteIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: str = Field(max_length=254)
    roles: List[str] = Field(default_factory=list, max_length=20)
    notes: str = Field(default="", max_length=1000)
    briefings: Dict[Annotated[str, Field(max_length=60)], Annotated[str, Field(max_length=2000)]] = Field(default_factory=dict, max_length=20)
    shopping: List[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=150)
    send_email: bool = True


class ShoppingIn(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(default="", max_length=60)
    items: List[Annotated[str, Field(max_length=200)]] = Field(min_length=1, max_length=150)


class NotesIn(BaseModel):
    notes: str = Field(default="", max_length=1000)


def shopping_html(items: List[str]) -> str:
    rows = "".join(f"<li>{escape(i)}</li>" for i in items)
    return f'<p><b>Food to bring on board:</b></p><ul style="margin:0 0 12px;padding-left:20px">{rows}</ul>' if items else ""


def invite_html(owner: str, vessel: str, email: str, link: str, roles: List[str], notes: str, briefings: dict = None, name: str = "", shopping: List[str] = None) -> str:
    extra = f'<p><b>Your role:</b> {escape(", ".join(roles))}</p>' if roles else ""
    for r in roles:
        if (b := (briefings or {}).get(r.lower())):
            extra += f'<p><b>Role briefing - {escape(r)}:</b><br/>{escape(b).replace(chr(10), "<br/>")}</p>'
    extra += shopping_html(shopping or [])
    if notes.strip():
        extra += f'<p><b>Planned voyage or race:</b><br/>{escape(notes.strip()).replace(chr(10), "<br/>")}</p>'
    return (
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
        f'<h2 style="margin:0 0 12px">{f"Hi {escape(name)}, y" if name else "Y"}ou\'re invited aboard {escape(vessel)}</h2>'
        f'<p>{escape(owner)} has invited you to join the crew of <b>{escape(vessel)}</b> on My Boat Prep. '
        'You\'ll see the boat\'s checklists on your own phone and can tick items as you go.</p>'
        f'{extra}'
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open My Boat Prep</a></p>'
        f'<p style="font-size:13px;color:#64748b">Sign up or log in with <b>{escape(email)}</b> and the app will ask you to join {escape(vessel)}. '
        f'The invite expires in {INVITE_DAYS} days.</p></div>'
    )


async def boat_role_items(owner_id: str, boat_id: str) -> list:
    reg = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0, "registry": 1})
    lid = next((l["id"] for l in (reg or {}).get("registry") or [] if str(l.get("name", "")).strip().lower() == "crew roles"), None)
    if not lid:
        return []
    data = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0, f"data.{lid}": 1})
    return ((data or {}).get("data") or {}).get(lid) or []


def role_label(label: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"^\s*\*\s*", "", re.sub(r"^\s*\d+[.)]\s*", "", str(label)))).strip()[:40]


async def role_briefings(owner_id: str, boat_id: str) -> dict:
    """Role name (lower case) -> the skipper's Role Briefing from the boat's Crew Roles list."""
    return {role_label(i.get("label", "")).lower(): str(i["briefing"]).strip() for i in await boat_role_items(owner_id, boat_id) if str(i.get("briefing") or "").strip()}


async def role_options(owner_id: str, boat_id: str, doc: dict, invites: list) -> List[str]:
    items = await boat_role_items(owner_id, boat_id)
    if not items:
        tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": "^crew roles$", "$options": "i"}}, {"_id": 0, "items": 1})
        items = [{**i, "checked": str(i.get("label", "")).lstrip().startswith("*")} for i in (tpl or {}).get("items") or []]
    used = [r for roles in (doc.get("crew_roles") or {}).values() for r in roles] + [r for i in invites for r in i.get("roles") or []]
    return clean_roles(list_roles(items) + used, 100) if items or used else []


RACING = ["Port Trim", "Starboard Trim", "Mainsheet", "Helm", "Foredeck (headsail/spinnaker)"]


async def add_racing_roles():
    """Runs once: adds a 'Racing Roles' group after 'Safety & Emergency' in the admin Crew Roles list, if it isn't there already."""
    if await db.migrations.find_one({"_id": "crew_racing_roles"}):
        return
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": "^crew roles$", "$options": "i"}}, {"_id": 1, "items": 1})
    items = (tpl or {}).get("items") or []
    if tpl and not any("racing roles" in str(i.get("label", "")).lower() for i in items):
        safety = next((k for k, i in enumerate(items) if "safety" in str(i.get("label", "")).lower() and not i.get("indent")), None)
        end = len(items) if safety is None else next((k for k in range(safety + 1, len(items)) if not items[k].get("indent")), len(items))
        numbered = [m.group(1) for i in items if not i.get("indent") and (m := re.match(r"^\s*(\d+)[.)]", str(i.get("label", ""))))]
        head = f"{int(numbered[-1]) + 1}. Racing Roles" if numbered else "Racing Roles"
        nid = max([int(i.get("id", 0)) for i in items if str(i.get("id", "")).isdigit()] + [0]) + 1
        group = [{"id": nid, "label": head}] + [{"id": nid + k + 1, "label": r, "indent": True} for k, r in enumerate(RACING)]
        await db.list_templates.update_one({"_id": tpl["_id"]}, {"$set": {"items": items[:end] + group + items[end:], "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.migrations.insert_one({"_id": "crew_racing_roles", "at": datetime.now(timezone.utc).isoformat()})


@router.post("/boats/{boat_id}/crew/shopping")
async def send_shopping(boat_id: BoatPath, payload: ShoppingIn, user: dict = Depends(get_current_user)):
    """Emails a crew member (or someone with a pending invite) the Provisions they are buying."""
    doc = await owned_boat(user, boat_id)
    key = email_key(payload.email.strip())
    crew = await db.users.find({"user_id": {"$in": doc.get("crew") or []}}, {"_id": 0, "email": 1}).to_list(100)
    invited = await db.crew_invites.find_one({"owner_id": user["user_id"], "boat_id": boat_id, "email_key": key}, {"_id": 1})
    to = next((m["email"] for m in crew if email_key(m.get("email", "")) == key), None) or (payload.email.strip() if invited else None)
    if not to:
        raise HTTPException(status_code=404, detail="They aren't crew on this boat")
    if await db.shopping_sends.count_documents({"owner_id": user["user_id"], "at": {"$gte": datetime.now(timezone.utc) - timedelta(days=1)}}) >= 40:
        raise HTTPException(status_code=429, detail="Daily limit reached, try again tomorrow")
    vessel = doc.get("boat", {}).get("vessel", "").strip() or "the boat"
    skipper = user.get("name") or user["email"]
    name = " ".join(payload.name.split())
    html = ('<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">'
            f'<h2 style="margin:0 0 12px">{f"Hi {escape(name)}, h" if name else "H"}ere\'s your shopping for {escape(vessel)}</h2>'
            f'<p>{escape(skipper)} has asked you to buy these and bring them on board:</p>'
            f'{shopping_html([i.strip() for i in payload.items if i.strip()])}'
            '<p style="font-size:13px;color:#64748b">Sent from My Boat Prep.</p></div>')
    await send_email(to=[to], subject=f"Your shopping for {vessel}", html=html)
    await db.shopping_sends.insert_one({"owner_id": user["user_id"], "at": datetime.now(timezone.utc)})
    return {"ok": True}


@router.post("/boats/{boat_id}/invites")
async def invite_crew(boat_id: BoatPath, payload: InviteIn, request: Request, user: dict = Depends(require_premium)):
    doc = await owned_boat(user, boat_id)
    try:
        email = validate_email(payload.email.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    key = email_key(email)
    if key == email_key(user["email"]):
        raise HTTPException(status_code=400, detail="That's your own email address")
    crew = await db.users.find({"user_id": {"$in": doc.get("crew") or []}}, {"_id": 0, "email": 1}).to_list(100)
    if any(email_key(m.get("email", "")) == key for m in crew):
        raise HTTPException(status_code=400, detail="They're already crew on this boat")
    if await db.invite_sends.count_documents({"owner_id": user["user_id"], "at": {"$gte": datetime.now(timezone.utc) - timedelta(days=1)}}) >= DAILY_INVITE_LIMIT:
        raise HTTPException(status_code=429, detail="Daily invite limit reached, try again tomorrow")
    vessel = doc.get("boat", {}).get("vessel", "").strip() or "my boat"
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    roles = clean_roles(payload.roles)
    notes = payload.notes.strip()
    name = re.sub(r"\s+", " ", payload.name).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Please enter your crew member's name")
    invite = {"invite_id": str(uuid.uuid4()), "token_hash": _hash(token), "owner_id": user["user_id"], "boat_id": boat_id, "email": email, "email_key": key, "name": name,
              "roles": roles, "created_at": now.isoformat(), "expires_at": (now + timedelta(days=INVITE_DAYS)).isoformat()}
    if payload.send_email:
        # The skipper's phone sends its briefings too, so one typed just before inviting is included even if it hasn't synced yet.
        briefs = await role_briefings(user["user_id"], boat_id)
        wanted = {r.lower() for r in roles}
        briefs.update({role_label(k).lower(): str(v).strip()[:2000] for k, v in payload.briefings.items() if role_label(k).lower() in wanted and str(v).strip()})
        await send_email(to=[email], subject=f"Join the crew of {vessel} on My Boat Prep",
                         html=invite_html(user.get("name") or user["email"], vessel, email, f"{public_base(request)}/", roles, notes, briefs, name,
                                          [s.strip() for s in payload.shopping if s.strip()]))
    await db.invite_sends.insert_one({"owner_id": user["user_id"], "at": now})
    await db.crew_invites.delete_many({"owner_id": user["user_id"], "boat_id": boat_id, "$or": [{"email": email}, {"email_key": key}]})
    await db.crew_invites.insert_one(invite)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"voyage_notes": notes}})
    return {"invite_id": invite["invite_id"], "name": name, "email": email, "roles": roles, "created_at": invite["created_at"]}


@router.put("/boats/{boat_id}/voyage-notes")
async def save_voyage_notes(boat_id: BoatPath, payload: NotesIn, user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"voyage_notes": payload.notes.strip()}})
    return {"ok": True}


def prep_counts(items: list) -> dict:
    """Ticked / total on a Crew Prep list; group headings aren't tasks so they don't count."""
    tasks = [i for n, i in enumerate(items) if not (not i.get("indent") and n + 1 < len(items) and items[n + 1].get("indent"))]
    return {"ticked": sum(1 for i in tasks if i.get("checked")), "total": len(tasks)}


async def crew_prep_progress(owner_id: str, boat_id: str) -> dict:
    """Crew name (lower case) -> progress on their own 'Crew Prep - <name>' list."""
    reg = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0, "registry": 1})
    lists = {m.group(1).strip().lower(): (l["id"], l["name"]) for l in (reg or {}).get("registry") or []
             if (m := re.match(r"^\s*crew prep\s*-\s*(.+)$", str(l.get("name", "")), re.I))}
    if not lists:
        return {}
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id}, {"_id": 0, **{f"data.{lid}": 1 for lid, _ in lists.values()}})
    data = (doc or {}).get("data") or {}
    return {k: {"list_id": lid, "list_name": name, **prep_counts(data.get(lid) or [])} for k, (lid, name) in lists.items()}


@router.get("/boats/{boat_id}/crew")
async def get_crew(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    members = await db.users.find({"user_id": {"$in": doc.get("crew") or []}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(100)
    roles = doc.get("crew_roles") or {}
    now = datetime.now(timezone.utc).isoformat()
    invites = await db.crew_invites.find({"owner_id": user["user_id"], "boat_id": boat_id, "expires_at": {"$gt": now}},
                                         {"_id": 0, "invite_id": 1, "name": 1, "email": 1, "roles": 1, "declined_at": 1, "created_at": 1}).to_list(100)
    rsvp = doc.get("rsvp") or {}
    names, agreements = doc.get("crew_names") or {}, doc.get("agreements") or {}
    prep = await crew_prep_progress(user["user_id"], boat_id)
    for i in invites:
        i["prep"] = prep.get((i.get("name") or "").strip().lower())
    crew = [{**m, "name": names.get(m["user_id"]) or m.get("name"), "roles": roles.get(m["user_id"], []), "rsvp": (rsvp.get(m["user_id"]) or {}).get("status"),
             "agreement": agreements.get(m["user_id"])} for m in members]
    return {"crew": [{**m, "prep": prep.get((m["name"] or "").strip().lower())} for m in crew], "invites": invites,
            "role_options": await role_options(user["user_id"], boat_id, doc, invites), "voyage_notes": doc.get("voyage_notes", ""),
            "watch_rota": doc.get("watch_rota"), "boat_terms": doc.get("boat_terms", "")}


class RotaPerson(BaseModel):
    id: str = Field(max_length=80)
    name: str = Field(max_length=120)
    roles: List[str] = Field(default_factory=list, max_length=20)


LOCAL_DT = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"


class RotaSlot(BaseModel):
    start: str = Field(pattern=LOCAL_DT)
    end: str = Field(pattern=LOCAL_DT)
    watch: str = Field(max_length=20)
    people: List[int] = Field(max_length=2)


class RotaIn(BaseModel):
    start: str = Field(pattern=LOCAL_DT)
    hours: int = Field(ge=1, le=336)
    per_watch: int = Field(ge=1, le=2)
    people: List[RotaPerson] = Field(min_length=1, max_length=30)
    slots: List[RotaSlot] = Field(min_length=1, max_length=400)


@router.put("/boats/{boat_id}/watch-rota")
async def save_watch_rota(boat_id: BoatPath, payload: RotaIn, user: dict = Depends(require_premium)):
    await owned_boat(user, boat_id)
    if any(p < 0 or p >= len(payload.people) for s in payload.slots for p in s.people) or any(len(set(s.people)) != len(s.people) for s in payload.slots):
        raise HTTPException(status_code=400, detail="The rota lists someone who isn't on it")
    rota = {**payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"watch_rota": rota}})
    return {"watch_rota": rota}


@router.delete("/boats/{boat_id}/watch-rota")
async def delete_watch_rota(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$unset": {"watch_rota": ""}})
    return {"ok": True}


class RolesIn(BaseModel):
    roles: List[str] = Field(default_factory=list, max_length=20)


MemberPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


@router.put("/boats/{boat_id}/crew/{member_id}/roles")
async def set_crew_roles(boat_id: BoatPath, member_id: MemberPath, payload: RolesIn, user: dict = Depends(get_current_user)):
    doc = await owned_boat(user, boat_id)
    if member_id not in (doc.get("crew") or []):
        raise HTTPException(status_code=404, detail="They're no longer crew on this boat")
    roles = clean_roles(payload.roles)
    res = await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id, "crew": member_id}, {"$set": {f"crew_roles.{member_id}": roles}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="They're no longer crew on this boat")
    return {"roles": roles}


@router.delete("/boats/{boat_id}/rsvp")
async def clear_rsvp(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$unset": {"rsvp": ""}})
    return {"ok": True}


class CrewBoatIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")


class RsvpIn(CrewBoatIn):
    status: Literal["in", "out"]


async def crew_boat(user: dict, owner_id: str, boat_id: str) -> dict:
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "crew": user["user_id"]}, {"_id": 0, "boat_id": 1, "voyage_notes": 1, "watch_rota": 1, f"rsvp.{user['user_id']}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return doc


@router.get("/crew/voyage")
async def crew_voyage(owner_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")], boat_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")],
                      user: dict = Depends(get_current_user)):
    doc = await crew_boat(user, owner_id, boat_id)
    return {"notes": doc.get("voyage_notes", ""), "rsvp": ((doc.get("rsvp") or {}).get(user["user_id"]) or {}).get("status"), "rota": doc.get("watch_rota")}


@router.post("/crew/rsvp")
async def crew_rsvp(payload: RsvpIn, user: dict = Depends(get_current_user)):
    res = await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id, "crew": user["user_id"]},
                                         {"$set": {f"rsvp.{user['user_id']}": {"status": payload.status, "at": datetime.now(timezone.utc).isoformat()}}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return {"rsvp": payload.status}


@router.delete("/boats/{boat_id}/crew/{member_id}")
async def remove_crew(boat_id: BoatPath, member_id: Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")], user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$pull": {"crew": member_id}, "$unset": {f"crew_roles.{member_id}": "", f"rsvp.{member_id}": "", f"agreements.{member_id}": "", f"crew_names.{member_id}": ""}})
    return {"ok": True}


@router.delete("/boats/{boat_id}/invites/{invite_id}")
async def cancel_invite(boat_id: BoatPath, invite_id: Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")], user: dict = Depends(get_current_user)):
    await db.crew_invites.delete_one({"owner_id": user["user_id"], "boat_id": boat_id, "invite_id": invite_id})
    return {"ok": True}


class JoinIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)


async def accept_invite(inv: dict, user: dict) -> dict:
    if user["user_id"] == inv["owner_id"]:
        raise HTTPException(status_code=400, detail="That's your own boat")
    key = {"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]}
    res = await db.user_boats.update_one(key, {"$addToSet": {"crew": user["user_id"]}, "$unset": {f"agreements.{user['user_id']}": ""},
                                                "$set": {f"crew_roles.{user['user_id']}": inv.get("roles") or [], **({f"crew_names.{user['user_id']}": inv["name"]} if inv.get("name") else {})}})
    await db.crew_invites.delete_one({"invite_id": inv["invite_id"]})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="That boat no longer exists")
    key = f"c_{inv['owner_id']}_{inv['boat_id']}"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_boat": key}})
    return {"key": key}


@router.post("/crew/join")
async def join_crew(payload: JoinIn, user: dict = Depends(get_current_user)):
    inv = await db.crew_invites.find_one({"token_hash": _hash(payload.token)}, {"_id": 0})
    if not inv or inv["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This invite has expired or was cancelled. Ask the skipper for a new one.")
    if email_key(inv["email"]) != email_key(user["email"]):
        raise HTTPException(status_code=403, detail=f"This invite was sent to {inv['email']}. Sign in with that email to accept it.")
    return await accept_invite(inv, user)


async def my_invite(invite_id: str, user: dict) -> dict:
    inv = await db.crew_invites.find_one({"invite_id": invite_id, "email_key": email_key(user["email"]), "declined_at": None,
                                         "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="This invite has expired or was cancelled. Ask the skipper for a new one.")
    return inv


InvitePath = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]


@router.get("/crew/pending")
async def pending_invites(user: dict = Depends(get_current_user)):
    invs = await db.crew_invites.find({"email_key": email_key(user["email"]), "declined_at": None, "owner_id": {"$ne": user["user_id"]},
                                       "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}}, {"_id": 0}).sort("created_at", 1).to_list(20)
    out = []
    for inv in invs:
        boat = await db.user_boats.find_one({"owner_id": inv["owner_id"], "boat_id": inv["boat_id"]}, {"_id": 0, "boat.vessel": 1, "crew": 1})
        if not boat or user["user_id"] in (boat.get("crew") or []):
            continue
        owner = await db.users.find_one({"user_id": inv["owner_id"]}, {"_id": 0, "name": 1, "email": 1}) or {}
        out.append({"invite_id": inv["invite_id"], "vessel": (boat.get("boat") or {}).get("vessel", "").strip() or "their boat",
                    "skipper": owner.get("name") or owner.get("email") or "A skipper"})
    return {"invites": out}


@router.post("/crew/invites/{invite_id}/accept")
async def accept_pending(invite_id: InvitePath, user: dict = Depends(get_current_user)):
    return await accept_invite(await my_invite(invite_id, user), user)


@router.post("/crew/invites/{invite_id}/decline")
async def decline_pending(invite_id: InvitePath, user: dict = Depends(get_current_user)):
    inv = await my_invite(invite_id, user)
    await db.crew_invites.update_one({"invite_id": inv["invite_id"]}, {"$set": {"declined_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


async def backfill_invite_keys():
    async for inv in db.crew_invites.find({"email_key": {"$exists": False}}, {"_id": 1, "email": 1}):
        await db.crew_invites.update_one({"_id": inv["_id"]}, {"$set": {"email_key": email_key(inv.get("email", ""))}})


class LeaveIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")


@router.post("/crew/leave")
async def leave_crew(payload: LeaveIn, user: dict = Depends(get_current_user)):
    await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id}, {"$pull": {"crew": user["user_id"]}, "$unset": {f"crew_roles.{user['user_id']}": "", f"rsvp.{user['user_id']}": "", f"agreements.{user['user_id']}": "", f"crew_names.{user['user_id']}": ""}})
    return {"ok": True}
