import asyncio
import heapq
import logging
import math
from collections import OrderedDict
from io import BytesIO

import httpx
import numpy as np
import time

from fastapi import APIRouter, Depends, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

from auth import get_current_user
from land import HEADERS, TILE_URL, WATER

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
MAX_SIDE = 6  # tiles across and down at most, so one route reads 36 OpenStreetMap tiles or fewer
CELL = 3  # pixels per routing cell
_tiles: OrderedDict = OrderedDict()
_calls: dict = {}
LAND_M = 45  # land this long in a row counts as crossing land; bridges you pass under and map labels on the water are narrower
GRAZE_M = 15  # brushing the shoreline by less than this isn't crossing land
PER_10_MIN = 60  # each route may read up to 36 OpenStreetMap tiles, so keep it fair to their servers


class Pos(BaseModel):
    lat: float = Field(ge=-85, le=85)
    lon: float = Field(ge=-180, le=180)


class LegIn(BaseModel):
    a: Pos
    b: Pos


def _px(lat: float, lon: float, z: int) -> tuple:
    n = 256 * 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def _ll(x: float, y: float, z: int) -> list:
    n = 256 * 2 ** z
    return [round(float(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))), 5), round(float(x / n * 360 - 180), 5)]


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


async def _area(a: Pos, b: Pos):
    """The most detailed zoom where both stops (plus room to go round headlands) fit in MAX_SIDE x MAX_SIDE tiles."""
    for z in range(16, 5, -1):
        (ax, ay), (bx, by) = _px(a.lat, a.lon, z), _px(b.lat, b.lon, z)
        pad = max(96, 0.35 * max(abs(ax - bx), abs(ay - by)))
        x0, x1 = int(min(ax, bx) - pad) // 256, int(max(ax, bx) + pad) // 256
        y0, y1 = int(min(ay, by) - pad) // 256, int(max(ay, by) + pad) // 256
        if x1 - x0 < MAX_SIDE and y1 - y0 < MAX_SIDE:
            break
    sem = asyncio.Semaphore(6)
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        async def one(x, y):
            async with sem:
                return await _tile(client, z, x, y)
        tiles = await asyncio.gather(*[one(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)])
    w = x1 - x0 + 1
    grid = np.vstack([np.hstack(tiles[r * w:(r + 1) * w]) for r in range(y1 - y0 + 1)])
    return z, x0 * 256, y0 * 256, grid


def _snap(water: np.ndarray, c: tuple, reach: int = 25):
    if water[c]:
        return c
    r0, r1 = max(0, c[0] - reach), min(water.shape[0], c[0] + reach + 1)
    c0, c1 = max(0, c[1] - reach), min(water.shape[1], c[1] + reach + 1)
    pts = np.argwhere(water[r0:r1, c0:c1])
    if not len(pts):
        return None
    k = ((pts - [c[0] - r0, c[1] - c0]) ** 2).sum(axis=1).argmin()
    return int(pts[k][0] + r0), int(pts[k][1] + c0)


def _clear(water: np.ndarray, p: tuple, q: tuple) -> bool:
    n = int(max(abs(p[0] - q[0]), abs(p[1] - q[1])) * 2) + 1
    rr = np.rint(np.linspace(p[0], q[0], n)).astype(int)
    cc = np.rint(np.linspace(p[1], q[1], n)).astype(int)
    return bool(water[rr[1:-1], cc[1:-1]].all())


def _astar(water: np.ndarray, cost: np.ndarray, s: tuple, t: tuple):
    h, w = water.shape
    g = {s: 0.0}
    came = {}
    heap = [(0.0, s)]
    steps = ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414))
    seen = 0
    while heap and seen < 500_000:
        _, cur = heapq.heappop(heap)
        if cur == t:
            path = [cur]
            while cur in came:
                cur = came[cur]
                path.append(cur)
            return path[::-1]
        seen += 1
        gc = g[cur]
        for dr, dc, d in steps:
            nr, nc = cur[0] + dr, cur[1] + dc
            if 0 <= nr < h and 0 <= nc < w and water[nr, nc]:
                ng = gc + d * cost[nr, nc]
                if ng < g.get((nr, nc), math.inf):
                    g[(nr, nc)] = ng
                    came[(nr, nc)] = cur
                    heapq.heappush(heap, (ng + math.hypot(nr - t[0], nc - t[1]), (nr, nc)))
    return None


def _grow(m: np.ndarray, r: int) -> np.ndarray:
    for _ in range(r):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def _route(grid: np.ndarray, sa: tuple, sb: tuple, cell_m: float = 1e9):
    h, w = grid.shape[0] // CELL * CELL, grid.shape[1] // CELL * CELL
    share = grid[:h, :w].reshape(h // CELL, CELL, w // CELL, CELL).mean(axis=(1, 3))
    for need in (0.5, 0.25, 0.01):  # last try: any water at all, so narrow channels stay open; the finer check then tidies it
        water = share >= need
        # Close thin land gaps on the water (bridges you pass under, map labels): grow the water, then shrink it back.
        r = int(LAND_M / 2 // cell_m)
        if r:
            water = ~_grow(~_grow(water, r), r)
        land = ~water
        near = land.copy()
        for _ in range(2):  # a little room off the shore
            near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
        cost = np.where(near, 3.0, 1.0)
        s = _snap(water, (int(sa[1] // CELL), int(sa[0] // CELL)))
        t = _snap(water, (int(sb[1] // CELL), int(sb[0] // CELL)))
        if not s or not t:
            continue
        path = _astar(water, cost, s, t)
        if not path:
            continue
        # Straighten: keep only the turns needed to stay on the water; straight runs keep a cell off the shore.
        strict = water & ~_grow(land, 1)
        keep, i = [], 0
        while i < len(path) - 1:
            j = len(path) - 1
            while j > i + 1 and not _clear(strict, path[i], path[j]):
                j -= 1
            keep.append(path[j])
            i = j
        return [((c + 0.5) * CELL, (r + 0.5) * CELL) for r, c in [s, *keep]]
    return None


class LineIn(BaseModel):
    line: list[list[float]] = Field(min_length=2, max_length=80)


def _metres(a: list, b: list) -> float:
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot(a[0] - b[0], (a[1] - b[1]) * k) * 111_320


async def _crosses(pts: list, z_max: int = 16) -> list:
    """For each straight part of a line: does it cross land? Read at the finest zoom that keeps it to a few tiles,
    with thin land on the water (bridges you pass under, map labels) closed up the same way the route planner does."""
    out = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        for a, b in zip(pts, pts[1:]):
            for z in range(z_max, 8, -1):
                (ax, ay), (bx, by) = _px(a[0], a[1], z), _px(b[0], b[1], z)
                x0, x1, y0, y1 = int(min(ax, bx)) // 256, int(max(ax, bx)) // 256, int(min(ay, by)) // 256, int(max(ay, by)) // 256
                if (x1 - x0 + 1) * (y1 - y0 + 1) <= 16:
                    break
            grid = np.vstack([np.hstack([await _tile(client, z, x, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)])
            mpp = 40_075_016.686 * math.cos(math.radians(a[0])) / (256 * 2 ** z)
            r = int(LAND_M / 2 / mpp)
            if r:
                grid = ~_grow(~_grow(grid, r), r)
            n = int(max(abs(ax - bx), abs(ay - by))) + 1
            xs = np.clip(np.rint(np.linspace(ax, bx, n + 1) - x0 * 256).astype(int), 0, grid.shape[1] - 1)
            ys = np.clip(np.rint(np.linspace(ay, by, n + 1) - y0 * 256).astype(int), 0, grid.shape[0] - 1)
            out.append(int((~grid[ys, xs]).sum()) >= max(2, math.ceil(GRAZE_M / mpp)))
    return out


async def _leg(a: list, b: list, depth: int = 0):
    """Water route a -> b: [start on water, bends..., end on water]; any part found crossing land is routed again, closer in."""
    pa, pb = Pos(lat=a[0], lon=a[1]), Pos(lat=b[0], lon=b[1])
    z, ox, oy, grid = await _area(pa, pb)
    (ax, ay), (bx, by) = _px(pa.lat, pa.lon, z), _px(pb.lat, pb.lon, z)
    cell_m = CELL * 40_075_016.686 * math.cos(math.radians(pa.lat)) / (256 * 2 ** z)
    px = await asyncio.to_thread(_route, grid, (ax - ox, ay - oy), (bx - ox, by - oy), cell_m)
    if px is None:
        return None, z
    pts = [_ll(x + ox, y + oy, z) for x, y in px]
    # a and b are already on the water; a bend planned on a coarse map can sit on the shore, so it's nudged onto the water.
    pts = [a, *[await _snap_pin(p, 200) for p in pts[1:-1]], b]
    if depth < 6:
        land = await _crosses(pts)
        if any(land):
            out = [pts[0]]
            for i, bad in enumerate(land):
                sub = (await _leg(pts[i], pts[i + 1], depth + 1))[0] if bad else None
                out += sub[1:] if sub else [pts[i + 1]]
            pts = out
    return pts, z


async def _snap_pin(p: list, reach_m: float = 500) -> list:
    """A pin dropped on land (a car park, a road by the marina) moves to the nearest solid water."""
    z = 15
    x, y = _px(p[0], p[1], z)
    mpp = 40_075_016.686 * math.cos(math.radians(p[0])) / (256 * 2 ** z)
    r = reach_m / mpp
    x0, x1, y0, y1 = int(x - r) // 256, int(x + r) // 256, int(y - r) // 256, int(y + r) // 256
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        rows = [np.hstack([await _tile(client, z, tx, ty) for tx in range(x0, x1 + 1)]) for ty in range(y0, y1 + 1)]
    water = np.vstack(rows)
    solid = ~_grow(~water, max(3, math.ceil(25 / mpp)))  # about 50 m of water across, not a creek, drain or pond
    cx, cy = int(x - x0 * 256), int(y - y0 * 256)
    if solid[cy, cx]:
        return p
    pts = np.argwhere(solid)
    if not len(pts):
        return p
    d = ((pts - [cy, cx]) ** 2).sum(axis=1)
    k = d.argmin()
    if math.sqrt(d[k]) > r:
        return p
    return _ll(pts[k][1] + x0 * 256 + 0.5, pts[k][0] + y0 * 256 + 0.5, z)


def _limit(user: dict):
    now = time.monotonic()
    recent = [t for t in _calls.get(user["user_id"], []) if now - t < 600]
    if len(recent) >= PER_10_MIN:
        raise HTTPException(status_code=429, detail="That's a lot of routes in a short time. Wait a few minutes, then tap Redraw.")
    _calls[user["user_id"]] = recent + [now]


@router.post("/sea-route")
async def sea_route(leg: LegIn, user: dict = Depends(get_current_user)):
    """Route Planning map: a path over the water (OpenStreetMap's blue) between two stops.
    a_water / b_water: where the path meets the water, so a pin dropped on land can be moved onto it. land: per straight part."""
    _limit(user)
    a, b = [leg.a.lat, leg.a.lon], [leg.b.lat, leg.b.lon]
    try:
        wa, wb = await _snap_pin(a), await _snap_pin(b)
        pts, z = await _leg(wa, wb)
        if pts:
            pts = [wa, *pts[1:-1], wb]
        land = await _crosses(pts, 16) if pts else []
    except Exception as e:  # noqa: BLE001
        log.warning("Sea route failed for %s -> %s: %r", leg.a, leg.b, e)
        pts = None
    if not pts:
        return {"ok": False, "points": [], "land": []}
    pts = pts[:80]
    return {"ok": True, "points": pts[1:-1], "a_water": pts[0], "b_water": pts[-1],
            "a_moved": _metres(a, pts[0]) > 40, "b_moved": _metres(b, pts[-1]) > 40, "land": land[:79]}


@router.post("/sea-check")
async def sea_check(body: LineIn, user: dict = Depends(get_current_user)):
    """After the skipper drags a bend or pin: which straight parts of the leg now cross land."""
    _limit(user)
    try:
        return {"land": await _crosses(body.line, 16)}
    except Exception as e:  # noqa: BLE001
        log.warning("Sea check failed: %r", e)
        return {"land": []}
