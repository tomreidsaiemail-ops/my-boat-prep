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
    "safety": "Safety", "riggingChecks": "Rigging Checks", "routeHazards": "Route Hazards", "crewPrep": "Crew Prep", "provisions": "Provisions",
    "head": "Head (Toilet)", "engineService": "Engine Service", "grabBag": "Grab Bag", "mayDay": "May Day", "panPan": "Pan Pan",
}
REQUIRED_DYNAMIC = {
    "mayDay": {"maydayVessel", "maydayCallsign", "maydayVesselCallsign", "maydayGps"},
    "panPan": {"panPanGps"},
}
Dynamic = Literal["maydayVessel", "maydayCallsign", "maydayVesselCallsign", "maydayGps", "panPanGps"]


class TemplateItem(BaseModel):
    id: Union[int, str]
    label: str = Field(max_length=1000)
    dynamic: Optional[Dynamic] = None


class TemplateIn(BaseModel):
    items: List[TemplateItem] = Field(max_length=300)


RESERVED_NAMES = {n.lower() for n in TEMPLATE_LISTS.values()} | {
    "my to do list", "ship's log", "ship log", "boat inventory", "skipper's tips", "sailing youtube channels", "sailing movies", "faq"}


class TemplateListIn(BaseModel):
    name: str = Field(max_length=60)
    items: List[str] = Field(max_length=300)


def _custom_out(d: dict) -> dict:
    return {"id": d["list_id"], "name": d["name"], "items": d["items"], "created_at": d["created_at"], "updated_at": d["updated_at"]}


def _items_from_labels(labels: List[str], old: Optional[list] = None) -> list:
    old_ids = {i["label"].lower(): i["id"] for i in old or []}
    nxt = max([i["id"] for i in old or [] if isinstance(i["id"], int)] + [0]) + 1
    out, seen = [], set()
    for raw in labels:
        label = raw.strip()[:1000]
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        iid = old_ids.get(label.lower())
        if iid is None:
            iid, nxt = nxt, nxt + 1
        out.append({"id": iid, "label": label})
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
    docs = await db.list_templates.find({}, {"_id": 0, "updated_by": 0}).to_list(200)
    return {"templates": {d["list_id"]: {"items": d["items"], "updated_at": d["updated_at"],
                                         **({"custom": True, "name": d["name"], "created_at": d["created_at"]} if d.get("custom") else {})} for d in docs}}


@router.get("/admin/template-lists")
async def list_template_lists(_: dict = Depends(require_admin)):
    docs = await db.list_templates.find({"custom": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [_custom_out(d) for d in docs]


@router.post("/admin/template-lists")
async def create_template_list(payload: TemplateListIn, admin: dict = Depends(require_admin)):
    name = await _check_name(payload.name)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "items": _items_from_labels(payload.items),
           "created_at": now, "updated_at": now, "updated_by": admin["user_id"]}
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
    upd = {"name": name, "items": items, "updated_by": admin["user_id"], **({"updated_at": datetime.now(timezone.utc).isoformat()} if changed else {})}
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
        items.append({"id": i.id, "label": label, **({"dynamic": i.dynamic} if i.dynamic else {})})
    if not items:
        raise HTTPException(status_code=400, detail="Add at least one item before publishing")
    missing = REQUIRED_DYNAMIC.get(list_id, set()) - {i.get("dynamic") for i in items}
    if missing:
        raise HTTPException(status_code=400, detail=f"The {TEMPLATE_LISTS[list_id]} template must keep its vessel, callsign and GPS lines. Reset your {TEMPLATE_LISTS[list_id]} list to get them back.")
    now = datetime.now(timezone.utc).isoformat()
    await db.list_templates.update_one(
        {"list_id": list_id}, {"$set": {"list_id": list_id, "items": items, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"list_id": list_id, "items": items, "updated_at": now}
