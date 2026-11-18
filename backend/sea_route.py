import asyncio
import logging
import math
import time
from collections import OrderedDict

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from land import HEADERS
from water_map import land_parts, shore_water, water_path

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
_calls: dict = {}
PER_10_MIN = 300  # each check reads a few map tiles, so keep it fair to the free tile server


class LineIn(BaseModel):
    line: list[list[float]] = Field(min_length=2, max_length=80)


def _limit(user: dict):
    now = time.monotonic()
    recent = [t for t in _calls.get(user["user_id"], []) if now - t < 600]
    if len(recent) >= PER_10_MIN:
        raise HTTPException(status_code=429, detail="That's a lot of route checks in a short time. Wait a few minutes.")
    _calls[user["user_id"]] = recent + [now]


@router.post("/sea-check")
async def sea_check(body: LineIn, user: dict = Depends(get_current_user)):
    """Route Planning map: which straight parts of a leg (pins and the skipper's waypoints) cross land,
    against OpenStreetMap's coastline and water outlines (the same ones routes are drawn with)."""
    _limit(user)
    try:
        return {"land": await land_parts(body.line)}
    except Exception as e:  # noqa: BLE001
        log.warning("Sea check failed: %r", e)
        raise HTTPException(status_code=503, detail="Couldn't read the map to check for land. Try again shortly.") from e


@router.post("/sea-route")
async def sea_route(body: LineIn, user: dict = Depends(get_current_user)):
    """Waypoints that take a leg from its first to last point over the water (none needed when the straight line is clear):
    A* over a water grid that keeps 150 m off the shore where it can (50 m at a pinch), straightened, smoothed and checked."""
    _limit(user)
    try:
        path, land = await water_path(body.line[0], body.line[-1])
    except (httpx.HTTPError, ValueError) as e:
        log.warning("Sea route failed: %r", e)
        raise HTTPException(status_code=503, detail="Couldn't load the map to plan around land. Try again shortly.") from e
    return {"path": []} if path == [] else {"path": path, "land": land} if path else {"path": None}


class MendIn(BaseModel):
    line: list[list[float]] = Field(min_length=2, max_length=80)
    seg: int = Field(ge=0, le=78)
    tap: list[float] = Field(min_length=2, max_length=2)


@router.post("/sea-mend")
async def sea_mend(body: MendIn, user: dict = Depends(get_current_user)):
    """A tap on a red (over land) part of a leg: a waypoint goes on the nearest water off the shore,
    and the line either side of it is re-drawn over the water. Returns the leg's new waypoints."""
    _limit(user)
    line, j = body.line, body.seg
    if j >= len(line) - 1:
        raise HTTPException(status_code=400, detail="That part of the line wasn't found")
    try:
        w = await shore_water(*body.tap)
        if not w:
            raise HTTPException(status_code=404, detail="No water found near that tap. Drag a handle out over the water instead.")
        before, _ = await water_path(line[j], w)
        after, _ = await water_path(w, line[j + 1])
    except (httpx.HTTPError, ValueError) as e:
        log.warning("Sea mend failed: %r", e)
        raise HTTPException(status_code=503, detail="Couldn't load the map to plan around land. Try again shortly.") from e
    out = line[:j + 1] + (before or []) + [w] + (after or []) + line[j + 1:]
    if len(out) > 80:
        raise HTTPException(status_code=400, detail="This leg has too many waypoints. Double-tap some to remove them first.")
    return {"path": out[1:-1]}


_names: OrderedDict = OrderedDict()
_name_lock = asyncio.Lock()
_name_at = [0.0]


@router.get("/place-name")
async def place_name(lat: float, lon: float, user: dict = Depends(get_current_user)):
    """The nearest bay, headland, marina or place name for a map tap, e.g. "Off Cape Terawhiti" (blank when OpenStreetMap has none).
    Cached, and at most one lookup a second, as OpenStreetMap's Nominatim asks."""
    _limit(user)
    key = (round(lat, 3), round(lon, 3))
    if key in _names:
        return {"name": _names[key]}
    async with _name_lock:
        wait = 1.1 - (time.monotonic() - _name_at[0])
        if wait > 0:
            await asyncio.sleep(wait)
        _name_at[0] = time.monotonic()
        return {"name": await _lookup(lat, lon, key)}


# Nearby named coast features; a tap within NEAR_M of one (or inside its outline) is "at" it, else "Off" it.
COAST_TAGS = ("natural:bay", "natural:cape", "natural:peninsula", "natural:beach", "natural:reef", "place:island", "place:islet", "leisure:marina")
NEAR_M = {"bay": 800, "marina": 300, "beach": 120}


def _metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dy = math.radians(lat2 - lat1) * 6371000
    dx = math.radians(lon2 - lon1) * 6371000 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


async def _coast_name(client: httpx.AsyncClient, lat: float, lon: float) -> str:
    """The nearest bay, headland, beach, island or marina within 10 km (Photon, built on OpenStreetMap)."""
    params = [("lat", lat), ("lon", lon), ("limit", 6), ("radius", 10)] + [("osm_tag", t) for t in COAST_TAGS]
    r = await client.get("https://photon.komoot.io/reverse", params=params)
    best = None
    for f in (r.json().get("features") or []) if r.status_code == 200 else []:
        p, (flon, flat) = f.get("properties") or {}, f["geometry"]["coordinates"]
        if not p.get("name"):
            continue
        d = _metres(lat, lon, flat, flon)
        if best is None or d < best[0]:
            best = (d, p)
    if not best:
        return ""
    d, p = best
    ext = p.get("extent")  # [west, north, east, south] for outlined features
    inside = bool(ext) and ext[0] <= lon <= ext[2] and ext[3] <= lat <= ext[1]
    return p["name"] if inside or d <= NEAR_M.get(p.get("osm_value"), 0) else f"Off {p['name']}"


async def _lookup(lat: float, lon: float, key: tuple) -> str:
    name = ""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=10) as client:
            try:
                name = await _coast_name(client, lat, lon)
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                log.warning("Coast name lookup failed for %s", key)
            if not name:  # far from the coast: the bay, strait or sea it lies in
                r = await client.get("https://nominatim.openstreetmap.org/reverse", params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 16, "layer": "natural"})
                d = r.json() if r.status_code == 200 else {}
                name = d.get("name") if d.get("type") in ("bay", "strait", "sea", "sound", "fjord") else ""
            if not name:
                await asyncio.sleep(1.1)  # Nominatim asks for one lookup a second
                r = await client.get("https://nominatim.openstreetmap.org/reverse", params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 14, "addressdetails": 1})
                d = r.json() if r.status_code == 200 else {}
                a = d.get("address") or {}
                name = d.get("name") or next((a[k] for k in ("bay", "marina", "harbour", "beach", "island", "hamlet", "village", "suburb", "locality", "town", "city") if a.get(k)), "")
    except (httpx.HTTPError, ValueError):
        pass
    _names[key] = name
    if len(_names) > 2000:
        _names.popitem(last=False)
    return name
