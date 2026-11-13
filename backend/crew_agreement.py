import re
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, to_user_out
import joincrew
from crew import SHORE_BRIEF, BoatPath, brief_hash, owned_boat, role_briefings
from crew_register import record_walkthrough
from agreement_pdf import build_agreement_pdf

router = APIRouter(prefix="/api")
TERMS_LIST = r"^\s*admin\s*-\s*boat terms( and conditions)?\s*$"
TERMS_MAX = 4000
DEFAULT_TERMS = [
    "The skipper has the final say on every decision aboard, including whether to sail.",
    "Wear a lifejacket when the skipper asks, and always on deck at night or in rough weather.",
    "Follow the skipper's briefings, and ask straight away if anything is unclear.",
    "No alcohol or drugs while on watch or handling the boat.",
    "Tell the skipper about any medical conditions, medication or allergies before sailing.",
    "Look after the boat and its gear, and report any damage or problem straight away.",
    "Put gear back where it came from, so everyone can find it in a hurry.",
    "Respect your crewmates, other boats and the sea: nothing goes overboard.",
]
OwnerQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]


class TermsIn(BaseModel):
    terms: str = Field(default="", max_length=TERMS_MAX)


class AgreementIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    stops: List[str] = Field(default_factory=list, max_length=600)
    accept: bool = False
    quick: bool = False
    shore_ok: bool = False


class WalkSkipIn(BaseModel):
    skip: List[str] = Field(default_factory=list, max_length=600)


def map_pins(m: dict) -> list:
    """A photo's labels; a photo with only a Skipper's comment is one stop of its own."""
    if m.get("pins"):
        return m["pins"]
    if m.get("kind") != "overview" and (m.get("comment") or "").strip():
        return [{"id": "comment", "label": m.get("name") or m.get("zone") or "Zone map photo", "area_id": None}]
    return []


def crew_skip(doc: dict, uid: str | None) -> List[str]:
    """The stops left out for this crew member: their own choice from the invite, else the boat's default."""
    own = doc.get("walk_skip_crew") or {}
    return own[uid] if uid and uid in own else doc.get("walk_skip") or []


CONTENTS = "+c:"  # walk_skip entries starting with this switch a stop's cupboard contents on in the walkthrough


def all_stops(doc: dict) -> List[str]:
    """Every cupboard labelled on a zone map photo is a stop, and so is a photo with only a Skipper's comment;
    cupboards not labelled on any photo need their own photo and a comment."""
    areas = [a for a in doc.get("areas") or [] if isinstance(a, dict)]
    by_id = {a.get("id"): a for a in areas}
    said = lambda a: bool(str((a or {}).get("comment") or "").strip())  # noqa: E731
    maps = doc.get("zone_maps") or []
    pinned = {p.get("area_id") for m in maps for p in m.get("pins") or []}
    pins = [f"{m['id']}:{p['id']}" for m in maps for p in map_pins(m)]
    return pins + [f"area:{a['id']}" for a in areas if not a.get("parent_id") and a.get("id") not in pinned and said(a) and (a.get("photo") or {}).get("id")]


def stop_ids(doc: dict, uid: str | None = None) -> List[str]:
    skip = set(crew_skip(doc, uid))
    return [s for s in all_stops(doc) if s not in skip]


@router.put("/boats/{boat_id}/walk-stops")
async def save_walk_stops(boat_id: BoatPath, payload: WalkSkipIn, user: dict = Depends(get_current_user)):
    """The skipper leaves less important cupboards out of the Boat Walk Through."""
    await owned_boat(user, boat_id)
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "zone_maps": 1, "areas": 1})
    stops = all_stops(doc)
    known = {*stops, *(CONTENTS + k for k in stops if not k.endswith(":comment"))}
    skip = [s for s in dict.fromkeys(payload.skip) if s in known]
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"walk_skip": skip}})
    return {"walk_skip": skip}


class WalkStarsIn(BaseModel):
    stars: List[Annotated[str, Field(max_length=120)]] = Field(max_length=600)


@router.put("/boats/{boat_id}/walk-stars")
async def save_walk_stars(boat_id: BoatPath, payload: WalkStarsIn, user: dict = Depends(get_current_user)):
    """Gold stars the skipper gives stops on the Crew Walkthrough. Only the skipper sees them; crew never get them."""
    await owned_boat(user, boat_id)
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "zone_maps": 1, "areas": 1})
    known = set(all_stops(doc))
    stars = [s for s in dict.fromkeys(payload.stars) if s in known]
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"walk_stars": stars}})
    return {"walk_stars": stars}


async def standard_terms() -> List[dict]:
    doc = await db.list_templates.find_one({"custom": True, "name": {"$regex": TERMS_LIST, "$options": "i"}}, {"_id": 0, "items": 1})
    return [{"label": i["label"], **({"indent": True} if i.get("indent") else {})} for i in (doc or {}).get("items") or []]


@router.put("/boats/{boat_id}/terms")
async def save_boat_terms(boat_id: BoatPath, payload: TermsIn, user: dict = Depends(get_current_user)):
    await owned_boat(user, boat_id)
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"boat_terms": payload.terms.strip()}})
    return {"boat_terms": payload.terms.strip()}


async def crew_doc(user: dict, owner_id: str, boat_id: str) -> dict:
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "crew": user["user_id"]},
                                       {"_id": 0, "boat_terms": 1, "zone_maps": 1, "areas": 1, "walk_skip": 1, f"walk_skip_crew.{user['user_id']}": 1, f"crew_roles.{user['user_id']}": 1, f"agreements.{user['user_id']}": 1, "shore_ids": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return doc


@router.get("/crew/agreement")
async def get_agreement(owner_id: OwnerQ, boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc = await crew_doc(user, owner_id, boat_id)
    briefs = await role_briefings(owner_id, boat_id)
    roles = (doc.get("crew_roles") or {}).get(user["user_id"]) or []
    reads = {r["role_key"]: r async for r in db.briefing_reads.find({"owner_id": owner_id, "boat_id": boat_id, "user_id": user["user_id"]}, {"_id": 0})}
    seen = lambda r: (reads.get(r.lower()) or {}).get("at") if briefs.get(r.lower()) and (reads.get(r.lower()) or {}).get("hash") == brief_hash(briefs[r.lower()]) else None  # noqa: E731
    return {"terms": await standard_terms(), "boat_terms": doc.get("boat_terms", ""), "roles": [{"role": r, "briefing": briefs.get(r.lower(), ""), "read_at": seen(r)} for r in roles],
            "agreement": (doc.get("agreements") or {}).get(user["user_id"]), "walkthrough": await last_walk(owner_id, boat_id, user),
            "shore_brief": SHORE_BRIEF if doc.get("shore_ids") else [],
            "joincrew_offer": not user.get("joincrew") and not to_user_out(user).has_subscription and await joincrew.live()}


async def last_walk(owner_id: str, boat_id: str, user: dict) -> Optional[dict]:
    """When this crew member last did the complete walkthrough of this boat, so a returning racer can quick-accept."""
    w = await db.walkthroughs.find_one({"owner_id": owner_id, "boat_id": boat_id, "user_id": user["user_id"]}, {"_id": 0, "at": 1, "full_at": 1})
    return {"full_at": w.get("full_at") or w["at"]} if w else None


@router.post("/crew/agreement")
async def save_agreement(payload: AgreementIn, user: dict = Depends(get_current_user)):
    doc = await crew_doc(user, payload.owner_id, payload.boat_id)
    all_stops = stop_ids(doc, user["user_id"])
    walk = await last_walk(payload.owner_id, payload.boat_id, user) if payload.quick and payload.accept else None
    if payload.quick and payload.accept and not walk:
        raise HTTPException(status_code=400, detail="Quick accept is for crew who have done the complete walkthrough before")
    ticked = all_stops if walk else [s for s in dict.fromkeys(payload.stops) if s in all_stops]
    if payload.accept and len(ticked) < len(all_stops):
        raise HTTPException(status_code=400, detail="Tick every stop of the Boat Walk Through before you accept")
    if payload.accept and doc.get("shore_ids") and not payload.shore_ok:
        raise HTTPException(status_code=400, detail="Tick that you understand the shore contact alert instructions before you accept")
    prev = (doc.get("agreements") or {}).get(user["user_id"]) or {}
    now = datetime.now(timezone.utc).isoformat()
    rec = {"stops": ticked, "stops_total": len(all_stops), "updated_at": now,
           **({"accepted_at": now} if payload.accept else {"accepted_at": prev["accepted_at"]} if prev.get("accepted_at") else {}),
           **({"quick": True, "full_at": walk["full_at"]} if walk and payload.accept else {}),
           **({"shore_ok_at": now if payload.accept else prev.get("shore_ok_at") or now} if payload.shore_ok and doc.get("shore_ids")
              else {"shore_ok_at": prev["shore_ok_at"]} if prev.get("accepted_at") and prev.get("shore_ok_at") else {})}
    await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id, "crew": user["user_id"]}, {"$set": {f"agreements.{user['user_id']}": rec}})
    if payload.accept and all_stops:
        await record_walkthrough(payload.owner_id, payload.boat_id, user, quick=bool(walk))
    return {"agreement": rec}


class BriefingReadIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    role: str = Field(min_length=1, max_length=60)


@router.post("/crew/briefing-read")
async def briefing_read(payload: BriefingReadIn, user: dict = Depends(get_current_user)):
    """Crew confirm they've read the briefing for one of their roles; a changed briefing needs reading again."""
    doc = await crew_doc(user, payload.owner_id, payload.boat_id)
    key = payload.role.strip().lower()
    if key not in [r.lower() for r in (doc.get("crew_roles") or {}).get(user["user_id"]) or []]:
        raise HTTPException(status_code=400, detail="That isn't one of your roles on this boat")
    brief = (await role_briefings(payload.owner_id, payload.boat_id)).get(key)
    if not brief:
        raise HTTPException(status_code=400, detail="There's no briefing for that role yet")
    now = datetime.now(timezone.utc).isoformat()
    await db.briefing_reads.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id, "user_id": user["user_id"], "role_key": key},
                                       {"$set": {"hash": brief_hash(brief), "at": now}}, upsert=True)
    return {"role": payload.role, "read_at": now}


class WhereIn(BaseModel):
    owner_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")


@router.post("/crew/shore-brief-ok")
async def shore_brief_ok(payload: WhereIn, user: dict = Depends(get_current_user)):
    """Crew who accepted before the shore contact instructions existed confirm them on their own."""
    doc = await crew_doc(user, payload.owner_id, payload.boat_id)
    if not doc.get("shore_ids"):
        raise HTTPException(status_code=400, detail="This boat has no shore contact")
    now = datetime.now(timezone.utc).isoformat()
    await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id, "crew": user["user_id"]}, {"$set": {f"agreements.{user['user_id']}.shore_ok_at": now}})
    return {"shore_ok_at": now}


@router.get("/crew/agreement/pdf")
async def agreement_pdf(boat_id: BoatQ, owner_id: Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")] = None,
                        member_id: Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")] = None, user: dict = Depends(get_current_user)):
    """The skipper can download any crew member's agreement; crew can download only their own."""
    owner_id = owner_id or user["user_id"]
    member = member_id or user["user_id"]
    if owner_id != user["user_id"] and member != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only download your own agreement")
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "crew": member},
                                       {"_id": 0, "boat": 1, "boat_terms": 1, "zone_maps": 1, "areas": 1, "crew_roles": 1, "crew_names": 1, "agreements": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="That crew member isn't on this boat")
    people = {u["user_id"]: u for u in await db.users.find({"user_id": {"$in": [owner_id, member]}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(2)}
    crew_user, owner = people.get(member) or {}, people.get(owner_id) or {}
    briefs = await role_briefings(owner_id, boat_id)
    rec = (doc.get("agreements") or {}).get(member) or {}
    areas = {a.get("id"): a for a in doc.get("areas") or [] if isinstance(a, dict)}
    pins = [(f"{m['id']}:{p['id']}", (areas.get(p.get("area_id")) or {}).get("name") or p.get("label") or f"Stop {n + 1}",
             str((areas.get(p.get("area_id")) or {}).get("comment") or (m.get("comment") if p["id"] == "comment" else "") or "").strip()[:1000])
            for m in doc.get("zone_maps") or [] for n, p in enumerate(map_pins(m))]
    pins += [(f"area:{a.get('id')}", a.get("name") or "Cupboard", str(a.get("comment") or "").strip()[:1000]) for a in areas.values()]
    crew_name = (doc.get("crew_names") or {}).get(member) or crew_user.get("name") or crew_user.get("email") or "Crew"
    pdf = build_agreement_pdf({
        "vessel": (doc.get("boat") or {}).get("vessel") or "My Boat", "skipper": owner.get("name") or owner.get("email") or "Skipper",
        "crew_name": crew_name, "crew_email": crew_user.get("email", ""),
        "roles": [(r, briefs.get(r.lower(), "")) for r in (doc.get("crew_roles") or {}).get(member) or []],
        "terms": await standard_terms(), "boat_terms": doc.get("boat_terms", ""), "stops": [(name, note) for sid, name, note in pins if sid in (rec.get("stops") or [])], "agreement": rec})
    safe = re.sub(r"[^\w .-]", "", crew_name)[:60] or "Crew"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="Boat Agreement - {safe}.pdf"'})


async def seed_terms_template():
    """Runs once: adds the private 'Admin - Boat Terms and Conditions' list every crew agreement starts with, if it isn't there already."""
    if await db.migrations.find_one({"_id": "boat_terms_template"}):
        return
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": TERMS_LIST, "$options": "i"}}, {"_id": 1}):
        now = datetime.now(timezone.utc).isoformat()
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": "Admin - Boat Terms and Conditions", "private": True,
                                            "description": "Standard terms every crew member reads and accepts when they join a boat. Each skipper can add their own boat's terms.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(DEFAULT_TERMS)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "boat_terms_template", "at": datetime.now(timezone.utc).isoformat()})
