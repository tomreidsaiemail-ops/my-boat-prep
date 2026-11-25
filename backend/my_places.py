"""Remember My Places: a map tap within about 500 m of a point the skipper named before reuses that name.
Names come from every boat they own (current trip, other trips and archived trips); the Model Vessel keeps its own."""
import math
import re

from db import db

MODEL = "model_vessel"
NEAR_M = 500
PLACEHOLDER = re.compile(r"^(point \d+|start|destination)$", re.I)
LEG_FIELDS = ("route_start", "route_dest", "start_pos", "dest_pos")


def _points(trip: dict):
    w = trip.get("weather") or {}
    yield trip.get("route_start"), w.get("start_pos")
    yield trip.get("route_dest"), w.get("dest_pos")
    for leg in w.get("legs") or []:
        if isinstance(leg, dict):
            yield leg.get("route_start"), leg.get("start_pos")
            yield leg.get("route_dest"), leg.get("dest_pos")


def _metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dy = math.radians(lat2 - lat1) * 6371000
    dx = math.radians(lon2 - lon1) * 6371000 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def _fields(root: str) -> dict:
    keep = [f"{root}.route_start", f"{root}.route_dest", f"{root}.weather.start_pos", f"{root}.weather.dest_pos"]
    return {"_id": 0, **{k: 1 for k in keep + [f"{root}.weather.legs.{f}" for f in LEG_FIELDS]}}


async def my_place_name(uid: str, boat_id: str, lat: float, lon: float) -> str:
    """The skipper's own name for the nearest point they pinned within NEAR_M of the tap, or ""."""
    boats = {"boat_id": MODEL} if boat_id == MODEL else {"boat_id": {"$ne": MODEL}}
    trips = []
    async for b in db.user_boats.find({"owner_id": uid, **boats}, {**_fields("boat"), "boat.trips": 1}):
        bo = b.get("boat") or {}
        trips += [bo, *[t for t in (bo.get("trips") or {}).values() if isinstance(t, dict)]]
    async for a in db.trip_archives.find({"owner_id": uid, **boats}, _fields("details")).sort("archived_at", -1).limit(1000):
        trips.append(a.get("details") or {})
    best = None
    for t in trips:
        for name, pos in _points(t):
            name = name.strip() if isinstance(name, str) else ""
            if not name or PLACEHOLDER.match(name) or not isinstance(pos, dict):
                continue
            try:
                d = _metres(lat, lon, float(pos["lat"]), float(pos["lon"]))
            except (KeyError, TypeError, ValueError):
                continue
            if d <= NEAR_M and (best is None or d < best[0]):
                best = (d, name)
    return best[1] if best else ""
