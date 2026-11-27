# Test helper: puts test-user-pro/main on a today's departure (no legs) with blank tank sizes, so the DEPART -> Confirm levels flow can be reached.
# Restore afterwards from a mongoexport backup of the boat doc.
import os, datetime
from pymongo import MongoClient

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
now = datetime.datetime.utcnow().replace(second=0, microsecond=0)
f = lambda d: d.strftime("%Y-%m-%dT%H:%M")
doc = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
w = dict(doc["boat"].get("weather") or {})
w.update({"depart_at": f(now - datetime.timedelta(minutes=5)), "finish_at": f(now + datetime.timedelta(hours=3)), "arrive_type": "dock", "legs": [], "event_name": "TEST_Levels Trip"})
ts = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
upd = {"boat.weather": w, "boat.route_trip": "routeHazards", "boat.route_trip_day": now.strftime("%Y-%m-%d"), "boat.underway": {}, "boat.depart": {}, "boat.arrive": {},
       "boat.legs": {}, "boat.trip_ended": "", "boat.fuel_tank": "", "boat.water_tank": "", "boat.gas_bottles": "", "boat.gas_kg": "", "updated_at": ts}
keys = ["weather", "route_trip", "route_trip_day", "underway", "depart", "arrive", "legs", "trip_ended", "fuel_tank", "water_tank", "gas_bottles", "gas_kg"] + [f"weather.{k}" for k in w]
bts = dict(doc.get("boat_ts") or {}); bts.update({k: ts for k in keys}); upd["boat_ts"] = bts
print(db.user_boats.update_one({"_id": doc["_id"]}, {"$set": upd}).modified_count)
