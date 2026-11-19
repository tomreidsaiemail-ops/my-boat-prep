# Iteration 212: near-start end pin (twin) test on test-user-pro / model_vessel. Usage: python seed_twin_212.py [backup|seed|restore|show]
import sys, json, os
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util

db = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
BK = "/app/test_reports/backup/model_vessel_212.json"
now = datetime.now(timezone.utc).isoformat()
mode = sys.argv[1] if len(sys.argv) > 1 else "show"

if mode == "backup":
    os.makedirs(os.path.dirname(BK), exist_ok=True)
    if not os.path.exists(BK):
        open(BK, "w").write(json_util.dumps(db.user_boats.find_one(Q)))
    print("backed up")
elif mode == "seed":
    w = {"depart_at": "2026-12-18T09:00", "finish_at": "2026-12-18T12:00", "arrive_type": "mooring", "trip_draft": True,
         "start_pos": {"lat": -41.1036, "lon": 174.8686}, "dest_pos": {"lat": -41.1033, "lon": 174.8689}, "legs": []}
    db.user_boats.update_one(Q, {"$set": {"boat.route_start": "TEST_A", "boat.route_dest": "TEST_B", "boat.weather": w,
        "boat_ts.route_start": now, "boat_ts.route_dest": now, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})
    print("seeded")
elif mode in ("far", "same", "near101"):
    dest = {"far": {"lat": -41.1056, "lon": 174.8686}, "same": {"lat": -41.1036, "lon": 174.8686}, "near101": {"lat": -41.10451, "lon": 174.8686}}[mode]
    db.user_boats.update_one(Q, {"$set": {"boat.weather.dest_pos": dest, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})
    print(mode)
elif mode == "restore":
    d = json_util.loads(open(BK).read())
    d.pop("_id", None)
    for k in ("boat_ts", "sec_ts"):
        if isinstance(d.get(k), dict):
            for f in list(d[k].keys()):
                d[k][f] = now
    d["updated_at"] = now
    db.user_boats.replace_one(Q, d)
    print("restored")
d = db.user_boats.find_one(Q)
b = d["boat"]
print(b.get("route_start"), "->", b.get("route_dest"))
print(json.dumps({k: v for k, v in (b.get("weather") or {}).items() if k not in ("path", "advice")}, default=str)[:1500])
