"""Water routing for boats from OpenStreetMap's coastline and water outlines (OpenFreeMap's free vector map tiles).
The same outlines decide where a route may go and which parts of a drawn line cross land."""
import asyncio
import heapq
import math
import time
from collections import OrderedDict

import httpx
import mapbox_vector_tile as mvt
import numpy as np
from PIL import Image, ImageDraw
from shapely import affinity
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

TILEJSON = "https://tiles.openfreemap.org/planet"
HEADERS = {"User-Agent": "MyBoatPrep/1.0 (boat route planning)"}
EXT = 4096  # vector tile units per tile side
GRAZE_M = 15  # brushing the shoreline by less than this isn't crossing land
OFF_M, CLOSE_M = 150, 50  # routes keep 150 m off the shore where they can, and only go closer than 50 m when there's no other way
NOT_BOATS = {"swimming_pool"}
_geo: OrderedDict = OrderedDict()
_tmpl = {"url": "", "at": 0.0}
_get = asyncio.Semaphore(8)


def units(lat: float, lon: float, z: int) -> tuple:
    n = EXT * 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def latlon(x: float, y: float, z: int) -> list:
    n = EXT * 2 ** z
    return [round(math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n)))), 5), round(x / n * 360 - 180, 5)]


def m_per_unit(lat: float, z: int) -> float:
    return 40_075_016.686 * math.cos(math.radians(lat)) / (EXT * 2 ** z)


def metres(a: list, b: list) -> float:
    dy = math.radians(b[0] - a[0]) * 6371000
    dx = math.radians(b[1] - a[1]) * 6371000 * math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot(dx, dy)


async def _template(client: httpx.AsyncClient) -> str:
    if not _tmpl["url"] or time.monotonic() - _tmpl["at"] > 6 * 3600:
        r = await client.get(TILEJSON)
        r.raise_for_status()
        _tmpl.update(url=r.json()["tiles"][0], at=time.monotonic())
    return _tmpl["url"]


async def tile_water(client: httpx.AsyncClient, z: int, x: int, y: int):
    """One tile's water, in world units at zoom z. A tile with no map data at all is open ocean."""
    key = (z, x, y)
    if key in _geo:
        _geo.move_to_end(key)
        return _geo[key]
    url = (await _template(client)).format(z=z, x=x % 2 ** z, y=y)
    async with _get:
        for tries in range(3):
            try:
                r = await client.get(url)
                break
            except httpx.TransportError:
                if tries == 2:
                    raise
                await asyncio.sleep(0.5 * (tries + 1))
    if r.status_code in (204, 404) or (r.status_code == 200 and not r.content):
        g = box(x * EXT, y * EXT, (x + 1) * EXT, (y + 1) * EXT)
    else:
        r.raise_for_status()
        layer = mvt.decode(r.content, default_options={"y_coord_down": True}).get("water") or {}
        k = EXT / (layer.get("extent") or EXT)
        parts = [shape(f["geometry"]).buffer(0) for f in layer.get("features", [])
                 if f["properties"].get("class") not in NOT_BOATS and f["geometry"]["type"] in ("Polygon", "MultiPolygon")]
        g = unary_union(parts) if parts else Polygon()
        g = affinity.affine_transform(g, [k, 0, 0, k, x * EXT, y * EXT])
    _geo[key] = g
    if len(_geo) > 800:
        _geo.popitem(last=False)
    return g


def _tiles(x0: float, y0: float, x1: float, y1: float) -> list:
    return [(tx, ty) for ty in range(int(y0 // EXT), int(y1 // EXT) + 1) for tx in range(int(x0 // EXT), int(x1 // EXT) + 1)]


async def land_parts(pts: list) -> list:
    """For each straight part of a line: does it cross land (more than a shoreline graze)?"""
    out = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
        for a, b in zip(pts, pts[1:]):
            d = metres(a, b)
            z = 14 if d < 10_000 else 13 if d < 25_000 else 12 if d < 60_000 else 11 if d < 150_000 else 10
            line = LineString([units(*a, z), units(*b, z)])
            x0, y0, x1, y1 = line.bounds
            near = [t for t in _tiles(x0, y0, x1, y1) if line.intersects(box(t[0] * EXT, t[1] * EXT, (t[0] + 1) * EXT, (t[1] + 1) * EXT))]
            water = unary_union(await asyncio.gather(*[tile_water(client, z, tx, ty) for tx, ty in near]))
            dry = line.difference(water)
            k = m_per_unit((a[0] + b[0]) / 2, z)
            out.append(any(p.length * k > GRAZE_M for p in getattr(dry, "geoms", [dry]) if not p.is_empty))
    return out


def _grow(m: np.ndarray, r: int) -> np.ndarray:
    """Spread True r cells out (roughly round), without wrapping round the edges."""
    for i in range(r):
        p = np.pad(m, 1)
        n = m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        if i % 2:
            n = n | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
        m = n
    return m


class Chart:
    """A water grid over a box: cost 1 out in open water, more near the shore, none (land) on land."""

    def __init__(self, water, z: int, x0: float, y0: float, cu: float, cell_m: float):
        h, w = water.shape
        land = ~water
        cost = np.ones((h, w), np.float32)
        cost[_grow(land, math.ceil(OFF_M / cell_m))] = 4
        cost[_grow(land, math.ceil(CLOSE_M / cell_m))] = 30
        cost[land] = np.inf
        self.cost, self.z, self.x0, self.y0, self.cu = cost, z, x0, y0, cu

    @classmethod
    async def load(cls, lat0: float, lon0: float, lat1: float, lon1: float, max_cells: int = 700):
        z = 14
        while z > 4:
            (x0, y0), (x1, y1) = units(lat1, lon0, z), units(lat0, lon1, z)
            if len(_tiles(x0, y0, x1, y1)) <= 36:
                break
            z -= 1
        k = m_per_unit((lat0 + lat1) / 2, z)
        cell_m = max(20.0, max(x1 - x0, y1 - y0) * k / max_cells)
        cu = cell_m / k
        h, w = math.ceil((y1 - y0) / cu), math.ceil((x1 - x0) / cu)
        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
            geos = await asyncio.gather(*[tile_water(client, z, tx, ty) for tx, ty in _tiles(x0, y0, x1, y1)])
        water = unary_union(geos).intersection(box(x0, y0, x1, y1))
        # Drawn at twice the detail, then a cell counts as water only when all of it is water, so thin spits stay land.
        img = Image.new("L", (w * 2, h * 2), 0)
        draw = ImageDraw.Draw(img)
        to_px = lambda ring: [((px - x0) / cu * 2, (py - y0) / cu * 2) for px, py in ring.coords]
        for poly in getattr(water, "geoms", [water]):
            if isinstance(poly, Polygon) and not poly.is_empty:
                draw.polygon(to_px(poly.exterior), fill=1)
                for hole in poly.interiors:
                    draw.polygon(to_px(hole), fill=0)
        fine = ~_grow(~np.asarray(img, bool), 1)
        coarse = fine[:h * 2, :w * 2].reshape(h, 2, w, 2).all(axis=(1, 3))
        return cls(coarse, z, x0, y0, cu, cell_m)

    def cell(self, p: list) -> tuple:
        x, y = units(*p, self.z)
        h, w = self.cost.shape
        return min(h - 1, max(0, int((y - self.y0) / self.cu))), min(w - 1, max(0, int((x - self.x0) / self.cu)))

    def point(self, rc) -> list:
        return latlon(self.x0 + (rc[1] + 0.5) * self.cu, self.y0 + (rc[0] + 0.5) * self.cu, self.z)

    def nearest(self, rc: tuple, worst: float = 30) -> tuple | None:
        """The closest cell no dearer than worst (open water first), e.g. for a pin on a marina or beach."""
        if self.cost[rc] <= worst:
            return rc
        rs, cs = np.nonzero(self.cost <= worst)
        if not len(rs):
            return None
        k = int(np.argmin((rs - rc[0]) ** 2 + (cs - rc[1]) ** 2))
        return int(rs[k]), int(cs[k])

    def peak(self, p: tuple, q: tuple) -> float:
        """The dearest cell on the straight line from p to q (inf when it crosses land)."""
        n = int(3 * max(abs(p[0] - q[0]), abs(p[1] - q[1]))) + 1
        rs = np.clip(np.rint(np.linspace(p[0], q[0], n + 1)).astype(int), 0, self.cost.shape[0] - 1)
        cs = np.clip(np.rint(np.linspace(p[1], q[1], n + 1)).astype(int), 0, self.cost.shape[1] - 1)
        return float(self.cost[rs, cs].max())

    def astar(self, s: tuple, t: tuple, cap: int = 1_500_000) -> list | None:
        h, w = self.cost.shape
        cost = self.cost.ravel().tolist()
        start, goal = s[0] * w + s[1], t[0] * w + t[1]
        g = {start: 0.0}
        came = {}
        todo = [(0.0, start)]
        steps = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0), (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
        seen = 0
        while todo and seen < cap:
            f, cur = heapq.heappop(todo)
            if cur == goal:
                out = [cur]
                while cur in came:
                    cur = came[cur]
                    out.append(cur)
                return [divmod(c, w) for c in out[::-1]]
            seen += 1
            r, c = divmod(cur, w)
            gc = g[cur]
            if f - math.hypot(r - t[0], c - t[1]) > gc + 1e-6:
                continue
            for dr, dc, step in steps:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < h and 0 <= nc < w):
                    continue
                nxt = nr * w + nc
                cn = cost[nxt]
                if cn == math.inf or (dr and dc and (cost[r * w + nc] == math.inf or cost[nr * w + c] == math.inf)):
                    continue
                ng = gc + step * (cn + cost[cur]) / 2
                if ng < g.get(nxt, math.inf):
                    g[nxt] = ng
                    came[nxt] = cur
                    heapq.heappush(todo, (ng + math.hypot(nr - t[0], nc - t[1]), nxt))
        return None

    def pull(self, cells: list) -> list:
        """Straightens the stair-step path: each kept point goes as far as it can in a line,
        no nearer the shore than the path it replaces already went."""
        costs = [float(self.cost[c]) for c in cells]
        keep, i = [cells[0]], 0
        while i < len(cells) - 1:
            j, step = i + 1, 1
            while j + step < len(cells) and self.peak(cells[i], cells[j + step]) <= max(costs[i:j + step + 1]):
                j += step
                step *= 2
            while step > 1:
                step //= 2
                if j + step < len(cells) and self.peak(cells[i], cells[j + step]) <= max(costs[i:j + step + 1]):
                    j += step
            keep.append(cells[j])
            i = j
        return keep

    def smooth(self, pts: list, rounds: int = 2, most: int = 76) -> list:
        """Chaikin corner cutting, so the path curves like a boat's; a corner is only cut where that keeps as far off the shore."""
        lerp = lambda p, q, f: (p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)
        for _ in range(rounds):
            if len(pts) < 3 or len(pts) * 2 > most:
                break
            segs = [self.peak(p, q) for p, q in zip(pts, pts[1:])]
            n = len(pts) - 1
            out = [pts[0]]
            for i in range(n):
                p, q = pts[i], pts[i + 1]
                if i > 0:
                    cut = lerp(p, q, 0.25)
                    if self.peak(out[-1], cut) > max(segs[i - 1], segs[i]):
                        out.append(p)  # cutting this corner would go nearer the shore: keep it
                    out.append(cut)
                if i < n - 1:
                    out.append(lerp(p, q, 0.75))
            out.append(pts[-1])
            pts = out
        return pts


async def route(a: list, b: list, grow: float) -> list | None:
    """Waypoints from a to b over the water (a and b themselves left out), or None when no way round was found."""
    span = max(abs(a[0] - b[0]), abs(a[1] - b[1]), 0.01)
    m = span * grow
    chart = await Chart.load(min(a[0], b[0]) - m, min(a[1], b[1]) - m, max(a[0], b[0]) + m, max(a[1], b[1]) + m)
    s, t = chart.nearest(chart.cell(a)), chart.nearest(chart.cell(b))
    if not s or not t:
        return None
    cells = await asyncio.to_thread(chart.astar, s, t)
    if not cells:
        return None
    pts = chart.smooth([tuple(map(float, c)) for c in chart.pull(cells)])
    return [chart.point(p) for p in pts]


async def _mend(pts: list, bad: list, a: list, b: list) -> tuple:
    """Re-routes, on a finer grid, the parts of a route that still clip land (the coarse grid misses small points and islets)."""
    full = [a, *pts, b]
    for _ in range(6):
        inner = [i for i in range(1, len(full) - 2) if bad[i]] or ([0] if bad[0] and len(full) == 2 else [])
        if not inner:
            break
        i = inner[0]
        sub = await route(full[i], full[i + 1], 0.6)
        if not sub:
            break
        trial = full[:i + 1] + sub + full[i + 1:]
        if len(trial) > 80:
            break
        tb = await land_parts(trial)
        if sum(tb[1:-1]) >= sum(bad[1:-1]):
            break
        full, bad = trial, tb
    return full[1:-1], bad


async def water_path(a: list, b: list) -> tuple:
    """(waypoints between a and b, still touches land?): ([], False) when the straight line is clear, (None, True) when no way was found."""
    if not (await land_parts([a, b]))[0]:
        return [], False
    best = None
    for grow in (0.3, 1.0, 2.5):
        pts = await route(a, b, grow)
        if pts is None:
            continue
        pts = [p for p in pts if metres(p, a) > 1 and metres(p, b) > 1]
        # A pin on a marina berth or beach may touch land on its way to the water; the rest must be clear.
        bad = await land_parts([a, *pts, b])
        if any(bad[1:-1]):
            pts, bad = await _mend(pts, bad, a, b)
        if not any(bad[1:-1]):
            return pts, False
        if best is None or sum(bad[1:-1]) < best[1]:
            best = (pts, sum(bad[1:-1]))
    return (best[0], True) if best else (None, True)


async def shore_water(lat: float, lon: float) -> list | None:
    """The nearest water at least 50 m off the shore (150 m where there is some close by) to a tap on land."""
    d = 0.02
    chart = await Chart.load(lat - d, lon - d * 1.4, lat + d, lon + d * 1.4, max_cells=400)
    rc = chart.cell([lat, lon])
    for worst in (1, 4, 30):
        got = chart.nearest(rc, worst)
        if got and metres([lat, lon], chart.point(got)) < 1500:
            return chart.point(got)
    return None
