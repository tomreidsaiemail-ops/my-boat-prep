"""Welcome screen: the questions skippers answer (from the private admin list "Admin - Welcome Screen"), the visits they've made,
and the Global Config line that sends everyone back to Welcome once: "Force Welcome screen visit, <number>"."""
import re
from datetime import datetime, timezone
from typing import Dict, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api")
LIST_NAME = "Admin - Welcome Screen"
FORCE = re.compile(r"^\s*force welcome screen visit\s*,\s*(\d{1,6})\s*$", re.I)
TOPICS = (("find", r"find anything"), ("crew", r"crew to be better"), ("trip", r"draft a plan"), ("racer", r"racer"),
          ("sell", r"sell my boat"), ("lend", r"lend my boat"), ("fish", r"fishing"), ("provision", r"provisioning"))

LINES = """1. I would like to be able to find anything on my boat easily and quickly.
I'd like to define the zones of my boat, like cockpit, galley, saloon, forward cabin and so on, and then scan what is in those cupboards, and be able to find them, even offshore and disconnected.
I can never find my manuals, receipts and last rigging report, ideally I'd like to be able to scan a folder or a box, and place that in a cupboard around my nav station, and be able to find those too.
I want to be able to search for items like "Bolt" cutters, "Bung", "Raymarine", "autopilot" would be really useful in a stressful situation.
I would never put my details into an app where I could not get the same details back out, and any changes I made also back out.
I want to be able to take my own full back up of what I have on board
2. I would like my crew to be better prepared and safer.
I want to send them an email or a whatsapp message days before they show up at the dock telling them how to prepare.
I want to explicitly tell them how important it is to me that they show up on time for the briefing.
I want to allocate different roles to crew members, and brief them on those roles days ahead of them showing up at the dock.
I have rules about the toilet and the sea cocks and the holding tank, I'd like the crew to know about those so I can concentrate on really important stuff during the briefing at the dock.
I'd like to give the crew a virtual walkthrough of the boat before they get on the boat, for example my crew member friend is an excellent sailor and an engineer, I'd like to show them the technical lockers, however my partner does provisioning she doesn't need to see that, but my partner should see the cupboard layouts, where their cabin and head are
I am a racer and my crew are experienced, however I have a new crew member coming on Friday, I want to have a more elaborate walkthrough, safety precautions for them that I do not want to bore my experienced crew with at the dock.
In an emergency situation, I want a mayday call going out from the nav desk vhf radio broadcast from the top of my mast not from my handheld vhf and I want a crew member to make it as I'll be busy.  I want the crew member to read the mayday call out from a list with the boats GPS and details all filled out so I can attend to the issue at hand. So a "Radio Operator" role, and a quick GPS button
3. I would like to draft a plan for a trip quickly, and keep my crew in the loop with my rough plan.
3.1 (crew who maybe do not have the same weather routing and passage planning software you do)
I would like a simple leaving dock and returning to dock plan with all the crew safety features mentioned above.
I would like a draft plan for going somewhere for a night and returning to the dock the next day with all the crew safety features mentioned above.
I would like a draft plan for going to a cruising ground, where I may add or delete legs of the plan when we get there, maybe due to weather, or a crew suggested fishing spot
I would like a draft plan for going across an ocean with crew, I intended to use a well known weather product and a well known routing product, but I want to share my draft plan with provisioning and checklists with my crew
I want to be able to keep track of fuel, water and LPG levels.
I would like everything from the trip logged in the ships log, but I'd like it collapsed into one line representing the trip.
I would like a shore contact to know where we are at all times by sharing a map with them.
4. I'm a racer, and am interested in things like boat weight and maintenance schedules and of course crew safety.
I would like to have an inventory of all the rigging on deck for my boat as per the make, model and year of manufacture.  I do not want to have to type this in!
I'd like to set a general future date for my next inspection
I'd like to add, delete and rename the above deck components as I have made modifications
I'd like an engine, electrical and rigging service history, I'd also like this in the ships log.
I'd like to be able see the weight of everything on board and rough weight for crew
I'd like to email the committee boat about crew details so they have important details in case of emergency
5. I would like to sell my boat and get as much as I can for it
I would like to show what is on my boat
I would like to attach an engine, electrical and rigging service history
I would like a checklist of things I should cover off before I sell my boat
I would like a way to transfer my boat to a new owner, but not crew, or trips I have taken, and I'd like logs redacted
6. I would like to lend my boat out
I'd like the temporary skipper to be able to find anything on board as I have done a full inventory with myboatprep
I'd like to cherry pick ships logs and to do items from the temporary skipper when he returns the boat
I don't want the temporary skipper to change my copy of my boat, but I want to be able to go over the boat on its return and compare it to what it was like before
7. I'm into fishing and would like to know what I've caught, and what the local rules and regs are.
I'd like to share photos of my fish with how much it weighs to my friends.
I'd like to record where I caught something
8. I'm interested in Trip Provisioning.
I'd like to delegate shopping to other crew so I don't have to always shop and pay for it myself.
I'd like some default meal plans, I'd like to get some common meal ideas with the app, and I'd like to be able to delete and add to those with my own.
Please take what's on board, what my 5 day meal plan is, how many of us there are, and produce a shopping list so we get what we need to do the meals and not double.
I'd like to know what cocktails I can mix from what is on board""".split("\n")


def topic(question: str) -> str:
    return next((k for k, pat in TOPICS if re.search(pat, question, re.I)), "")


def welcome_no(user: dict) -> list:
    return [k for k, v in ((user.get("welcome") or {}).get("answers") or {}).items() if v == "no"]


async def _lines(name: str) -> list:
    d = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(name)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    return [str(i.get("label") or "").strip() for i in (d or {}).get("items") or [] if str(i.get("label") or "").strip()]


async def force_number() -> int:
    for line in await _lines("Admin - Global Config"):
        m = FORCE.match(line)
        if m:
            return int(m.group(1))
    return 1


def questions(lines: list) -> list:
    """"1. Question" lines start a question; "3.1 (...)" is a note under it; every other line is one of its bullets."""
    out = []
    for line in lines:
        q = re.match(r"^(\d+)\.\s+(.+)$", line)
        note = re.match(r"^\d+\.\d+\s+(.+)$", line)
        if q:
            out.append({"key": topic(q.group(2)) or f"q{q.group(1)}", "text": q.group(2), "notes": [], "bullets": []})
        elif out:
            out[-1]["notes" if note else "bullets"].append(note.group(1) if note else line)
    return out


async def is_skipper(user: dict) -> bool:
    """Invited crew (crew on someone's boat, no named boat of their own) and shore-only contacts aren't skippers."""
    if user.get("shore_only"):
        return False
    uid = user["user_id"]
    if await db.user_boats.find_one({"owner_id": uid, "model": {"$ne": True}, "boat.vessel": {"$regex": r"\S"}}, {"_id": 1}):
        return True
    return not await db.user_boats.find_one({"crew": uid}, {"_id": 1})


@router.get("/welcome")
async def get_welcome(user: dict = Depends(get_current_user)):
    w = user.get("welcome") or {}
    n = await force_number()
    visits = w.get("visits") or []
    qs = questions(await _lines(LIST_NAME))
    answers = w.get("answers") or {}
    complete = bool(w.get("mv_ack")) and all(q["key"] in answers for q in qs)
    skipper = await is_skipper(user)
    return {"questions": qs, "force": n, "due": n not in visits, "first": not visits, "answers": answers, "mv_ack": bool(w.get("mv_ack")),
            "section": w.get("section") or "", "complete": complete, "skipper": skipper, "home_set": bool(w.get("home_set")),
            "auto": skipper and (not complete or n not in visits)}


@router.post("/welcome/visited")
async def welcome_visited(user: dict = Depends(get_current_user)):
    n = await force_number()
    await db.users.update_one({"user_id": user["user_id"]}, {"$addToSet": {"welcome.visits": n}})
    return {"ok": True, "visit": n}


class WelcomeIn(BaseModel):
    answers: Optional[Dict[str, Literal["yes", "no"]]] = Field(default=None, max_length=30)
    mv_ack: Optional[bool] = None
    section: Optional[str] = Field(default=None, pattern=r"^[a-z0-9_]{0,20}$")
    home_set: Optional[bool] = None


@router.put("/welcome")
async def save_welcome(p: WelcomeIn, user: dict = Depends(get_current_user)):
    sets = {f"welcome.answers.{k}": v for k, v in (p.answers or {}).items() if re.fullmatch(r"[a-z0-9_]{1,20}", k)}
    if p.mv_ack is not None:
        sets["welcome.mv_ack"] = p.mv_ack
    if p.section is not None:
        sets["welcome.section"] = p.section
    if p.home_set is not None:
        sets["welcome.home_set"] = p.home_set
    if sets:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": sets})
    return {"ok": True}


@router.post("/welcome/restart")
async def restart_welcome(user: dict = Depends(get_current_user)):
    """Help > Welcome > Go through Welcome again: clears the answers, the Model Vessel tick and the remembered place."""
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"welcome.answers": "", "welcome.mv_ack": "", "welcome.section": ""}})
    return {"ok": True}


async def seed_welcome():
    """Creates the private "Admin - Welcome Screen" list and the Global Config force line once (here and in production)."""
    if await db.migrations.find_one({"_id": "welcome_screen_seed"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    if not await _lines(LIST_NAME):
        await db.list_templates.insert_one({"list_id": f"tpl_welcome_{now[:10]}", "custom": True, "name": LIST_NAME, "private": True,
                                            "description": "Questions on the Welcome screen. \"1. Question\" starts a question, \"3.1 (note)\" adds a note under it, other lines are its bullets.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(LINES)], "created_at": now, "updated_at": now, "updated_by": "system"})
    cfg = {"custom": True, "name": {"$regex": r"^\s*admin - global config\s*$", "$options": "i"}}
    doc = await db.list_templates.find_one(cfg, {"_id": 0, "items": 1})
    if doc is not None and not any(FORCE.match(str(i.get("label") or "")) for i in doc.get("items") or []):
        items = doc.get("items") or []
        await db.list_templates.update_one(cfg, {"$set": {"items": [*items, {"id": max([int(i.get("id") or 0) for i in items] or [0]) + 1, "label": "Force Welcome screen visit, 1"}], "updated_at": now}})
    await db.migrations.insert_one({"_id": "welcome_screen_seed", "at": now})
