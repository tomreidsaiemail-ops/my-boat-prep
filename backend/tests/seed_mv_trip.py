# Test helper: puts a TEST_ trip plan on test-admin-1/model_vessel Trip Planning (Leg 1 arrive type, optional Leg 2).
import sys, os, datetime
from pymongo import MongoClient

leg1 = sys.argv[1] if len(sys.argv) > 1 else "mooring"
leg2 = sys.argv[2] if len(sys.argv) > 2 else "dock"  # dock | mooring | none
BOAT = sys.argv[3] if len(sys.argv) > 3 else "model_vessel"
db = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))["test_database"]
now = datetime.datetime.utcnow().replace(second=0, microsecond=0)
f = lambda d: d.strftime("%Y-%m-%dT%H:%M")
legs = [] if leg2 == "none" else [{"id": 1700000000002, "route_start": "TEST_Bay", "route_dest": "TEST_Home" if leg2 == "dock" else "TEST_Cove",
        "depart_at": f(now + datetime.timedelta(hours=3)), "finish_at": f(now + datetime.timedelta(hours=5)), "arrive_type": leg2, "start_pos": None, "dest_pos": None, "path": None}]
weather = {"depart_at": f(now), "finish_at": f(now + datetime.timedelta(hours=2)), "arrive_type": leg1, "legs": legs, "event_name": "TEST_NextStep Trip", "event_at": f(now)}
ts = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
keys = ["route_start", "route_dest", "route_trip", "route_trip_day", "underway", "depart", "arrive", "legs", "trip_ended"] + [f"weather.{k}" for k in weather]
upd = {"boat.route_start": "TEST_Home", "boat.route_dest": "TEST_Bay", "boat.weather": weather, "boat.route_trip": "routeHazards",
       "boat.route_trip_day": now.strftime("%Y-%m-%d"), "boat.underway": {}, "boat.depart": {}, "boat.arrive": {}, "boat.legs": {"routeHazards": []}, "boat.trip_ended": "",
       "updated_at": ts}
doc = db.user_boats.find_one({"owner_id": "test-admin-1", "boat_id": BOAT}, {"boat_ts": 1})
bts = dict(doc.get("boat_ts") or {}); bts.update({k: ts for k in keys}); upd["boat_ts"] = bts
r = db.user_boats.update_one({"owner_id": "test-admin-1", "boat_id": BOAT}, {"$set": upd})
print("seeded", leg1, leg2, r.modified_count)
