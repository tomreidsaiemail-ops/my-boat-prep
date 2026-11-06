from datetime import datetime, timezone
from typing import List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from db import db
from auth import require_admin
from templates import NOTE_MAX, REQUIRED_DYNAMIC, RESERVED_NAMES, TEMPLATE_LISTS, TemplateItem, _keep_version, push_indents

router = APIRouter(prefix="/api")
BACKUP_KIND = "my-boat-prep-template-lists"


def _name(d: dict) -> str:
    return d.get("name") or TEMPLATE_LISTS.get(d["list_id"], d["list_id"])


@router.get("/admin/template-lists/export")
async def export_template_lists(_: dict = Depends(require_admin)):
    """Every master template list (built-in and admin-made) as one restorable backup."""
    docs = await db.list_templates.find({}, {"_id": 0, "updated_by": 0}).sort("created_at", 1).to_list(2000)
    lists = [{"list_id": d["list_id"], "name": _name(d), "custom": bool(d.get("custom")), "description": d.get("description", ""), "private": bool(d.get("private")),
              "note": d.get("note", ""), "items": d.get("items") or [], "created_at": d.get("created_at", ""), "updated_at": d.get("updated_at", "")}
             for d in docs if d.get("custom") or d["list_id"] in TEMPLATE_LISTS]
    return {"kind": BACKUP_KIND, "version": 1, "exported_at": datetime.now(timezone.utc).isoformat(), "lists": lists}


class BackupList(BaseModel):
    list_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    name: str = Field(max_length=60)
    custom: bool = False
    description: str = Field(default="", max_length=4000)
    private: bool = False
    note: str = Field(default="", max_length=NOTE_MAX)
    items: List[TemplateItem] = Field(max_length=300)
    created_at: str = Field(default="", max_length=40)


class ImportIn(BaseModel):
    kind: str
    lists: List[BackupList] = Field(max_length=2000)
    dry_run: bool = True


def _items(lst: BackupList) -> list:
    out, ids = [], set()
    for i in lst.items:
        label = i.label.strip()
        if not label or i.id in ids:
            continue
        ids.add(i.id)
        out.append({"id": i.id, "label": label, **({"dynamic": i.dynamic} if i.dynamic else {}), **({"indent": True} if i.indent and out else {}),
                    **({"level": i.level} if i.level and i.indent and out else {}), **({"meal_type": i.meal_type} if i.meal_type else {})})
    return out


async def _plan(lists: List[BackupList]) -> list:
    """What restoring each backup list does: add, overwrite (same name), unchanged or skip."""
    customs = await db.list_templates.find({"custom": True}, {"_id": 0}).to_list(2000)
    by_name = {" ".join(d["name"].lower().split()): d for d in customs}
    taken = {d["list_id"] for d in customs} | set(TEMPLATE_LISTS)
    plan, seen = [], set()
    for lst in lists:
        name = " ".join(lst.name.split())
        key = name.lower() if lst.custom else f"builtin:{lst.list_id}"
        items = _items(lst)
        step = {"name": name, "lst": lst, "items": items}
        if lst.custom and not name:
            plan.append({**step, "name": "(no name)", "action": "skip", "reason": "has no name"})
            continue
        if key in seen:
            plan.append({**step, "action": "skip", "reason": "appears twice in the backup"})
            continue
        seen.add(key)
        if not items:
            plan.append({**step, "action": "skip", "reason": "has no items"})
            continue
        if not lst.custom:
            if lst.list_id not in TEMPLATE_LISTS:
                plan.append({**step, "action": "skip", "reason": "isn't a list this app knows"})
                continue
            if REQUIRED_DYNAMIC.get(lst.list_id, set()) - {i.get("dynamic") for i in items}:
                plan.append({**step, "action": "skip", "reason": "is missing its vessel, callsign or GPS lines"})
                continue
            old = await db.list_templates.find_one({"list_id": lst.list_id}, {"_id": 0})
            same = old and old.get("items") == items
            plan.append({**step, "name": TEMPLATE_LISTS[lst.list_id], "old": old, "action": "unchanged" if same else "overwrite" if old else "add"})
            continue
        if lst.custom and key in RESERVED_NAMES:
            plan.append({**step, "action": "skip", "reason": "uses a built-in list name"})
            continue
        old = by_name.get(key)
        if old:
            same = old["items"] == items and old.get("description", "") == lst.description.strip() and bool(old.get("private")) == lst.private
            plan.append({**step, "old": old, "action": "unchanged" if same else "overwrite"})
        else:
            new_id = lst.list_id if lst.list_id not in taken else f"tpl_{uuid4().hex[:10]}"
            taken.add(new_id)
            plan.append({**step, "new_id": new_id, "action": "add"})
    return plan


async def _apply(p: dict, admin_id: str, now: str):
    lst, items, old = p["lst"], p["items"], p.get("old")
    note = lst.note.strip()
    if not lst.custom:
        if old:
            await _keep_version(old)
        await db.list_templates.update_one({"list_id": lst.list_id}, {"$set": {"list_id": lst.list_id, "items": items, "updated_at": now, "updated_by": admin_id, "note": note}}, upsert=True)
        if old:
            await push_indents(lst.list_id, old, items, now)
        return
    if old:
        changed = old["items"] != items
        upd = {"description": lst.description.strip(), "private": lst.private, "items": items, "updated_by": admin_id, **({"updated_at": now, "note": note} if changed else {})}
        if changed:
            await _keep_version(old)
        await db.list_templates.update_one({"list_id": old["list_id"]}, {"$set": upd})
        if changed and not lst.private:
            await push_indents(old["list_id"], old, items, now)
        return
    await db.list_templates.insert_one({"list_id": p["new_id"], "custom": True, "name": p["name"], "description": lst.description.strip(), "items": items,
                                        "private": lst.private, "note": note, "created_at": lst.created_at or now, "updated_at": now, "updated_by": admin_id})


@router.post("/admin/template-lists/import")
async def import_template_lists(payload: ImportIn, admin: dict = Depends(require_admin)):
    """Restores a backup: lists with the same name are overwritten, missing ones added, the rest kept. dry_run only reports."""
    if payload.kind != BACKUP_KIND:
        raise HTTPException(status_code=400, detail="That file isn't a My Boat Prep template lists backup")
    plan = await _plan(payload.lists)
    if not payload.dry_run:
        now = datetime.now(timezone.utc).isoformat()
        for p in plan:
            if p["action"] in ("add", "overwrite"):
                await _apply(p, admin["user_id"], now)
    return {"dry_run": payload.dry_run, "lists": [{"name": p["name"], "action": p["action"], "items": len(p["items"]), **({"reason": p["reason"]} if p.get("reason") else {})} for p in plan]}
