# Seed helper for Navigator map / Coast Guard report UI tests on the Pro boat.
# Usage: python3 nav_route_seed.py seed | restore   (backup at /tmp/pro_boat_53.json)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

if sys.argv[1] == "restore":
    d = json_util.loads(open("/tmp/pro_boat_53.json").read())
    d["updated_at"] = t
    for k in list((d.get("sec_ts") or {}).keys()):
        d["sec_ts"][k] = t
    db.user_boats.replace_one(KEY, d)
    print("restored")
    sys.exit()

doc = db.user_boats.find_one(KEY)
if not os.path.exists("/tmp/pro_boat_53.json"):
    open("/tmp/pro_boat_53.json", "w").write(json_util.dumps(doc))
reg = [l for l in doc["registry"] if l["id"] != "routeHazards"]
reg.insert(0, {"id": "routeHazards", "name": "Route Planning", "isSystem": True})
boat = {**doc["boat"], "route_start": "", "route_dest": "", "mmsi": sys.argv[2] if len(sys.argv) > 2 else "", "children": 1, "trip_days": 2}
db.user_boats.update_one(KEY, {"$set": {"registry": reg, "data.routeHazards": [{"id": 53001, "label": "Check tides", "checked": False}],
                                        "boat": boat, "deleted_lists": [x for x in doc.get("deleted_lists", []) if x != "routeHazards"],
                                        "list_ts.routeHazards": t, "sec_ts.registry": t, "sec_ts.boat": t, "updated_at": t}})
print("seeded")
