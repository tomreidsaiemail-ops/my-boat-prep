import asyncio
import logging
import math
import time
from collections import OrderedDict
from io import BytesIO

import httpx
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

from auth import get_current_user
from land import HEADERS, TILE_URL, WATER

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
_tiles: OrderedDict = OrderedDict()
_calls: dict = {}
LAND_M = 45  # land this long in a row counts as crossing land; bridges you pass under and labels on the water are narrower
GRAZE_M = 15  # brushing the shoreline by less than this isn't crossing land
PER_10_MIN = 300  # each check reads a few OpenStreetMap tiles, so keep it fair to their servers


class LineIn(BaseModel):
    line: list[list[float]] = Field(min_length=2, max_length=80)


def _px(lat: float, lon: float, z: int) -> tuple:
    n = 256 * 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


async def _tile(client: httpx.AsyncClient, z: int, x: int, y: int) -> np.ndarray:
    key = (z, x, y)
    if key in _tiles:
        _tiles.move_to_end(key)
        return _tiles[key]
    r = await client.get(TILE_URL.format(z=z, x=x % 2 ** z, y=y))
    r.raise_for_status()
    rgb = np.asarray(Image.open(BytesIO(r.content)).convert("RGB"), dtype=np.int16)
    m = np.abs(rgb - WATER).max(axis=2) <= 12
    _tiles[key] = m
    if len(_tiles) > 400:
        _tiles.popitem(last=False)
    return m


def _grow(m: np.ndarray, r: int) -> np.ndarray:
    for _ in range(r):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


async def _crosses(pts: list, z_max: int = 16) -> list:
    """For each straight part of a line: does it cross land? Read at the finest zoom that keeps it to a few tiles,
    with thin land on the water (bridges you pass under, map labels) closed up first."""
    out = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        for a, b in zip(pts, pts[1:]):
            for z in range(z_max, 8, -1):
                (ax, ay), (bx, by) = _px(a[0], a[1], z), _px(b[0], b[1], z)
                x0, x1, y0, y1 = int(min(ax, bx)) // 256, int(max(ax, bx)) // 256, int(min(ay, by)) // 256, int(max(ay, by)) // 256
                if (x1 - x0 + 1) * (y1 - y0 + 1) <= 16:
                    break
            row = list(range(x0, x1 + 1))
            got = await asyncio.gather(*[_tile(client, z, x, y) for y in range(y0, y1 + 1) for x in row])
            grid = np.vstack([np.hstack(got[k:k + len(row)]) for k in range(0, len(got), len(row))])
            mpp = 40_075_016.686 * math.cos(math.radians(a[0])) / (256 * 2 ** z)
            r = max(3, int(LAND_M / 2 / mpp))  # at least 3 pixels, so dashed boundary lines drawn over the sea close up too
            if r:
                grid = ~_grow(~_grow(grid, r), r)
            n = int(max(abs(ax - bx), abs(ay - by))) + 1
            xs = np.clip(np.rint(np.linspace(ax, bx, n + 1) - x0 * 256).astype(int), 0, grid.shape[1] - 1)
            ys = np.clip(np.rint(np.linspace(ay, by, n + 1) - y0 * 256).astype(int), 0, grid.shape[0] - 1)
            run = worst = 0
            for dry in ~grid[ys, xs]:
                run = run + 1 if dry else 0
                worst = max(worst, run)
            out.append(worst >= max(2, math.ceil(GRAZE_M / mpp)))
    return out


def _limit(user: dict):
    now = time.monotonic()
    recent = [t for t in _calls.get(user["user_id"], []) if now - t < 600]
    if len(recent) >= PER_10_MIN:
        raise HTTPException(status_code=429, detail="That's a lot of route checks in a short time. Wait a few minutes.")
    _calls[user["user_id"]] = recent + [now]


@router.post("/sea-check")
async def sea_check(body: LineIn, user: dict = Depends(get_current_user)):
    """Route Planning map: which straight parts of a leg (pins and the skipper's waypoints) cross land, read from OpenStreetMap's water blue."""
    _limit(user)
    try:
        return {"land": await _crosses(body.line, 16)}
    except Exception as e:  # noqa: BLE001
        log.warning("Sea check failed: %r", e)
        raise HTTPException(status_code=503, detail="Couldn't read the map to check for land. Try again shortly.") from e


def _ll(x: float, y: float, z: int) -> list:
    n = 256 * 2 ** z
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n)))), 5), round(x / n * 360 - 180, 5)]


def _near_water(water: np.ndarray, r: int, c: int) -> tuple | None:
    """The closest water cell to a pin that sits on a marina or beach."""
    if water[r, c]:
        return r, c
    for d in range(1, 25):
        rs, cs = np.nonzero(water[max(0, r - d):r + d + 1, max(0, c - d):c + d + 1])
        if len(rs):
            k = int(np.argmin((rs + max(0, r - d) - r) ** 2 + (cs + max(0, c - d) - c) ** 2))
            return int(rs[k] + max(0, r - d)), int(cs[k] + max(0, c - d))
    return None


def _astar(water: np.ndarray, a: tuple, b: tuple) -> list | None:
    import heapq
    h, w = water.shape
    best = {a: 0.0}
    came = {}
    todo = [(0.0, a)]
    steps = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
    while todo:
        _, cur = heapq.heappop(todo)
        if cur == b:
            out = [cur]
            while cur in came:
                cur = came[cur]
                out.append(cur)
            return out[::-1]
        for dr, dc, cost in steps:
            nr, nc = cur[0] + dr, cur[1] + dc
            if 0 <= nr < h and 0 <= nc < w and water[nr, nc]:
                g = best[cur] + cost
                if g < best.get((nr, nc), 1e18):
                    best[(nr, nc)] = g
                    came[(nr, nc)] = cur
                    heapq.heappush(todo, (g + math.hypot(nr - b[0], nc - b[1]), (nr, nc)))
    return None


def _clear(water: np.ndarray, p: tuple, q: tuple) -> bool:
    n = max(abs(p[0] - q[0]), abs(p[1] - q[1])) + 1
    rs = np.rint(np.linspace(p[0], q[0], n + 1)).astype(int)
    cs = np.rint(np.linspace(p[1], q[1], n + 1)).astype(int)
    return bool(water[rs, cs].all())


async def _route(a: list, b: list, grow: float) -> list | None:
    span = max(abs(a[0] - b[0]), abs(a[1] - b[1]), 0.01)
    m = span * grow
    lat0, lat1, lon0, lon1 = min(a[0], b[0]) - m, max(a[0], b[0]) + m, min(a[1], b[1]) - m, max(a[1], b[1]) + m
    for z in range(15, 6, -1):
        (x0, y0), (x1, y1) = _px(lat1, lon0, z), _px(lat0, lon1, z)
        tx0, tx1, ty0, ty1 = int(x0) // 256, int(x1) // 256, int(y0) // 256, int(y1) // 256
        if (tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 36:
            break
    row = list(range(tx0, tx1 + 1))
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        got = await asyncio.gather(*[_tile(client, z, x, y) for y in range(ty0, ty1 + 1) for x in row])
    grid = np.vstack([np.hstack(got[k:k + len(row)]) for k in range(0, len(got), len(row))])
    grid = ~_grow(~_grow(grid, 3), 3)
    f = max(1, int(math.ceil(max(grid.shape) / 320)))
    hh, ww = grid.shape[0] // f, grid.shape[1] // f
    # A cell is open water only when nearly all of it is water, with a one-cell margin off the shore.
    water = grid[:hh * f, :ww * f].reshape(hh, f, ww, f).mean(axis=(1, 3)) > 0.9
    water = ~_grow(~water, 2)
    cell = lambda p: (min(hh - 1, max(0, int((_px(p[0], p[1], z)[1] - ty0 * 256) / f))), min(ww - 1, max(0, int((_px(p[0], p[1], z)[0] - tx0 * 256) / f))))
    sa, sb = _near_water(water, *cell(a)), _near_water(water, *cell(b))
    if not sa or not sb:
        return None
    cells = _astar(water, sa, sb)
    if not cells:
        return None
    keep, i = [cells[0]], 0
    while i < len(cells) - 1:
        j = len(cells) - 1
        while j > i + 1 and not _clear(water, cells[i], cells[j]):
            j -= 1
        keep.append(cells[j])
        i = j
    return [_ll((c + 0.5) * f + tx0 * 256, (r + 0.5) * f + ty0 * 256, z) for r, c in keep]


@router.post("/sea-route")
async def sea_route(body: LineIn, user: dict = Depends(get_current_user)):
    """Waypoints that take a leg from its first to last point over the water (none needed when the straight line is clear)."""
    _limit(user)
    a, b = body.line[0], body.line[-1]
    best = None
    try:
        if not (await _crosses([a, b]))[0]:
            return {"path": []}
        for grow in (0.35, 1.0):
            pts = await _route(a, b, grow)
            if not pts or len(pts) < 3:
                continue
            # Checked like the map does; the first and last bits may touch land when a pin sits on a marina or beach.
            wet = await _crosses([a, *pts[1:-1], b])
            inner = wet[1:-1]
            if not any(inner):
                return {"path": pts[1:-1], "land": False}
            if best is None or sum(inner) < best[1]:
                best = (pts[1:-1], sum(inner))
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Couldn't load the map to plan around land. Try again shortly.")
    return {"path": best[0], "land": True} if best else {"path": None}


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
