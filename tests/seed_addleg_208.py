# Seeds/inspects Model Vessel Route Planning for Add Leg position testing (iteration 208). Usage: python seed_addleg_208.py [seed|show|restore]
import sys, json
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util

db = MongoClient("mongodb://localhost:27017")["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
now = datetime.now(timezone.utc).isoformat()
mode = sys.argv[1] if len(sys.argv) > 1 else "show"

if mode == "seed":
    w = {"depart_at": "2026-12-18T09:00", "finish_at": "2026-12-18T12:00", "arrive_type": "mooring", "trip_draft": False,
         "legs": [
             {"id": 1001, "route_start": "TEST_ShipCove", "route_dest": "TEST_Picton", "depart_at": "2026-12-19T09:00", "finish_at": "2026-12-19T12:00", "arrive_type": "mooring"},
             {"id": 1002, "route_start": "TEST_Picton", "route_dest": "TEST_Havelock", "depart_at": "2026-12-20T09:00", "finish_at": "2026-12-20T12:00", "arrive_type": "dock"},
         ]}
    db.user_boats.update_one(Q, {"$set": {"boat.route_start": "TEST_Mana", "boat.route_dest": "TEST_ShipCove", "boat.weather": w,
        "boat_ts.route_start": now, "boat_ts.route_dest": now, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})
    print("seeded")
elif mode == "empty":
    db.user_boats.update_one(Q, {"$set": {"boat.route_start": "", "boat.route_dest": "", "boat.weather": {},
        "boat_ts.route_start": now, "boat_ts.route_dest": now, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})
    print("emptied")
elif mode == "restore":
    d = json_util.loads(open("/app/test_reports/backup/model_vessel_208.json").read())
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
print(json.dumps(b.get("weather"), default=str, indent=1)[:3000])
