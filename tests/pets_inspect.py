# Inspect / clean helper for pets tests on the Pro boat. Usage: python3 pets_inspect.py show | clean
import os, sys, json
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
doc = db.user_boats.find_one(KEY)
if sys.argv[1] == "show":
    b = doc.get("boat", {})
    print("boat:", json.dumps({k: b.get(k) for k in ("vessel", "units", "pob", "children", "trip_days", "pets", "route_start", "route_dest")}))
    for l in doc.get("registry", []):
        if not l.get("isSystem") or l.get("kind"):
            print("list:", l["id"], l.get("name"), l.get("kind"), len(doc.get("data", {}).get(l["id"], [])))
    print("areas:", [(a.get("name"), a.get("food")) for a in doc.get("areas", [])])
elif sys.argv[1] == "clean":
    t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    mpa = [l["id"] for l in doc["registry"] if l.get("kind") == "mpa"]
    reg = [l for l in doc["registry"] if l.get("kind") != "mpa"]
    upd = {"$set": {"boat.pets": [], "boat.units": sys.argv[2] if len(sys.argv) > 2 else doc["boat"].get("units", "m"), "registry": reg, "sec_ts.boat": t, "sec_ts.registry": t, "updated_at": t}}
    if mpa:
        upd["$unset"] = {f"data.{i}": "" for i in mpa}
    db.user_boats.update_one(KEY, upd)
    print("cleaned", mpa)
