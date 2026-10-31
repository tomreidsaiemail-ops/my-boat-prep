from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import db
from auth import require_admin
from usage import FEATURES

router = APIRouter(prefix="/api")
DEFAULT_PRICING = {"input_per_m": 0.5, "output_per_m": 3.0, "currency": "USD"}


class PricingIn(BaseModel):
    input_per_m: float = Field(ge=0, le=1000)
    output_per_m: float = Field(ge=0, le=1000)
    currency: str = Field(default="USD", min_length=3, max_length=3)


async def pricing() -> dict:
    doc = await db.app_settings.find_one({"key": "compute_pricing"}, {"_id": 0, "key": 0})
    return {**DEFAULT_PRICING, **(doc or {})}


def month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def cost(p: dict, tin: int, tout: int) -> float:
    return round(tin / 1e6 * p["input_per_m"] + tout / 1e6 * p["output_per_m"], 4)


async def token_totals(match: dict, by: str = None) -> list:
    return await db.ai_usage.aggregate([
        {"$match": match},
        {"$group": {"_id": f"${by}" if by else None, "uses": {"$sum": 1}, "users": {"$addToSet": "$user_id"},
                    "input": {"$sum": "$input_tokens"}, "output": {"$sum": "$output_tokens"}, "total": {"$sum": "$total_tokens"}}},
    ]).to_list(200)


def day_start(since: Optional[str]) -> str:
    """Start of the admin's day as UTC ISO (the browser sends its local midnight); UTC midnight if missing or bad."""
    try:
        return datetime.fromisoformat(since.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except (AttributeError, ValueError):
        return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


@router.get("/admin/users-today")
async def users_today(since: Optional[str] = None, _: dict = Depends(require_admin)):
    docs = await db.users.find({"last_seen": {"$gte": day_start(since)}}, {"_id": 0, "name": 1, "email": 1, "last_seen": 1, "role": 1}).sort("last_seen", -1).to_list(1000)
    return {"users": [{"name": d.get("name") or "", "email": d.get("email", ""), "role": d.get("role", "free"), "last_seen": d["last_seen"]} for d in docs]}


@router.get("/admin/analytics")
async def analytics(since: Optional[str] = None, _: dict = Depends(require_admin)):
    p, ms = await pricing(), month_start()
    ms_iso = ms.isoformat()
    users = await db.users.count_documents({})
    all_t, month_t = (await token_totals({})) or [{}], (await token_totals({"created_at": {"$gte": ms}})) or [{}]
    feat_all = {r["_id"]: r for r in await token_totals({}, "feature")}
    feat_month = {r["_id"]: r for r in await token_totals({"created_at": {"$gte": ms}}, "feature")}

    def compute(r: dict) -> dict:
        return {"tokens": r.get("total", 0), "input": r.get("input", 0), "output": r.get("output", 0), "cost": cost(p, r.get("input", 0), r.get("output", 0)), "uses": r.get("uses", 0)}
    total = compute(all_t[0])
    return {
        "pricing": p, "month_start": ms_iso, "generated_at": datetime.now(timezone.utc).isoformat(),
        "growth": {"users": users, "users_month": await db.users.count_documents({"created_at": {"$gte": ms_iso}}),
                   "users_today": await db.users.count_documents({"last_seen": {"$gte": day_start(since)}}),
                   "pro": await db.users.count_documents({"role": "pro"}),
                   "pro_month": await db.users.count_documents({"role": "pro", "pro_since": {"$gte": ms_iso}})},
        "compute": {"all": total, "month": compute(month_t[0]), "ai_users": len(all_t[0].get("users", [])),
                    "avg_per_user": {"tokens": round(total["tokens"] / users) if users else 0, "cost": round(total["cost"] / users, 4) if users else 0}},
        "features": [{"code": code, "name": name,
                      "users": len(feat_all.get(code, {}).get("users", [])), "users_month": len(feat_month.get(code, {}).get("users", [])),
                      "uses": feat_all.get(code, {}).get("uses", 0), "uses_month": feat_month.get(code, {}).get("uses", 0),
                      "tokens": feat_all.get(code, {}).get("total", 0), "cost": cost(p, feat_all.get(code, {}).get("input", 0), feat_all.get(code, {}).get("output", 0))}
                     for code, name in FEATURES.items()],
    }


@router.get("/admin/users/compute")
async def users_compute(_: dict = Depends(require_admin)):
    p, ms = await pricing(), month_start()
    month = {r["_id"]: r for r in await token_totals({"created_at": {"$gte": ms}}, "user_id")}
    return {"pricing": p, "users": {r["_id"]: {"tokens": r["total"], "uses": r["uses"], "cost": cost(p, r["input"], r["output"]),
                                               "tokens_month": month.get(r["_id"], {}).get("total", 0), "uses_month": month.get(r["_id"], {}).get("uses", 0),
                                               "cost_month": cost(p, month.get(r["_id"], {}).get("input", 0), month.get(r["_id"], {}).get("output", 0))}
                                    for r in await token_totals({}, "user_id")}}


@router.get("/admin/compute-pricing")
async def get_pricing(_: dict = Depends(require_admin)):
    return await pricing()


@router.put("/admin/compute-pricing")
async def set_pricing(payload: PricingIn, _: dict = Depends(require_admin)):
    doc = {**payload.model_dump(), "currency": payload.currency.upper()}
    await db.app_settings.update_one({"key": "compute_pricing"}, {"$set": doc}, upsert=True)
    return doc
