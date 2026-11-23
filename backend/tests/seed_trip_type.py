# Test helper: TEST_ plan on test-admin-1/<boat> for trip-type flags. Usage: seed_trip_type.py <boat> <one|passage|day|ret|nodate> [single]
import sys, os, datetime
from pymongo import MongoClient

BOAT, mode = sys.argv[1], sys.argv[2]
OWNER = os.environ.get("SEED_OWNER", "test-admin-1")
single = len(sys.argv) > 3 and sys.argv[3] == "single"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
now = datetime.datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0) + datetime.timedelta(days=1)
f = lambda d: d.strftime("%Y-%m-%dT%H:%M")
legs = []
if mode in ("day", "ret"):
    fin = now + datetime.timedelta(hours=6) if mode == "day" else now + datetime.timedelta(days=2, hours=6)
    legs = [{"id": 1700000000002, "route_start": "TEST_Bay", "route_dest": "TEST_Home", "depart_at": f(fin - datetime.timedelta(hours=2)),
             "finish_at": f(fin), "arrive_type": "dock", "start_pos": None, "dest_pos": None, "path": None}]
if mode == "passage":
    legs = [{"id": 1700000000002, "route_start": "TEST_Bay", "route_dest": "TEST_Cove", "depart_at": f(now + datetime.timedelta(hours=4)),
             "finish_at": f(now + datetime.timedelta(hours=6)), "arrive_type": "mooring", "start_pos": None, "dest_pos": None, "path": None}]
weather = {"depart_at": "" if mode == "nodate" else f(now), "finish_at": "" if mode == "nodate" else f(now + datetime.timedelta(hours=2)),
           "arrive_type": "mooring", "legs": legs, "event_name": "TEST_Type Trip", "event_at": ""}
if mode == "passage": weather["trip_draft"] = True
if single: weather["single_hand"] = True
ts = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
keys = ["route_start", "route_dest", "route_trip", "route_trip_day", "underway", "depart", "arrive", "legs", "trip_ended", "weather"] + [f"weather.{k}" for k in list(weather) + ["trip_draft", "single_hand", "return_trip"]]
upd = {"boat.route_start": "TEST_Home", "boat.route_dest": "TEST_Bay", "boat.weather": weather, "boat.route_trip": "routeHazards",
       "boat.route_trip_day": now.strftime("%Y-%m-%d"), "boat.underway": {}, "boat.depart": {}, "boat.arrive": {}, "boat.legs": {"routeHazards": []}, "boat.trip_ended": "",
       "updated_at": ts}
doc = db.user_boats.find_one({"owner_id": OWNER, "boat_id": BOAT}, {"boat_ts": 1})
bts = dict(doc.get("boat_ts") or {}); bts.update({k: ts for k in keys}); upd["boat_ts"] = bts
r = db.user_boats.update_one({"owner_id": OWNER, "boat_id": BOAT}, {"$set": upd})
print("seeded", BOAT, mode, single, r.modified_count)
