"""Live tides (WorldTides) and marine weather (MET Norway) for Route Planning and the Magic Marine Navigator. Every outside call is counted for Analytics."""
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import db
from land import HEADERS

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
WORLDTIDES = "https://www.worldtides.info/api/v3"
MET = "https://api.met.no/weatherapi/locationforecast/2.0/complete"
KN = 1.943844
PROVIDERS = {"worldtides": "WorldTides tides", "met-norway": "MET Norway weather"}
WINDOW_DAYS = 8
COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _dt(s: str) -> datetime:
    d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _r(x) -> float:
    return round(float(x), 2)


def _zone(name: str):
    try:
        return ZoneInfo(name) if name else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


async def _count(provider: str, ok: bool, status=None, reason: str = "", credits: int = 0):
    await db.api_calls.insert_one({"provider": provider, "ok": ok, "status": status, "reason": reason[:200], "credits": credits,
                                   "at": datetime.now(timezone.utc).isoformat()})


async def geocode(place: str, near: Optional[dict] = None) -> Optional[dict]:
    name = " ".join((place or "").split())[:80]
    if not name:
        return None
    key = name.lower()
    hit = await db.geocode_cache.find_one({"q": key}, {"_id": 0})
    if hit:
        return hit.get("pos")
    params = {"q": name, "format": "jsonv2", "limit": 1}
    if near:
        params["viewbox"] = f"{near['lon'] - 1.5},{near['lat'] + 1.5},{near['lon'] + 1.5},{near['lat'] - 1.5}"
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=10) as c:
            r = await c.get("https://nominatim.openstreetmap.org/search", params=params)
        rows = r.json() if r.status_code == 200 else []
    except (httpx.HTTPError, ValueError):
        return None
    pos = {"lat": _r(rows[0]["lat"]), "lon": _r(rows[0]["lon"])} if rows else None
    if pos:
        await db.geocode_cache.update_one({"q": key}, {"$set": {"pos": pos, "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return pos


def _why(err: str, status) -> str:
    e = (err or "").lower()
    if "credit" in e:
        return "Out of WorldTides credits"
    if "key" in e:
        return "WorldTides API key not accepted"
    return f"WorldTides error {status}: {err}"[:200]


async def _fetch_tides(lat: float, lon: float, start: datetime, end: datetime) -> Optional[dict]:
    key = os.environ.get("WORLDTIDES_API_KEY")
    if not key:
        await _count("worldtides", False, reason="No WorldTides API key set")
        return None
    w0 = start.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    w1 = max(w0 + timedelta(days=WINDOW_DAYS), end.astimezone(timezone.utc) + timedelta(hours=1))
    params = {"extremes": "", "localtime": "", "lat": lat, "lon": lon, "start": int(w0.timestamp()), "length": int((w1 - w0).total_seconds()), "datum": "MSL", "key": key}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(WORLDTIDES, params=params)
        body = r.json()
    except (httpx.HTTPError, ValueError) as e:
        await _count("worldtides", False, reason=f"Network error: {e.__class__.__name__}")
        return None
    status = body.get("status", r.status_code) if isinstance(body, dict) else r.status_code
    if r.status_code != 200 or status != 200:
        await _count("worldtides", False, status, _why(body.get("error", "") if isinstance(body, dict) else "", status))
        return None
    await _count("worldtides", True, 200, credits=int(body.get("callCount") or 0))
    doc = {"lat": lat, "lon": lon, "from": w0.isoformat(), "to": w1.isoformat(), "at": datetime.now(timezone.utc).isoformat(),
           "timezone": body.get("timezone") or "", "copyright": body.get("copyright") or "",
           "station": {"name": str(body.get("station") or ""), "datum": body.get("responseDatum") or "MSL"},
           "extremes": [{"time": datetime.fromtimestamp(int(x["dt"]), timezone.utc).isoformat(), "type": str(x.get("type", "")).lower(), "height": _r(x.get("height", 0))}
                        for x in body.get("extremes") or [] if x.get("dt") is not None]}
    await db.tide_cache.insert_one(dict(doc))
    return doc


async def tides(lat: float, lon: float, start: datetime, end: datetime) -> Optional[dict]:
    """High and low tides between start and end, from the cache when a stored window covers them. None when unavailable."""
    lat, lon = _r(lat), _r(lon)
    s, e = start.astimezone(timezone.utc), end.astimezone(timezone.utc)
    hit = await db.tide_cache.find_one({"lat": lat, "lon": lon, "from": {"$lte": s.isoformat()}, "to": {"$gte": e.isoformat()}}, {"_id": 0})
    hit = hit or await _fetch_tides(lat, lon, s, e)
    if not hit:
        return None
    got = [x for x in hit["extremes"] if s <= _dt(x["time"]) < e]
    return {"station": hit["station"], "timezone": hit.get("timezone", ""), "copyright": hit.get("copyright", ""), "extremes": got} if got else None


async def forecast(lat: float, lon: float, first: date, days: int, tz) -> Optional[dict]:
    """Daily maximum wind (knots) and gusts in the place's local days, from MET Norway (about 9 days ahead); cached for 3 hours."""
    lat, lon = _r(lat), _r(lon)
    q = {"lat": lat, "lon": lon, "first": first.isoformat(), "days": days, "tz": getattr(tz, "key", "UTC")}
    hit = await db.weather_cache.find_one({**q, "at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()}}, {"_id": 0})
    if hit:
        return hit["data"]
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15) as c:
            r = await c.get(MET, params={"lat": lat, "lon": lon})
        body = r.json() if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError) as e:
        await _count("met-norway", False, reason=f"Network error: {e.__class__.__name__}")
        return None
    if body is None:
        await _count("met-norway", False, r.status_code, f"MET Norway error {r.status_code}")
        return None
    await _count("met-norway", True, 200)
    keep = {(first + timedelta(days=i)).isoformat() for i in range(days)}
    by = {}
    for x in (body.get("properties") or {}).get("timeseries") or []:
        v = ((x.get("data") or {}).get("instant") or {}).get("details") or {}
        k = _dt(x["time"]).astimezone(tz).date().isoformat()
        if v.get("wind_speed") is None or k not in keep:
            continue
        d = by.setdefault(k, {"wind_kn": 0, "gust_kn": None, "dir": 0})
        if v["wind_speed"] * KN >= d["wind_kn"]:
            d["wind_kn"], d["dir"] = round(v["wind_speed"] * KN, 1), v.get("wind_from_direction") or 0
        if v.get("wind_speed_of_gust") is not None:
            d["gust_kn"] = max(d["gust_kn"] or 0, round(v["wind_speed_of_gust"] * KN, 1))
    data = {"days": [{"date": k, **v} for k, v in sorted(by.items())]} if by else None
    if data:
        await db.weather_cache.update_one(q, {"$set": {"data": data, "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return data


def _day(d) -> str:
    return d.strftime("%a %d %b").replace(" 0", " ")


def tide_lines(place: str, t: dict, tz) -> str:
    st = t["station"]
    where = f"station {st['name']}" if st.get("name") else "nearest prediction point"
    by_day = {}
    for x in t["extremes"]:
        at = _dt(x["time"]).astimezone(tz)
        by_day.setdefault(_day(at), []).append(f"{x['type'].capitalize()} {at.strftime('%H:%M')} ({x['height']:+.1f} m)")
    rows = "\n".join(f"{k}: {', '.join(v)}" for k, v in by_day.items())
    return f"Live tides at {place} (WorldTides, {where}; local time, heights from mean sea level):\n{rows}"


def weather_lines(place: str, w: dict) -> str:
    rows = []
    for x in w["days"]:
        bits = [f"wind {COMPASS[round((x['dir'] or 0) / 45) % 8]} {round(x['wind_kn'])} kn"] + ([f"gusts {round(x['gust_kn'])} kn"] if x.get("gust_kn") is not None else [])
        rows.append(f"{_day(date.fromisoformat(x['date']))}: {', '.join(bits)}")
    return f"Live wind forecast at {place} (MET Norway, daily max):\n" + "\n".join(rows) if rows else ""


NO_TIDES = "LIVE TIDE DATA NOT AVAILABLE for {place}. No tide times are given. Check the official tide tables before you sail."


async def live_data(start: str, dest: str, start_pos: Optional[dict], dest_pos: Optional[dict], depart_at: str, tz_name: str, days: int = 5) -> dict:
    """Real tides at START and DESTINATION and the wind forecast for the trip's first days, as text for the Navigator."""
    sp = start_pos or await geocode(start)
    dp = dest_pos or await geocode(dest, sp)
    tz = _zone(tz_name)
    today = datetime.now(tz).date()
    try:
        first = date.fromisoformat((depart_at or "")[:10])
    except ValueError:
        first = today
    first = first if today <= first <= today + timedelta(days=14) else today
    places = [(start, sp), (dest, dp)] if (dest or "").strip().lower() != (start or "").strip().lower() else [(start, sp)]
    s = datetime(first.year, first.month, first.day, tzinfo=tz)
    tds = await asyncio.gather(*[tides(p["lat"], p["lon"], s, s + timedelta(days=days)) if p else asyncio.sleep(0, None) for _, p in places])
    tz = _zone(next((t["timezone"] for t in tds if t and t.get("timezone")), tz_name))
    wx = await asyncio.gather(*[forecast(p["lat"], p["lon"], first, days, tz) if p else asyncio.sleep(0, None) for _, p in places])
    blocks, missing = [], []
    for (name, _), t in zip(places, tds):
        if t:
            blocks.append(tide_lines(name, t, tz))
        else:
            missing.append(name)
            blocks.append(NO_TIDES.format(place=name))
    weather = [x for x in (weather_lines(name, w) for (name, _), w in zip(places, wx) if w) if x]
    weather = weather or [f"LIVE WEATHER FORECAST NOT AVAILABLE for {first.strftime('%d %b')} onwards. Check the official marine forecast before you sail."]
    return {"text": "\n\n".join(blocks + weather), "tides_missing": missing}


@router.get("/marine/tides")
async def marine_tides(start: str, end: str, place: str = Query(default="", max_length=80), lat: Optional[float] = Query(default=None, ge=-90, le=90),
                       lon: Optional[float] = Query(default=None, ge=-180, le=180), near_lat: Optional[float] = None, near_lon: Optional[float] = None,
                       _: dict = Depends(get_current_user)):
    """High and low tides at a Route Planning place for one day (start and end are the phone's midnights)."""
    try:
        s, e = _dt(start), _dt(end)
    except ValueError:
        raise HTTPException(status_code=422, detail="Bad date")
    if not timedelta(0) < e - s <= timedelta(days=2):
        raise HTTPException(status_code=422, detail="Ask for one day of tides at a time")
    near = {"lat": near_lat, "lon": near_lon} if near_lat is not None and near_lon is not None else None
    pos = {"lat": lat, "lon": lon} if lat is not None and lon is not None else await geocode(place, near)
    if not pos:
        return {"ok": False, "reason": "place"}
    t = await tides(pos["lat"], pos["lon"], s, e)
    return {"ok": True, **t} if t else {"ok": False, "reason": "tides"}


async def api_call_stats(since: str, yesterday: str) -> list:
    out = []
    for code, name in PROVIDERS.items():
        row = {"code": code, "name": name}
        for label, a, b in (("total", None, None), ("yesterday", yesterday, since), ("today", since, None)):
            q = {"provider": code, **({"at": {k: v for k, v in (("$gte", a), ("$lt", b)) if v}} if a or b else {})}
            row[label] = await db.api_calls.count_documents(q)
            row[f"fails_{label}"] = await db.api_calls.count_documents({**q, "ok": False})
            if code == "worldtides":
                got = await db.api_calls.aggregate([{"$match": q}, {"$group": {"_id": None, "n": {"$sum": "$credits"}}}]).to_list(1)
                row[f"credits_{label}"] = got[0]["n"] if got else 0
        row["last_fail"] = await db.api_calls.find_one({"provider": code, "ok": False}, {"_id": 0, "reason": 1, "at": 1}, sort=[("at", -1)])
        out.append(row)
    return out
