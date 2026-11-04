import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user
from crew import CrewBoatIn, owned_boat

router = APIRouter(prefix="/api")
BoatPath = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
WHEN = r"[^\w ,:/.\-]"


class GoPhoto(BaseModel):
    id: str = Field(pattern=r"^[a-f0-9]{32}$")
    note: str = Field(default="", max_length=300)


class GoPlanIn(BaseModel):
    start: str = Field(default="", max_length=80)
    dest: str = Field(default="", max_length=80)
    why: str = Field(default="", max_length=1000)
    photos: List[GoPhoto] = Field(default_factory=list, max_length=5)
    when: str = Field(min_length=1, max_length=60)


class AnswerIn(CrewBoatIn):
    plan_id: str = Field(pattern=r"^[a-f0-9]{12}$")
    agree: bool
    reason: str = Field(default="", max_length=500)
    when: str = Field(min_length=1, max_length=60)


def route_of(plan: dict) -> str:
    return " to ".join(p for p in (plan.get("start", "").strip(), plan.get("dest", "").strip()) if p) or "the planned passage"


async def push_log(owner_id: str, boat_id: str, label: str) -> None:
    now = datetime.now(timezone.utc)
    # Millisecond id plus a random tail so two answers in the same instant never share an id.
    item = {"id": int(now.timestamp() * 1000) * 1000 + secrets.randbelow(1000), "label": label[:2000], "checked": False, "ts": now.isoformat()}
    await db.user_boats.update_one({"owner_id": owner_id, "boat_id": boat_id},
                                   {"$push": {"data.shipsLog": item, "pushed_items": {"list": "shipsLog", "item": item}}, "$set": {"updated_at": now.isoformat()}})


@router.post("/boats/{boat_id}/go-plan")
async def send_go_plan(boat_id: BoatPath, payload: GoPlanIn, user: dict = Depends(get_current_user)):
    """Skipper shares the route, weather photos and 'why we're going'; every earlier crew answer is cleared so all are asked again."""
    doc = await owned_boat(user, boat_id)
    if not (payload.start.strip() or payload.dest.strip() or payload.why.strip() or payload.photos):
        raise HTTPException(status_code=400, detail="Add the route, a weather photo or why you're going first")
    now = datetime.now(timezone.utc).isoformat()
    plan = {"plan_id": uuid.uuid4().hex[:12], "start": payload.start.strip(), "dest": payload.dest.strip(), "why": payload.why.strip(),
            "photos": [p.model_dump() for p in payload.photos], "sent_at": now}
    await db.user_boats.update_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"$set": {"go_plan": plan}, "$unset": {"go_answers": ""}})
    who = (user.get("name") or "The skipper").strip()[:80]
    when = re.sub(WHEN, "", payload.when).strip()
    n = len(doc.get("crew") or [])
    await push_log(user["user_id"], boat_id, f"Decision to go sent to the crew by {who} on {when}: {route_of(plan)}"
                   f" ({len(plan['photos'])} weather/routing {'photo' if len(plan['photos']) == 1 else 'photos'}, {n} crew asked to agree)")
    return {"plan": plan}


@router.get("/boats/{boat_id}/go-plan")
async def get_go_plan(boat_id: BoatPath, user: dict = Depends(get_current_user)):
    doc = await db.user_boats.find_one({"owner_id": user["user_id"], "boat_id": boat_id}, {"_id": 0, "go_plan": 1, "go_answers": 1, "crew": 1, "crew_names": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Boat not found. Wait for it to sync, then try again.")
    members = await db.users.find({"user_id": {"$in": doc.get("crew") or []}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(100)
    names, answers = doc.get("crew_names") or {}, doc.get("go_answers") or {}
    now = datetime.now(timezone.utc).isoformat()
    invites = await db.crew_invites.find({"owner_id": user["user_id"], "boat_id": boat_id, "expires_at": {"$gt": now}, "declined_at": {"$exists": False}},
                                         {"_id": 0, "invite_id": 1, "name": 1, "email": 1}).to_list(100)
    crew = [{"user_id": m["user_id"], "name": names.get(m["user_id"]) or m.get("name") or m.get("email", ""), "answer": answers.get(m["user_id"])} for m in members]
    return {"plan": doc.get("go_plan"), "crew": crew, "pending": [{"invite_id": i["invite_id"], "name": i.get("name") or i.get("email", "")} for i in invites]}


@router.get("/crew/go-plan")
async def crew_go_plan(owner_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")], boat_id: Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")],
                       user: dict = Depends(get_current_user)):
    doc = await db.user_boats.find_one({"owner_id": owner_id, "boat_id": boat_id, "crew": user["user_id"]}, {"_id": 0, "go_plan": 1, f"go_answers.{user['user_id']}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    return {"plan": doc.get("go_plan"), "answer": (doc.get("go_answers") or {}).get(user["user_id"])}


@router.post("/crew/go-plan/answer")
async def answer_go_plan(payload: AnswerIn, user: dict = Depends(get_current_user)):
    reason = re.sub(r"\s+", " ", payload.reason).strip()
    if not payload.agree and not reason:
        raise HTTPException(status_code=400, detail="Please say why you don't agree")
    key = {"owner_id": payload.owner_id, "boat_id": payload.boat_id, "crew": user["user_id"]}
    doc = await db.user_boats.find_one(key, {"_id": 0, "go_plan": 1, f"crew_names.{user['user_id']}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="You're no longer crew on this boat")
    plan = doc.get("go_plan") or {}
    if plan.get("plan_id") != payload.plan_id:
        raise HTTPException(status_code=409, detail="The skipper has sent a newer plan. Please read it and answer again.")
    answer = {"agree": payload.agree, "reason": "" if payload.agree else reason, "at": datetime.now(timezone.utc).isoformat(), "plan_id": plan["plan_id"]}
    await db.user_boats.update_one(key, {"$set": {f"go_answers.{user['user_id']}": answer}})
    name = ((doc.get("crew_names") or {}).get(user["user_id"]) or user.get("name") or user.get("email") or "Crew").strip()[:80]
    when = re.sub(WHEN, "", payload.when).strip()
    verdict = "AGREED to the decision to go" if payload.agree else f"did NOT agree to the decision to go - reason: {reason}"
    await push_log(payload.owner_id, payload.boat_id, f"Decision to go: {name} {verdict} ({route_of(plan)}), answered {when}")
    return {"answer": answer}
