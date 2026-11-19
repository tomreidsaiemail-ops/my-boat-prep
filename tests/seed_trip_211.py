# Trip Plan agreement helper (iteration 211). Usage: python seed_trip_211.py [backup|seed|default|nopins|empty|restore|crewboat|dropcrewboat|show]
# Model Vessel (test-user-pro/model_vessel) route + a TEST boat (test-user-pro/test_trip211) with test-user-free as crew for the crew API.
import sys, json, os
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util

db = MongoClient("mongodb://localhost:27017")["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
CQ = {"owner_id": "test-user-pro", "boat_id": "test_trip211"}
BK = "/app/test_reports/backup/model_vessel_211.json"
now = datetime.now(timezone.utc).isoformat()
mode = sys.argv[1] if len(sys.argv) > 1 else "show"
DEFAULT = "Pier X, Berth YYY, be onboard no later than ONE HOUR before DEPARTURE, as that is when the crew briefing will begin."
A, B, C = {"lat": -36.84, "lon": 174.77}, {"lat": -36.80, "lon": 174.90}, {"lat": -36.75, "lon": 175.00}


def weather(meetup="TEST_Meet at Pier 3 Berth 12 at 0800 sharp", pins=True, agree=None):
    w = {"depart_at": "2026-12-18T09:00", "finish_at": "2026-12-19T16:00", "why": "TEST_Why: SW 15 kn easing", "event_name": "TEST_Summer Cruise",
         "meetup": meetup, "legs": [{"route_start": "TEST_Mana Island", "route_dest": "TEST_Kawau", "depart_at": "2026-12-19T08:00", **({"dest_pos": C} if pins else {})}]}
    if pins:
        w.update({"start_pos": A, "dest_pos": B})
    if agree is not None:
        w["meetup_agree"] = agree
    return w


def setb(q, start, dest, w):
    db.user_boats.update_one(q, {"$set": {"boat.route_start": start, "boat.route_dest": dest, "boat.weather": w,
        "boat_ts.route_start": now, "boat_ts.route_dest": now, "boat_ts.weather": now, "sec_ts.boat": now, "updated_at": now}})


if mode == "backup":
    os.makedirs(os.path.dirname(BK), exist_ok=True)
    if not os.path.exists(BK):
        open(BK, "w").write(json_util.dumps(db.user_boats.find_one(Q)))
    print("backed up")
elif mode == "seed":
    setb(Q, "TEST_Mana Marina", "TEST_Mana Island", weather())
elif mode == "default":
    setb(Q, "TEST_Mana Marina", "TEST_Mana Island", weather(meetup=DEFAULT))
elif mode == "nopins":
    setb(Q, "TEST_Mana Marina", "TEST_Mana Island", weather(pins=False, agree=False))
elif mode == "empty":
    setb(Q, "", "", {})
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
elif mode == "crewboat":
    db.user_boats.delete_one(CQ)
    db.user_boats.insert_one({**CQ, "boat": {"vessel": "TEST_Trip211", "route_start": "TEST_A", "route_dest": "TEST_B", "weather": weather()},
                              "crew": ["test-user-free"], "crew_roles": {"test-user-free": []}, "crew_trips": {"test-user-free": ["routeHazards"]},
                              "registry": [{"id": "routeHazards", "name": "Route Planning"}], "zone_maps": [], "areas": [], "created_at": now, "updated_at": now})
    print("crew boat seeded")
elif mode == "dropcrewboat":
    print(db.user_boats.delete_one(CQ).deleted_count)
d = db.user_boats.find_one(Q)
b = d["boat"]
w = dict(b.get("weather") or {})
w.pop("path", None)
print(b.get("route_start"), "->", b.get("route_dest"))
print(json.dumps(w, default=str)[:900])
