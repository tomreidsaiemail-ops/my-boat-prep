# Helper: set test-user-pro/main Trip Planning state for Day Trip / Transit UI tests (restore from /tmp/pro_main_backup_219.json after)
import sys, json
from pymongo import MongoClient
db = MongoClient("mongodb://localhost:27017")["test_database"]
import os
key = {"owner_id": os.environ.get("TP_OWNER", "test-user-pro"), "boat_id": os.environ.get("TP_BOAT", "main")}
A = {"lat": -41.10, "lon": 174.82}   # TEST start
B = {"lat": -41.05, "lon": 174.90}
C = {"lat": -41.08, "lon": 174.95}
mode = sys.argv[1]
doc = db.user_boats.find_one(key)
w = dict(doc["boat"].get("weather") or {})
base = {"boat.route_trip": "", "boat.underway": {}, "boat.legs": {}}
if mode == "day1":  # one leg back to start
    w.update({"legs": [], "start_pos": A, "dest_pos": A, "arrive_type": "dock", "path": None, "return_trip": False})
    upd = {"boat.route_start": "TEST_Mana", "boat.route_dest": "TEST_Mana", "boat.weather": w}
elif mode == "ret2":  # normal 2-leg return trip
    w.update({"start_pos": A, "dest_pos": B, "arrive_type": "mooring", "path": None,
              "legs": [{"id": 111, "route_start": "TEST_Picton", "route_dest": "TEST_Mana", "dest_pos": A, "arrive_type": "dock", "depart_at": "2026-11-21T06:00", "finish_at": "2026-11-21T09:00"}]})
    upd = {"boat.route_start": "TEST_Mana", "boat.route_dest": "TEST_Picton", "boat.weather": w}
elif mode == "day3":  # Day trip: Mana -> B (transit) -> C (transit) -> Mana (dock), underway on leg 1
    w.update({"start_pos": A, "dest_pos": B, "arrive_type": "transit", "path": None, "name": "TEST_Regatta",
              "legs": [{"id": 211, "route_start": "TEST_Buoy B", "route_dest": "TEST_Buoy C", "dest_pos": C, "arrive_type": "transit", "depart_at": "2026-11-21T07:00", "finish_at": "2026-11-21T08:00"},
                       {"id": 212, "route_start": "TEST_Buoy C", "route_dest": "TEST_Mana", "dest_pos": A, "arrive_type": "dock", "depart_at": "2026-11-21T08:00", "finish_at": "2026-11-21T09:00"}]})
    upd = {"boat.route_start": "TEST_Mana", "boat.route_dest": "TEST_Buoy B", "boat.weather": w,
           "boat.underway": {"trip_id": "routeHazards", "name": "Trip Planning", "event": "", "leg": "dock", "line": "TEST_Mana to TEST_Buoy B", "at": "2026-11-20T07:00:00.000Z"},
           "boat.legs": {"routeHazards": [{"id": 9001, "kind": "dock", "start": "TEST_Mana", "dest": "TEST_Buoy B", "depart_at": "2026-11-21T06:00", "arrive_type": "transit", "at": "2026-11-20T07:00:00.000Z", "logs": []}]}}
    base = {}
elif mode == "nonday":  # Mana -> Picton -> Nelson (not back home)
    w.update({"start_pos": A, "dest_pos": B, "arrive_type": "mooring", "path": None,
              "legs": [{"id": 311, "route_start": "TEST_Picton", "route_dest": "TEST_Nelson", "dest_pos": C, "arrive_type": "berth", "depart_at": "2026-11-21T06:00", "finish_at": "2026-11-21T09:00"}]})
    upd = {"boat.route_start": "TEST_Mana", "boat.route_dest": "TEST_Picton", "boat.weather": w}
elif mode == "show":
    b = doc["boat"]
    print(json.dumps({"rs": b.get("route_start"), "rd": b.get("route_dest"), "at": w.get("arrive_type"), "legs": [(l.get("route_start"), l.get("route_dest"), l.get("arrive_type")) for l in w.get("legs") or []],
                      "underway": b.get("underway"), "sailed": b.get("legs")}, default=str, indent=1))
    print("shipsLog tail:", [e.get("label") for e in (doc.get("data", {}).get("shipsLog") or [])[-4:]])
    sys.exit()
db.user_boats.update_one(key, {"$set": {**base, **upd}})
print("set", mode)
