# Temporarily add/remove the system Route Planning list on the Pro boat (for Navigator tests). Usage: python3 route_list_seed.py add | remove
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
doc = db.user_boats.find_one(KEY)
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
reg = [l for l in doc["registry"] if l["id"] != "routeHazards"]
if sys.argv[1] == "add":
    reg.append({"id": "routeHazards", "name": "Route Planning", "isSystem": True})
    db.user_boats.update_one(KEY, {"$set": {"registry": reg, "data.routeHazards": [{"id": 38001, "label": "Tide times check", "checked": False}],
                                            "sec_ts.registry": t, "list_ts.routeHazards": t, "updated_at": t}})
else:
    db.user_boats.update_one(KEY, {"$set": {"registry": reg, "sec_ts.registry": t, "updated_at": t, "boat.route_start": "", "boat.route_dest": "", "sec_ts.boat": t},
                                   "$unset": {"data.routeHazards": "", "list_ts.routeHazards": ""}})
print("done", sys.argv[1])
