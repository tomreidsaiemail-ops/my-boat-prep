import re
from datetime import datetime, timezone
from uuid import uuid4
from typing import List, Literal, Optional, Union
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, require_admin

BRIEFING_MAX = 1000

router = APIRouter(prefix="/api")

TEMPLATE_LISTS = {
    "leavingDock": "Leaving Dock", "returningDock": "Returning to Dock", "arrivingDest": "Arriving at Destination",
    "safety": "Safety", "riggingChecks": "Rigging Checks", "routeHazards": "Route Planning", "crewPrep": "Crew Prep", "provisions": "Provisions",
    "head": "Head (Toilet)", "engineService": "Engine Service", "electricalService": "Electrical Service", "grabBag": "Grab Bag", "mayDay": "Mayday", "panPan": "Pan-Pan", "mealPlan": "Meal Plan",
}
REQUIRED_DYNAMIC = {
    "mayDay": {"maydayVessel", "maydayCallsign", "maydayVesselCallsign", "maydayGps"},
    "panPan": {"panPanGps"},
}
Dynamic = Literal["maydayVessel", "maydayCallsign", "maydayVesselCallsign", "maydayGps", "panPanGps", "pobDescription", "panPanPosition", "panPanVessel"]


TEMPLATE_LINE_MAX = 4000


class TemplateItem(BaseModel):
    id: Union[int, str]
    label: str = Field(max_length=TEMPLATE_LINE_MAX)
    dynamic: Optional[Dynamic] = None
    indent: Optional[bool] = None
    level: Optional[int] = Field(default=None, ge=2, le=3)
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "dessert", "snack"]] = None
    briefing: Optional[str] = Field(default=None, max_length=BRIEFING_MAX)


NOTE_MAX = 300


class TemplateIn(BaseModel):
    items: List[TemplateItem] = Field(max_length=300)
    note: str = Field(default="", max_length=NOTE_MAX)


RESERVED_NAMES = {n.lower() for n in TEMPLATE_LISTS.values()} | {
    "my to do list", "ship's log", "ship log", "boat inventory", "skipper's tips", "sailing youtube channels", "sailing movies", "faq"}


class TemplateLine(BaseModel):
    label: str = Field(max_length=TEMPLATE_LINE_MAX)
    indent: bool = False
    briefing: Optional[str] = Field(default=None, max_length=BRIEFING_MAX)


class TemplateListIn(BaseModel):
    name: str = Field(max_length=60)
    description: str = Field(default="", max_length=4000)
    items: List[Union[str, TemplateLine]] = Field(max_length=300)
    private: Optional[bool] = None
    note: str = Field(default="", max_length=NOTE_MAX)


def _custom_out(d: dict) -> dict:
    return {"id": d["list_id"], "name": d["name"], "description": d.get("description", ""), "items": d["items"], "private": bool(d.get("private")),
            "created_at": d["created_at"], "updated_at": d["updated_at"]}


def _items_from_labels(labels: List[Union[str, TemplateLine]], old: Optional[list] = None) -> list:
    old_ids = {i["label"].lower(): i["id"] for i in old or []}
    nxt = max([i["id"] for i in old or [] if isinstance(i["id"], int)] + [0]) + 1
    out, seen, group, used = [], set(), set(), set()
    for raw in labels:
        line = raw if isinstance(raw, TemplateLine) else TemplateLine(label=raw)
        label = line.label.strip()[:TEMPLATE_LINE_MAX]
        sub = line.indent and out
        # Sub-items may repeat under different headings (e.g. Salt in several meals).
        if not label or label.lower() in (group if sub else seen):
            continue
        if sub:
            group.add(label.lower())
        else:
            seen.add(label.lower())
            group = set()
        iid = old_ids.get(label.lower())
        if iid is None or iid in used:
            iid, nxt = nxt, nxt + 1
        used.add(iid)
        brief = (line.briefing or "").strip()
        out.append({"id": iid, "label": label, **({"indent": True} if line.indent and out else {}), **({"briefing": brief} if brief else {})})
    if not out:
        raise HTTPException(status_code=400, detail="Add at least one item before publishing")
    return out


async def _check_name(name: str, exclude: Optional[str] = None) -> str:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Please enter a list name")
    clash = await db.list_templates.find_one({"custom": True, "list_id": {"$ne": exclude}, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
    if name.lower() in RESERVED_NAMES or clash:
        raise HTTPException(status_code=400, detail=f"{name} already exists")
    return name


@router.get("/templates")
async def get_templates(_: dict = Depends(get_current_user)):
    # Private admin lists are system lists: they never reach any boat.
    docs = await db.list_templates.find({"private": {"$ne": True}}, {"_id": 0, "updated_by": 0}).to_list(1000)
    return {"templates": {d["list_id"]: {"items": d["items"], "updated_at": d["updated_at"], "note": d.get("note", ""),
                                         **({"custom": True, "name": d["name"], "description": d.get("description", ""), "created_at": d["created_at"]} if d.get("custom") else {})} for d in docs}}


MPA_RULE_LISTS = {"synonyms": "admin - food synonyms", "noise": "admin - food noise words"}


@router.get("/mpa/rules")
async def mpa_rules(_: dict = Depends(get_current_user)):
    """Items of the private admin lists the Provisioning Assistant matches with; empty lists when they don't exist."""
    docs = await db.list_templates.find({"custom": True, "private": True}, {"_id": 0, "name": 1, "items": 1}).to_list(1000)
    by_name = {d["name"].strip().lower(): d["items"] for d in docs}
    return {k: [{"label": i["label"], **({"indent": True} if i.get("indent") else {})} for i in by_name.get(n, [])] for k, n in MPA_RULE_LISTS.items()}


@router.get("/list-categories")
async def list_categories(_: dict = Depends(get_current_user)):
    """Items of the private admin list "Admin - List Categories" (category heading, *Colour* line, then list names)."""
    docs = await db.list_templates.find({"custom": True, "private": True}, {"_id": 0, "name": 1, "items": 1}).to_list(1000)
    items = next((d["items"] for d in docs if d["name"].strip().lower() == "admin - list categories"), [])
    return {"items": [{"label": i["label"]} for i in items]}


BOAT_TYPES_LIST = "Admin - Boat types"
DEFAULT_BOAT_TYPES = ["Yacht - Sloop", "Yacht - Sloop, Solent Rigged", "Yacht - Cutter Rigged", "Yacht - Ketch", "Yacht - Yawl", "Yacht - Schooner",
                      "Catamaran", "Trimaran", "Trawler", "Motor Cruiser", "Launch", "Runabout", "RIB"]


@router.get("/boat-types")
async def boat_types(_: dict = Depends(get_current_user)):
    """The boat type choices, from the private admin list "Admin - Boat types" (built-in list if it's missing or empty)."""
    doc = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(BOAT_TYPES_LIST)}\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    types = list(dict.fromkeys(t for t in ((i.get("label") or "").strip() for i in (doc or {}).get("items") or []) if t))
    return {"types": types or DEFAULT_BOAT_TYPES}


ADMIN_LIST_PREFIXES = ("admin - help panel - ", "admin - list template - ", "admin - boat budget ", "admin - master ", "admin - common ")


@router.get("/admin-lists")
async def admin_lists(prefix: str, _: dict = Depends(get_current_user)):
    """Admin template lists whose name starts with a known prefix (help panels, list templates), in creation order."""
    p = " ".join(prefix.lower().split()) + " "
    if p not in ADMIN_LIST_PREFIXES:
        raise HTTPException(status_code=400, detail="Unknown admin list prefix")
    docs = await db.list_templates.find({"custom": True}, {"_id": 0, "name": 1, "items": 1}).sort("created_at", 1).to_list(1000)
    return {"lists": [{"name": d["name"].strip(), "items": [{"label": i["label"], **({"indent": True} if i.get("indent") else {})} for i in d["items"]]}
                      for d in docs if (n := " ".join(d["name"].lower().split())) == p.strip() or n.startswith(p)]}


@router.get("/admin/template-lists")
async def list_template_lists(_: dict = Depends(require_admin)):
    docs = await db.list_templates.find({"custom": True}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [_custom_out(d) for d in docs]


@router.post("/admin/template-lists")
async def create_template_list(payload: TemplateListIn, admin: dict = Depends(require_admin)):
    name = await _check_name(payload.name)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "description": payload.description.strip(), "items": _items_from_labels(payload.items),
           "private": bool(payload.private), "created_at": now, "updated_at": now, "updated_by": admin["user_id"]}
    await db.list_templates.insert_one({**doc})
    return _custom_out(doc)


@router.put("/admin/template-lists/{list_id}")
async def update_template_list(list_id: str, payload: TemplateListIn, admin: dict = Depends(require_admin)):
    doc = await db.list_templates.find_one({"list_id": list_id, "custom": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template list not found")
    name = await _check_name(payload.name, exclude=list_id)
    items = _items_from_labels(payload.items, doc["items"])
    changed = items != doc["items"]
    upd = {"name": name, "description": payload.description.strip(), "items": items, "private": doc.get("private", False) if payload.private is None else payload.private, "updated_by": admin["user_id"], **({"updated_at": datetime.now(timezone.utc).isoformat(), "note": payload.note.strip()} if changed else {})}
    if changed:
        await _keep_version(doc)
    await db.list_templates.update_one({"list_id": list_id}, {"$set": upd})
    if changed and not upd["private"]:
        await push_indents(list_id, doc, items, upd["updated_at"])
        if CREW_ROLES_NAME.match(name):
            await push_role_briefings(items, upd["updated_at"])
    return _custom_out({**doc, **upd})


CREW_ROLES_NAME = re.compile(r"^\s*crew roles\s*$", re.I)


def _role_key(label: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"^\s*\*\s*", "", re.sub(r"^\s*\d+[.)]\s*", "", str(label)))).strip().lower()


async def push_role_briefings(items: list, now: str):
    """Default Role Briefings reach every boat's Crew Roles list, only on roles the skipper has never given a briefing (a blanked one stays blank)."""
    want = {_role_key(i["label"]): i["briefing"] for i in items if i.get("briefing")}
    if not want:
        return
    async for b in db.user_boats.find({"registry.name": {"$regex": r"^\s*crew roles\s*$", "$options": "i"}}, {"_id": 1, "registry": 1, "data": 1}):
        lid = next((r["id"] for r in b.get("registry") or [] if CREW_ROLES_NAME.match(str(r.get("name", "")))), None)
        cur = (b.get("data") or {}).get(lid) or []
        nxt = [{**i, "briefing": want[_role_key(i.get("label", ""))], "ts": now} if "briefing" not in i and _role_key(i.get("label", "")) in want else i for i in cur]
        if nxt != cur:
            await db.user_boats.update_one({"_id": b["_id"]}, {"$set": {f"data.{lid}": nxt, "updated_at": now}})


TRIM_BRIEFING = ("Watch out for the boom at all times! Re trimming, put 3 to 4 wraps clockwise on the drum, keep your thumbs out and palms facing the winch, "
                 "and hold the tail clear of the pinch area without wrapping it around your hand or body.")


async def seed_trim_briefings():
    """Runs once: default Role Briefings for Port Trim and Starboard Trim in the admin Crew Roles list, then onto boats without one."""
    if await db.migrations.find_one({"_id": "trim_briefings"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*crew roles\s*$", "$options": "i"}}, {"_id": 1, "items": 1})
    if tpl:
        items = [{**i, "briefing": TRIM_BRIEFING} if _role_key(i.get("label", "")) in ("port trim", "starboard trim") and not i.get("briefing") else i for i in tpl.get("items") or []]
        if items != tpl.get("items"):
            await db.list_templates.update_one({"_id": tpl["_id"]}, {"$set": {"items": items}})
        await push_role_briefings(items, now)
    await db.migrations.insert_one({"_id": "trim_briefings", "at": now})


async def push_indents(list_id: str, old: dict, items: list, now: str):
    """Copies the master's grouping (indents) onto every boat's copy of the list; ticks, notes and photos stay."""
    want = {i["id"]: bool(i.get("indent")) for i in items}
    indent_only = [(i["id"], i["label"]) for i in old.get("items", [])] == [(i["id"], i["label"]) for i in items]
    async for b in db.user_boats.find({f"data.{list_id}": {"$exists": True}}, {"_id": 1, f"data.{list_id}": 1, "template_versions": 1}):
        cur = b["data"][list_id] or []
        nxt = []
        for n, i in enumerate(cur):
            ind = want.get(i.get("id"))
            if ind is None or bool(i.get("indent")) == (ind and n > 0):
                nxt.append(i)
                continue
            fixed = {k: v for k, v in i.items() if k != "indent"}
            nxt.append({**fixed, **({"indent": True} if ind and n > 0 else {}), "ts": now})
        upd = {f"data.{list_id}": nxt} if nxt != cur else {}
        # A boat that was up to date only missed the grouping, so it stays up to date.
        if indent_only and (b.get("template_versions") or {}).get(list_id) == old.get("updated_at"):
            upd.update({f"template_versions.{list_id}": now, "sec_ts.template_versions": now})
        if upd:
            await db.user_boats.update_one({"_id": b["_id"]}, {"$set": upd})


@router.delete("/admin/template-lists/{list_id}")
async def delete_template_list(list_id: str, _: dict = Depends(require_admin)):
    res = await db.list_templates.delete_one({"list_id": list_id, "custom": True})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Template list not found")
    await db.template_versions.delete_many({"list_id": list_id})
    return {"ok": True}


@router.put("/admin/templates/{list_id}")
async def publish_template(list_id: str, payload: TemplateIn, admin: dict = Depends(require_admin)):
    custom = list_id not in TEMPLATE_LISTS and await db.list_templates.find_one({"list_id": list_id, "custom": True})
    if list_id not in TEMPLATE_LISTS and not custom:
        raise HTTPException(status_code=404, detail="That list can't have a master template")
    items, ids = [], set()
    for i in payload.items:
        label = i.label.strip()
        if not label or i.id in ids:
            continue
        if i.dynamic and i.dynamic not in REQUIRED_DYNAMIC.get(list_id, set()):
            raise HTTPException(status_code=400, detail="That line doesn't belong in this list")
        ids.add(i.id)
        items.append({"id": i.id, "label": label, **({"dynamic": i.dynamic} if i.dynamic else {}), **({"indent": True} if i.indent and items else {}), **({"level": i.level} if i.level and i.indent and items else {}), **({"meal_type": i.meal_type} if i.meal_type else {})})
    if not items:
        raise HTTPException(status_code=400, detail="Add at least one item before publishing")
    missing = REQUIRED_DYNAMIC.get(list_id, set()) - {i.get("dynamic") for i in items}
    if missing:
        raise HTTPException(status_code=400, detail=f"The {TEMPLATE_LISTS[list_id]} template must keep its vessel, callsign and GPS lines. Reset your {TEMPLATE_LISTS[list_id]} list to get them back.")
    now = datetime.now(timezone.utc).isoformat()
    old = await db.list_templates.find_one({"list_id": list_id}, {"_id": 0, "list_id": 1, "items": 1, "updated_at": 1, "note": 1})
    if old and old.get("items") == items:
        return {"list_id": list_id, "items": items, "updated_at": old["updated_at"], "note": old.get("note", ""), "unchanged": True}
    if old:
        await _keep_version(old)
    await db.list_templates.update_one(
        {"list_id": list_id}, {"$set": {"list_id": list_id, "items": items, "updated_at": now, "updated_by": admin["user_id"], "note": payload.note.strip()}}, upsert=True)
    if old and not (custom and custom.get("private")):
        await push_indents(list_id, old, items, now)
    return {"list_id": list_id, "items": items, "updated_at": now, "note": payload.note.strip()}


VERSIONS_KEPT = 30


async def _keep_version(doc: dict):
    """Saves the master items a boat may have last synced to, so Merge Latest can tell master changes from the skipper's own."""
    if not doc.get("updated_at"):
        return
    await db.template_versions.update_one({"list_id": doc["list_id"], "updated_at": doc["updated_at"]},
                                          {"$set": {"list_id": doc["list_id"], "updated_at": doc["updated_at"], "items": doc["items"], "note": doc.get("note", "")}}, upsert=True)
    old = await db.template_versions.find({"list_id": doc["list_id"]}, {"_id": 1}).sort("updated_at", -1).skip(VERSIONS_KEPT).to_list(100)
    if old:
        await db.template_versions.delete_many({"_id": {"$in": [d["_id"] for d in old]}})


@router.get("/templates/{list_id}/version")
async def template_version(list_id: str, at: str, _: dict = Depends(get_current_user)):
    """Master items as they were at `at` (the version a boat last synced); 404 when that version wasn't kept."""
    current = await db.list_templates.find_one({"list_id": list_id, "private": {"$ne": True}}, {"_id": 0, "items": 1, "updated_at": 1, "note": 1})
    doc = current if current and current["updated_at"] == at else await db.template_versions.find_one({"list_id": list_id, "updated_at": at}, {"_id": 0, "items": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="That master version isn't available")
    # The "why this changed" notes of every master update since that version, oldest first.
    later = await db.template_versions.find({"list_id": list_id, "updated_at": {"$gt": at}}, {"_id": 0, "updated_at": 1, "note": 1}).sort("updated_at", 1).to_list(VERSIONS_KEPT)
    if current and current["updated_at"] > at:
        later.append(current)
    return {"items": doc["items"], "notes": [{"at": v["updated_at"], "note": v["note"]} for v in later if v.get("note")]}


BUDGET_LINES = ["Marina berth or mooring fees", "Insurance | Hull and third party policy", "Haul out and hardstand", "Antifouling | Antifouling paint",
                "Engine service | Oil, filters and impeller", "Sails and rigging check", "Safety gear | Flares and lifejacket servicing",
                "Registration and licences", "Fuel | Diesel", "Batteries", "Electronics and chart updates | Chart subscription", "Cleaning and maintenance | Cleaning products"]


async def seed_budget_template():
    """Runs once: adds the private 'Admin - Boat Budget' list that seeds every boat's Boat Budget, if it isn't there already."""
    if await db.migrations.find_one({"_id": "boat_budget_template"}):
        return
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*admin\s*-\s*boat budget\s*$", "$options": "i"}}, {"_id": 1}):
        now = datetime.now(timezone.utc).isoformat()
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": "Admin - Boat Budget", "private": True,
                                            "description": "Seeds each boat's Boat Budget. Write 'Description | Product'; a line without | is just a Description.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(BUDGET_LINES)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "boat_budget_template", "at": datetime.now(timezone.utc).isoformat()})


MASTER_ATTRIBUTE_LINES = [
    "1. Types", "char = text, 1000 characters unless char(8) or char(8000) is given", "date = dd/mm/ccyy or mm/dd/ccyy, following the phone's locale",
    "integer = whole number, up to 99999999", "integer age = years old", "decimal = up to 999999.99", "decimal length = m, mm, feet or inches",
    "decimal area = sqm (sq ft on imperial boats)", "decimal weight = g or kg (lb or oz on imperial boats)", "decimal cost = in the boat's currency, e.g. USD or NZD",
    "image = photo upload, with delete", "pdf = PDF upload, with delete", "Any other type is a picklist row of Admin - master attribute types",
    "2. Attributes - Name, type and lists (or All), split by |",
    "Brand | char | All", "Make | char | All", "Model | char | All", "Serial number | char | All", "Colour | char | All", "Weight | decimal weight | All",
    "Cost | decimal cost | All", "Last service date | date | All", "Next service date | date | All", "PDF manual | pdf | All", "Image | image | All",
    "Web link | char(8000) | All", "Winch gear ratios | char | Deck Hardware",
    "Sail type | sail types | Sail Loft", "Sail material | sail material types | Sail Loft", "Furling type | furling type | Sail Loft",
    "Batten style | batten style | Sail Loft", "Sail area | decimal area | Sail Loft", "Luff length | decimal length | Sail Loft",
    "Age | integer age | Sail Loft, Running Rigging, Standing Rigging, Ground Tackle, Spars & Heavy Hardware",
    "Line type | line type | Running Rigging, Standing Rigging, Ground Tackle", "Line material | line material type | Running Rigging, Standing Rigging, Ground Tackle",
    "Diameter | decimal length | Running Rigging, Standing Rigging, Ground Tackle, Spars & Heavy Hardware",
    "Length | decimal length | Running Rigging, Standing Rigging, Ground Tackle, Spars & Heavy Hardware",
    "Anchor type | anchor types | Ground Tackle", "Chain length | decimal length | Ground Tackle",
    "Spar material | spar material types | Spars & Heavy Hardware",
]
SPARS = "Spars & Heavy Hardware"
SPAR_TYPE_LINE = "spar material types - Aluminium, Carbon fibre, Wood, Stainless steel, Fibreglass, Composite"
MASTER_TYPE_LINES = [
    "furling type - In-Boom Furling, In-Mast Furling, Forestay Furling",
    "sail types - Main sail, Headsail, Jib, Genoa, Spinnaker, Gennaker, Code Zero, Staysail, Storm jib, Trysail, Mizzen, Topsail, Screacher, Parasailor, Drifter",
    "sail material types - Woven Polyester, Dacron, Nylon, Laminated Polyester, Pentex, Mylar, Kevlar, Technora, Twaron, Carbon Fiber, Dyneema, Spectra, Vectran, Cuben Fiber, Composite",
    "line material type - Polyester, Dyneema, Kevlar, Vectran, Nylon, Polypropylene",
    "batten style - Partial, Full-length, Hybrid", SPAR_TYPE_LINE,
    "anchor types - Rocna, Plow, Bruce, Danforth, Delta, Spade, Grapnel, Mushroom, Fortress, Admiralty",
    "line type - Halyard, Sheet, Downhaul, Reef point, Topping lift, Cunningham, Kicker, Vang, Outhaul, Bowline, Sternline, Springline, Breastline, Painter, "
    "Forestay, Backstay, Shroud, Tack line, In-hauler, Barber hauler, Lazyjack line, Running backstay, Preventer, Anchor rode, Warp, Tow line",
]
MASTER_LISTS = (
    ("Admin - master attributes", MASTER_ATTRIBUTE_LINES,
     "Attributes for the Boat Maintenance lists. Write 'Name | type | lists' (lists comma separated, or All). Lines without | are notes."),
    ("Admin - master attribute types", MASTER_TYPE_LINES, "Picklists, one row per type: 'type name - value, value, value'."),
)


LOG_HELP = [
    ("Admin - Help Panel - Ships Log", "The Ship's Log help panel. Top-level lines are paragraphs, indented lines are bullets, and a line starting 'Skipper's Tip:' is the tip.", [
        "A Ship's Log can be as simple as editing the departure details below filling out Date Time Destination and Persons on Board. However, you can add other note worthy logs as you decide. "
        "The offline mode lets you do that at sea. The idea here is that once you have reached your destination you can print off this log and add it to the Ship's Log binder on board.",
        "Skipper's Tip: complete Ship's Log below for this voyage then click Email Ship's Log below when back at the dock, accumulate the Ship's Logs in your Ship's Logs email folder "
        "and then bulk print them at your local print shop, and then add them to the binder onboard."]),
    ("Admin - Help Panel - Ships Log Passage Folders", "Instructions in the Ship's Log 'Group a passage' popup. Top-level lines are paragraphs, indented lines are bullets.", [
        "Group a passage into one tidy folder.",
        "Pick the first log of the passage as the Start log and the last one as the End log.",
        "Check the Source, Destination and dates; the folder is named Source - Destination - Date range.",
        "Everything from the Start log to the End log goes into the folder. Tap the folder to open or close it, or Ungroup to put the logs back.",
        "Fold a year puts every passage folder and log from one year into a single folder, e.g. 2024 Ship's Logs."]),
    ("Admin - Help Panel - Zone Map Selection", "Instructions at the top of the Magic Mariner 'Create ZONE MAP' layout plans popup. Top-level lines are paragraphs, indented lines are bullets.", [
        "The Magic Mariner is drawing top-down layout plans of your boat's make and model.",
        "Select a couple of plans that help you map out your cockpit, saloon, galley and cabins, then tap Continue.",
        "Your selections are added to Zone Map as Zone Map Overviews, where you can drag your colours (e.g. Cockpit - Gold, Galley - Orange) onto each area."]),
]


MAGIC_HELP = [
    ("Admin - Help Panel - Magic Fish Whisperer", "Help at the top of the Magic Fish Whisperer popup. Top-level lines are paragraphs, indented lines are bullets.", [
        "The Magic Fish Whisperer... is here to help you figure the species of fish you have caught and to use your GPS and give you some local fishing knowledge.",
        "In particular, The Magic Fish Whisperer, will give you important information sources to help you to stay informed.",
        "The Magic Fish Whisperer can also give you some help filleting those strange species and if you need to watch out for things like puffer fish poison.",
        "Always double check with your local authorities but The Magic Fish Whisperer can help get you started the right questions to ask. "
        "It will give you a good estimate of fish length, and an estimated weight."]),
    ("Admin - Help Panel - Magic Bartender", "Help at the top of the Magic Bartender popup. Top-level lines are paragraphs, indented lines are bullets.", [
        "Arrange some drink bottles, some lemons, on a table and take a photo.",
        "The MAGIC BARTENDER will be able to recommend quickly some cocktails for you, it will also tell you the ingredients, and how to mix them."]),
]

INVENTORY_HELP = [
    ("Admin - Help Panel - How to take your boat inventory", "The 'How to take your Boat Inventory' panel in Boat Inventory. Top-level lines are paragraphs, indented lines are bullets.", [
        "Make sure and get the zone schematic for yacht, if you have not done that, then expand the Boat drop down, and click \"Additional boat details...\", "
        "fill in boat type, make, model and year of manufacture.",
        "Click on ZONE MAP OVERVIEWS, these are schematics of your boat.",
        "This will take you a feature \"Magically Create Colours\", this looks at your boats schematic and tries to place Galley Orange onto your Galley schematic, "
        "along with anything else it can figure out. Best to get a schematic where the Galley, Saloon etc are labelled.",
        "From here on just pick a colour like Orange and Batch Magic Scan your Galley cupboards. The sailing community have provided great defaults "
        "for your Galley cupboards like Dry Storage Locker, but you can add your own."]),
]

CHARTER_ADMIN = [
    ("Admin - charter lists to hand over", "Lists copied onto a charter boat when the owner hands it over (one list name per line). Boat Maintenance lists are never copied, "
     "My To Do List and Ship's Log are always copied empty, and any owner list starting \"Charter - \" is always copied.", [
        "Leaving Dock", "Returning to Dock", "Arriving at Destination", "Safety", "Rigging Checks", "Route Planning", "Crew Prep", "Provisions",
        "Meal Plan", "Head (Toilet)", "My To Do List", "Ship's Log", "Grab Bag", "Mayday", "Pan-Pan", "Crew Roles",
        "First Aid Kit - basic for cruising", "First Aid Kit - advanced for long passages", "Disaster Strikes - Mast Fail"]),
    ("Admin - Charter Boat Terms and Conditions", "What a charter skipper agrees to before taking the boat. The owner's \"Charter - charter skipper responsibilities\" list is added below these.", [
        "I hold the qualifications and experience needed to skipper this boat in the waters and conditions of this charter.",
        "I am responsible for the safety of everyone on board, and will brief my crew on the safety equipment and emergency procedures.",
        "I will keep the Ship's Log up to date during the charter, and complete the return-to-dock checklist before handing the boat back.",
        "I will report any damage, breakage or loss to the owner as soon as possible, and add anything that needs fixing to the My To Do List.",
        "I will return the boat on the agreed date, clean, with the agreed fuel, water and gas levels."]),
]


DISABLED_FEATURES = [
    ("Admin - disabled features", "Features switched off while they're being improved. One line per feature: \"<Feature name>; enabled for nobody\", "
     "or list the emails that can use it, e.g. \"Speak Button Feature; user1@gmail.com, user2@gmail.com\". Delete a line to turn that feature on for everyone.",
     ["Speak Button Feature; enabled for nobody", "Sync Food & Drinks Cupboards Magically Feature; enabled for nobody"]),
]

BOAT_TYPES_ADMIN = [
    (BOAT_TYPES_LIST, "The choices in Boat type (Additional details), in this order. Skippers can still pick Other... and type their own.", DEFAULT_BOAT_TYPES),
]



async def seed_log_help():
    """Runs once per panel group: adds the editable help panels, if they aren't there already."""
    now = datetime.now(timezone.utc).isoformat()
    for mig, panels in (("ships_log_help", LOG_HELP[:-1]), ("zone_map_selection_help", LOG_HELP[-1:]), ("magic_fish_bartender_help", MAGIC_HELP), ("inventory_help", INVENTORY_HELP), ("charter_admin_lists", CHARTER_ADMIN), ("disabled_features_list", DISABLED_FEATURES), ("boat_types_list", BOAT_TYPES_ADMIN)):
        if await db.migrations.find_one({"_id": mig}):
            continue
        for name, description, lines in panels:
            if await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{name}\s*$", "$options": "i"}}, {"_id": 1}):
                continue
            await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "private": True, "description": description,
                                                "items": [{"id": n + 1, "label": t, **({"indent": True} if name.endswith("Folders") and n else {})} for n, t in enumerate(lines)], "created_at": now, "updated_at": now, "updated_by": "system"})
        await db.migrations.insert_one({"_id": mig, "at": now})


async def seed_common_names():
    """Runs once: adds the Galley cupboard pick list offered while batch scanning the Galley zone."""
    if await db.migrations.find_one({"_id": "common_galley_names"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    name = "Admin - Common Galley Names"
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(name)}\s*$", "$options": "i"}}, {"_id": 1}):
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "private": True,
                                            "description": "Cupboard names offered as a pick list when scanning Galley cupboards. Make \"Admin - Common <Zone> Names\" for any other zone.",
                                            "items": [{"id": n + 1, "label": t} for n, t in enumerate(GALLEY_NAMES)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "common_galley_names", "at": now})


GALLEY_NAMES = ["Counter Top", "Fridge", "Freezer", "Larder", "Dry Foods Store", "Hanging Basket", "Bilge Storage", "Spice Rack", "Root Locker", "Provisioning Bin", "Provisioning Bin 2"]


async def add_spars_attributes():
    """Runs once: puts Spars & Heavy Hardware on the Age, Diameter and Length attributes and adds Spar material, keeping any admin edits."""
    if await db.migrations.find_one({"_id": "spars_attributes"}):
        return
    for name, extra in (("Admin - master attributes", "Spar material | spar material types | Spars & Heavy Hardware"), ("Admin - master attribute types", SPAR_TYPE_LINE)):
        tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{name}\s*$", "$options": "i"}}, {"_id": 0, "list_id": 1, "items": 1})
        if not tpl:
            continue
        items = tpl.get("items") or []
        for i in items:
            parts = [p.strip() for p in str(i.get("label", "")).split("|")]
            if len(parts) == 3 and parts[0].lower() in ("age", "diameter", "length") and parts[2].lower() != "all" and "spars" not in parts[2].lower():
                i["label"] = f"{parts[0]} | {parts[1]} | {parts[2]}, {SPARS}"
        if not any(str(i.get("label", "")).lower().startswith(extra.split(" ")[0].lower() + " " + extra.split(" ")[1].lower()) for i in items):
            items.append({"id": max([int(i.get("id") or 0) for i in items if isinstance(i.get("id"), (int, float))] or [0]) + 1, "label": extra,
                          **({"indent": True} if any(i.get("indent") for i in items) else {})})
        await db.list_templates.update_one({"list_id": tpl["list_id"]}, {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.migrations.insert_one({"_id": "spars_attributes", "at": datetime.now(timezone.utc).isoformat()})


async def seed_master_attributes():
    """Runs once: adds the private master attribute lists used by Deck Hardware, Sail Loft, Rigging and Ground Tackle."""
    if await db.migrations.find_one({"_id": "master_attributes"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    for name, lines, description in MASTER_LISTS:
        if await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{name}\s*$", "$options": "i"}}, {"_id": 1}):
            continue
        heads = [n for n, t in enumerate(lines) if t[:1].isdigit()]
        items = [{"id": n + 1, "label": t, **({"indent": True} if heads and n not in heads else {})} for n, t in enumerate(lines)]
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "private": True, "description": description,
                                            "items": items, "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "master_attributes", "at": now})
