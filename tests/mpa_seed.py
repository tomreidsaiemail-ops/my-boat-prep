# Seed helper for MPA warnings tests: set trip_days and add/remove TEST_ meal plan lists for the Pro boat.
# Usage: python3 mpa_seed.py days N | lists | clean
import os, sys, json
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
now = lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def meals(names, base):
    out, i = [], base
    for n, name in enumerate(names):
        out.append({"id": i, "checked": False, "label": f"{n+1}. {name}"}); i += 1
        out.append({"id": i, "checked": False, "label": "[Cook it]", "indent": True}); i += 1
        out.append({"id": i, "checked": False, "label": "100g rice", "indent": True}); i += 1
    return out

A = ("custom_9000000000001", "TEST_Kids Meals", ["Breakfast pancakes", "Lunch sandwiches", "Dinner pasta", "Dessert ice cream", "Snack apples"])
B = ("custom_9000000000002", "TEST_Extra Meals", ["Brunch eggs"])

cmd = sys.argv[1]
doc = db.user_boats.find_one(KEY)
t = now()
if cmd == "days":
    db.user_boats.update_one(KEY, {"$set": {"boat.trip_days": int(sys.argv[2]), "sec_ts.boat": t, "updated_at": t}})
elif cmd == "lists":
    reg = [l for l in doc["registry"] if not l["id"].startswith("custom_900000000000")]
    upd = {"sec_ts.registry": t, "updated_at": t}
    for k, (lid, name, ns) in enumerate((A, B)):
        reg.append({"id": lid, "name": name, "isSystem": False})
        upd[f"data.{lid}"] = meals(ns, 90000 + k * 1000)
        upd[f"list_ts.{lid}"] = t
    upd["registry"] = reg
    db.user_boats.update_one(KEY, {"$set": upd})
elif cmd == "clean":
    reg = [l for l in doc["registry"] if not l["id"].startswith("custom_900000000000") and l.get("kind") != "mpa"]
    mpa = [l["id"] for l in doc["registry"] if l.get("kind") == "mpa"]
    uns = {f"data.{i}": "" for i in [A[0], B[0], *mpa]}
    uns.update({f"list_ts.{i}": "" for i in [A[0], B[0], *mpa]})
    db.user_boats.update_one(KEY, {"$set": {"registry": reg, "sec_ts.registry": t, "updated_at": t, "boat.trip_days": 0, "sec_ts.boat": t}, "$unset": uns})
d = db.user_boats.find_one(KEY)
print(cmd, "trip_days", d["boat"].get("trip_days"), [(l["id"], l["name"], l.get("kind")) for l in d["registry"] if l["id"].startswith("custom_9") or l.get("kind") == "mpa" or l["id"] == "mealPlan"])
