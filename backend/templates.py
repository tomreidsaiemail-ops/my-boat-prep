import re
from datetime import datetime, timezone
from uuid import uuid4
from typing import List, Literal, Optional, Union
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, require_admin

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


class TemplateItem(BaseModel):
    id: Union[int, str]
    label: str = Field(max_length=1000)
    dynamic: Optional[Dynamic] = None
    indent: Optional[bool] = None
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "dessert", "snack"]] = None


class TemplateIn(BaseModel):
    items: List[TemplateItem] = Field(max_length=300)


RESERVED_NAMES = {n.lower() for n in TEMPLATE_LISTS.values()} | {
    "my to do list", "ship's log", "ship log", "boat inventory", "skipper's tips", "sailing youtube channels", "sailing movies", "faq"}


class TemplateLine(BaseModel):
    label: str = Field(max_length=1000)
    indent: bool = False


class TemplateListIn(BaseModel):
    name: str = Field(max_length=60)
    description: str = Field(default="", max_length=4000)
    items: List[Union[str, TemplateLine]] = Field(max_length=300)
    private: Optional[bool] = None


def _custom_out(d: dict) -> dict:
    return {"id": d["list_id"], "name": d["name"], "description": d.get("description", ""), "items": d["items"], "private": bool(d.get("private")),
            "created_at": d["created_at"], "updated_at": d["updated_at"]}


def _items_from_labels(labels: List[Union[str, TemplateLine]], old: Optional[list] = None) -> list:
    old_ids = {i["label"].lower(): i["id"] for i in old or []}
    nxt = max([i["id"] for i in old or [] if isinstance(i["id"], int)] + [0]) + 1
    out, seen, group, used = [], set(), set(), set()
    for raw in labels:
        line = raw if isinstance(raw, TemplateLine) else TemplateLine(label=raw)
        label = line.label.strip()[:1000]
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
        out.append({"id": iid, "label": label, **({"indent": True} if line.indent and out else {})})
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
    docs = await db.list_templates.find({"private": {"$ne": True}}, {"_id": 0, "updated_by": 0}).to_list(200)
    return {"templates": {d["list_id"]: {"items": d["items"], "updated_at": d["updated_at"],
                                         **({"custom": True, "name": d["name"], "description": d.get("description", ""), "created_at": d["created_at"]} if d.get("custom") else {})} for d in docs}}


MPA_RULE_LISTS = {"synonyms": "admin - food synonyms", "noise": "admin - food noise words"}


@router.get("/mpa/rules")
async def mpa_rules(_: dict = Depends(get_current_user)):
    """Items of the private admin lists the Provisioning Assistant matches with; empty lists when they don't exist."""
    docs = await db.list_templates.find({"custom": True, "private": True}, {"_id": 0, "name": 1, "items": 1}).to_list(200)
    by_name = {d["name"].strip().lower(): d["items"] for d in docs}
    return {k: [{"label": i["label"], **({"indent": True} if i.get("indent") else {})} for i in by_name.get(n, [])] for k, n in MPA_RULE_LISTS.items()}


@router.get("/list-categories")
async def list_categories(_: dict = Depends(get_current_user)):
    """Items of the private admin list "Admin - List Categories" (category heading, *Colour* line, then list names)."""
    docs = await db.list_templates.find({"custom": True, "private": True}, {"_id": 0, "name": 1, "items": 1}).to_list(200)
    items = next((d["items"] for d in docs if d["name"].strip().lower() == "admin - list categories"), [])
    return {"items": [{"label": i["label"]} for i in items]}


ADMIN_LIST_PREFIXES = ("admin - help panel - ", "admin - list template - ")


@router.get("/admin-lists")
async def admin_lists(prefix: str, _: dict = Depends(get_current_user)):
    """Admin template lists whose name starts with a known prefix (help panels, list templates), in creation order."""
    p = " ".join(prefix.lower().split()) + " "
    if p not in ADMIN_LIST_PREFIXES:
        raise HTTPException(status_code=400, detail="Unknown admin list prefix")
    docs = await db.list_templates.find({"custom": True}, {"_id": 0, "name": 1, "items": 1}).sort("created_at", 1).to_list(200)
    return {"lists": [{"name": d["name"].strip(), "items": [{"label": i["label"], **({"indent": True} if i.get("indent") else {})} for i in d["items"]]}
                      for d in docs if " ".join(d["name"].lower().split()).startswith(p)]}


@router.get("/admin/template-lists")
async def list_template_lists(_: dict = Depends(require_admin)):
    docs = await db.list_templates.find({"custom": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
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
    upd = {"name": name, "description": payload.description.strip(), "items": items, "private": doc.get("private", False) if payload.private is None else payload.private, "updated_by": admin["user_id"], **({"updated_at": datetime.now(timezone.utc).isoformat()} if changed else {})}
    await db.list_templates.update_one({"list_id": list_id}, {"$set": upd})
    return _custom_out({**doc, **upd})


@router.delete("/admin/template-lists/{list_id}")
async def delete_template_list(list_id: str, _: dict = Depends(require_admin)):
    res = await db.list_templates.delete_one({"list_id": list_id, "custom": True})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Template list not found")
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
        items.append({"id": i.id, "label": label, **({"dynamic": i.dynamic} if i.dynamic else {}), **({"indent": True} if i.indent and items else {}), **({"meal_type": i.meal_type} if i.meal_type else {})})
    if not items:
        raise HTTPException(status_code=400, detail="Add at least one item before publishing")
    missing = REQUIRED_DYNAMIC.get(list_id, set()) - {i.get("dynamic") for i in items}
    if missing:
        raise HTTPException(status_code=400, detail=f"The {TEMPLATE_LISTS[list_id]} template must keep its vessel, callsign and GPS lines. Reset your {TEMPLATE_LISTS[list_id]} list to get them back.")
    now = datetime.now(timezone.utc).isoformat()
    await db.list_templates.update_one(
        {"list_id": list_id}, {"$set": {"list_id": list_id, "items": items, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"list_id": list_id, "items": items, "updated_at": now}
