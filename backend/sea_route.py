import asyncio
import heapq
import logging
import math
from collections import OrderedDict
from io import BytesIO

import httpx
import numpy as np
from fastapi import APIRouter, Depends
from PIL import Image
from pydantic import BaseModel, Field

from auth import get_current_user
from land import HEADERS, TILE_URL, WATER

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
MAX_SIDE = 6  # tiles across and down at most, so one route reads 36 OpenStreetMap tiles or fewer
CELL = 3  # pixels per routing cell
_tiles: OrderedDict = OrderedDict()


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
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n)))), 5), round(x / n * 360 - 180, 5)]


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
    for z in range(14, 5, -1):
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
    return bool(water[rr, cc].all())


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


def _route(grid: np.ndarray, sa: tuple, sb: tuple):
    h, w = grid.shape[0] // CELL * CELL, grid.shape[1] // CELL * CELL
    share = grid[:h, :w].reshape(h // CELL, CELL, w // CELL, CELL).mean(axis=(1, 3))
    for need in (0.5, 0.25):
        water = share >= need
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
        # Straighten: keep only the turns needed to stay on the water.
        keep, i = [], 0
        while i < len(path) - 1:
            j = len(path) - 1
            while j > i + 1 and not _clear(water, path[i], path[j]):
                j -= 1
            keep.append(path[j])
            i = j
        return [((c + 0.5) * CELL, (r + 0.5) * CELL) for r, c in keep[:-1]]
    return None


@router.post("/sea-route")
async def sea_route(leg: LegIn, user: dict = Depends(get_current_user)):
    """Route Planning map: the bend points of a path over the water (OpenStreetMap's blue) between two stops."""
    try:
        z, ox, oy, grid = await _area(leg.a, leg.b)
        (ax, ay), (bx, by) = _px(leg.a.lat, leg.a.lon, z), _px(leg.b.lat, leg.b.lon, z)
        bends = await asyncio.to_thread(_route, grid, (ax - ox, ay - oy), (bx - ox, by - oy))
    except Exception as e:  # noqa: BLE001
        log.warning("Sea route failed: %s", e)
        bends = None
    if bends is None:
        return {"ok": False, "points": []}
    return {"ok": True, "points": [_ll(x + ox, y + oy, z) for x, y in bends][:60]}
