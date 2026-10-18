from datetime import datetime, timezone
from typing import List, Literal, Optional, Union
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api")

TEMPLATE_LISTS = {
    "leavingDock": "Leaving Dock", "returningDock": "Returning to Dock", "arrivingDest": "Arriving at Destination",
    "safety": "Safety", "routeHazards": "Route Hazards", "crewPrep": "Crew Prep", "provisions": "Provisions",
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


@router.get("/templates")
async def get_templates(_: dict = Depends(get_current_user)):
    docs = await db.list_templates.find({}, {"_id": 0, "updated_by": 0}).to_list(100)
    return {"templates": {d["list_id"]: {"items": d["items"], "updated_at": d["updated_at"]} for d in docs}}


@router.put("/admin/templates/{list_id}")
async def publish_template(list_id: str, payload: TemplateIn, admin: dict = Depends(require_admin)):
    if list_id not in TEMPLATE_LISTS:
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
