import asyncio
import logging
import math
from collections import OrderedDict
from io import BytesIO

import httpx
import numpy as np
from PIL import Image

log = logging.getLogger(__name__)
# Water is read from OpenStreetMap's own map (sea, harbours, marina basins, lakes and rivers all draw in its water blue).
TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
HEADERS = {"User-Agent": "MyBoatPrep/1.0 (boat GPS land filter; support@myboatprep.com)"}
Z = 15
SHORE_M = 300  # within this distance of real water (not a stream or pond) still counts as water: marinas, moorings, wharves
GPS_M = 40  # phone GPS wobble: the circle around the position that's checked for water
HERE_SHARE = 0.35  # a creek drawn through the GPS circle isn't enough; a harbour, marina basin, lake or river is
NEAR_SHARE = 0.03  # share of the 300 m circle that must be water (about 260 m from a straight shore); a creek or pond stays below it
WATER = np.array([170, 211, 223])
_masks: OrderedDict = OrderedDict()
_lock = asyncio.Lock()


async def _mask(client: httpx.AsyncClient, x: int, y: int) -> np.ndarray:
    key = (x, y)
    if key in _masks:
        _masks.move_to_end(key)
        return _masks[key]
    r = await client.get(TILE_URL.format(z=Z, x=x, y=y))
    r.raise_for_status()
    rgb = np.asarray(Image.open(BytesIO(r.content)).convert("RGB"), dtype=np.int16)
    m = np.abs(rgb - WATER).max(axis=2) <= 10
    _masks[key] = m
    if len(_masks) > 256:
        _masks.popitem(last=False)
    return m


def _pixel(lat: float, lon: float) -> tuple:
    n = 256 * 2 ** Z
    lat = max(min(lat, 85.0), -85.0)
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


async def _check(lat: float, lon: float) -> bool:
    px, py = _pixel(lat, lon)
    mpp = 40_075_016.686 * math.cos(math.radians(lat)) / (256 * 2 ** Z)
    r = SHORE_M / mpp
    x0, y0, x1, y1 = int(px - r) // 256, int(py - r) // 256, int(px + r) // 256, int(py + r) // 256
    async with httpx.AsyncClient(headers=HEADERS, timeout=10) as client:
        rows = [np.hstack([await _mask(client, x % 2 ** Z, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)]
    grid = np.vstack(rows)
    yy, xx = np.ogrid[:grid.shape[0], :grid.shape[1]]
    d2 = (xx + 0.5 - (px - x0 * 256)) ** 2 + (yy + 0.5 - (py - y0 * 256)) ** 2
    here, near = grid[d2 <= (GPS_M / mpp) ** 2].mean(), grid[d2 <= r ** 2].mean()
    return bool(here >= HERE_SHARE or near >= NEAR_SHARE)


async def on_water(lat: float, lon: float) -> bool:
    """True when on (or right by) the water. If the map can't be read, the position goes through so a fault never hides a boat."""
    try:
        async with _lock:
            return await _check(lat, lon)
    except Exception as e:  # noqa: BLE001
        log.warning("Land filter couldn't check %.5f,%.5f, letting it through: %s", lat, lon, e)
        return True
