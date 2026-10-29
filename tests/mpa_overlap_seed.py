# Seed helper for MPA inventory overlap / dual badge tests on the Pro boat.
# Usage: python3 mpa_overlap_seed.py seed | restore   (backup at /tmp/pro_boat_52.json)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
LID = "custom_9000000000052"

def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent: d["indent"] = True
    return d

if sys.argv[1] == "restore":
    d = json_util.loads(open("/tmp/pro_boat_52.json").read())
    db.user_boats.replace_one(KEY, d)
    print("restored")
    sys.exit()

doc = db.user_boats.find_one(KEY)
reg = [l for l in doc["registry"] if l["id"] not in (LID, "provisions") and l.get("kind") != "mpa"]
reg.insert(0, {"id": "provisions", "name": "Provisions", "isSystem": True})
reg.append({"id": LID, "name": "TEST_Overlap Meals", "isSystem": False})
meals = [it(52001, "1. Dinner rice bowl"), it(52002, "[Boil the rice, fry the eggs]", True), it(52003, "200g rice", True), it(52004, "2 eggs", True),
         it(52005, "2. Breakfast toast"), it(52006, "[Toast the bread]", True), it(52007, "2 slices bread", True), it(52008, "1 tbsp butter", True)]
prov = [it(52100 + k, n) for k, n in enumerate(["Milk", "Salt", "Coffee", "Rice", "Tea", "Sugar"])]
ar = lambda i, n, q=1: {"id": i, "name": n, "qty": q, "removed": False}
areas = [
    {"id": "t52galley", "name": "Main Galley Cupboard", "food": True, "items": [ar("t52a1", "Salt"), ar("t52a2", "Coffee", 2), ar("t52a3", "Rice")]},
    {"id": "t52fridge", "name": "Fridge", "food": True, "items": [ar("t52b1", "Coffee"), ar("t52b2", "Eggs", 6)]},
    {"id": "t52settee", "name": "Main Galley Cupboard Under Starboard Settee", "food": True, "items": [ar("t52c1", "Sugar")]},
    {"id": "t52locker", "name": "TEST_Bosun Locker", "items": [ar("t52d1", "Milk", 4)]},
]
lists = [l for l in doc["registry"] if l.get("kind") == "mpa"]
unset = {f"data.{l['id']}": "" for l in lists}
db.user_boats.update_one(KEY, {"$set": {"registry": reg, "data.provisions": prov, f"data.{LID}": meals, "areas": areas,
    "list_ts.provisions": t, f"list_ts.{LID}": t, "sec_ts.registry": t, "sec_ts.areas": t, "updated_at": t}, **({"$unset": unset} if unset else {})})
print("seeded", [l["id"] for l in db.user_boats.find_one(KEY)["registry"]][:3])
