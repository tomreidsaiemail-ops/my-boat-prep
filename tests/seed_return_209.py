# Return trip testing helper (iteration 209) for test-user-pro / model_vessel. Usage: python seed_return_209.py [backup|empty|typed|show|restore]
import sys, json, os
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util

db = MongoClient("mongodb://localhost:27017")["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
BK = "/app/test_reports/backup/model_vessel_209.json"
now = datetime.now(timezone.utc).isoformat()
mode = sys.argv[1] if len(sys.argv) > 1 else "show"


def setb(start, dest, w):
    db.user_boats.update_one(Q, {"$set": {"boat.route_start": start, "boat.route_dest": dest, "boat.weather": w,
        "boat_ts.route_start": now, "boat_ts.route_dest": now, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})


if mode == "backup":
    os.makedirs(os.path.dirname(BK), exist_ok=True)
    if not os.path.exists(BK):
        open(BK, "w").write(json_util.dumps(db.user_boats.find_one(Q)))
    print("backed up")
elif mode == "empty":
    setb("", "", {})
elif mode == "typed":
    setb("TEST_Mana Marina", "TEST_Mana Island", {"depart_at": "2026-12-18T09:00", "finish_at": "2026-12-18T12:00", "arrive_type": "mooring", "event_name": "TEST_Event"})
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
w = dict(b.get("weather") or {})
w["legs"] = [{k: v for k, v in l.items() if k != "path"} for l in (w.get("legs") or [])]
w.pop("path", None)
w.pop("advice", None)
print(b.get("route_start"), "->", b.get("route_dest"))
print(json.dumps(w, default=str, indent=1)[:2500])
