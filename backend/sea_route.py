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
