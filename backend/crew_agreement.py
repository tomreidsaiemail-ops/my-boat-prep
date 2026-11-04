import re
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user
from crew import BoatPath, owned_boat, role_briefings
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


def stop_ids(doc: dict) -> List[str]:
    return [f"{m['id']}:{p['id']}" for m in doc.get("zone_maps") or [] for p in m.get("pins") or []]


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
                                       {"_id": 0, "boat_terms": 1, "zone_maps": 1, f"crew_roles.{user['user_id']}": 1, f"agreements.{user['user_id']}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return doc


@router.get("/crew/agreement")
async def get_agreement(owner_id: OwnerQ, boat_id: BoatQ, user: dict = Depends(get_current_user)):
    doc = await crew_doc(user, owner_id, boat_id)
    briefs = await role_briefings(owner_id, boat_id)
    roles = (doc.get("crew_roles") or {}).get(user["user_id"]) or []
    return {"terms": await standard_terms(), "boat_terms": doc.get("boat_terms", ""), "roles": [{"role": r, "briefing": briefs.get(r.lower(), "")} for r in roles],
            "agreement": (doc.get("agreements") or {}).get(user["user_id"])}


@router.post("/crew/agreement")
async def save_agreement(payload: AgreementIn, user: dict = Depends(get_current_user)):
    doc = await crew_doc(user, payload.owner_id, payload.boat_id)
    all_stops = stop_ids(doc)
    ticked = [s for s in dict.fromkeys(payload.stops) if s in all_stops]
    if payload.accept and len(ticked) < len(all_stops):
        raise HTTPException(status_code=400, detail="Tick every stop of the Zone Map Walk Through before you accept")
    prev = (doc.get("agreements") or {}).get(user["user_id"]) or {}
    now = datetime.now(timezone.utc).isoformat()
    rec = {"stops": ticked, "stops_total": len(all_stops), "updated_at": now,
           **({"accepted_at": now} if payload.accept else {"accepted_at": prev["accepted_at"]} if prev.get("accepted_at") else {})}
    await db.user_boats.update_one({"owner_id": payload.owner_id, "boat_id": payload.boat_id, "crew": user["user_id"]}, {"$set": {f"agreements.{user['user_id']}": rec}})
    return {"agreement": rec}


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
    areas = {a.get("id"): a.get("name") for a in doc.get("areas") or [] if isinstance(a, dict)}
    pins = [(f"{m['id']}:{p['id']}", areas.get(p.get("area_id")) or p.get("label") or f"Stop {n + 1}")
            for m in doc.get("zone_maps") or [] for n, p in enumerate(m.get("pins") or [])]
    crew_name = (doc.get("crew_names") or {}).get(member) or crew_user.get("name") or crew_user.get("email") or "Crew"
    pdf = build_agreement_pdf({
        "vessel": (doc.get("boat") or {}).get("vessel") or "My Boat", "skipper": owner.get("name") or owner.get("email") or "Skipper",
        "crew_name": crew_name, "crew_email": crew_user.get("email", ""),
        "roles": [(r, briefs.get(r.lower(), "")) for r in (doc.get("crew_roles") or {}).get(member) or []],
        "terms": await standard_terms(), "boat_terms": doc.get("boat_terms", ""), "stops": [(name, sid in (rec.get("stops") or [])) for sid, name in pins], "agreement": rec})
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
