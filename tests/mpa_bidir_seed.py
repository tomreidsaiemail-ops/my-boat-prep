# Seed helper for MPA bidirectional synonym tests on the Pro boat (iteration 59).
# Usage: python3 mpa_bidir_seed.py seed S1|S2|S3|S4 | restore   (backup at /tmp/pro_boat_59.json)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
LID = "custom_9000000000059"
BK = "/tmp/pro_boat_59.json"

def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent: d["indent"] = True
    return d

if sys.argv[1] == "restore":
    db.user_boats.replace_one(KEY, json_util.loads(open(BK).read()))
    print("restored"); sys.exit()

# scenario -> (recipe ingredients, food items, provisions)
SC = {
    "S1": (["Salt 1 tsp", "Salt and pepper to taste", "Salted butter 20g", "2 Crisps"], ["Sea salt", "Crisps"], ["Table salt"]),
    "S2": (["Sea salt 1 tsp"], ["Salt"], ["Table salt"]),
    "S3": (["Table salt"], ["Sea Salt 500g"], []),
    "S4": (["Pinch of salt", "Table salt 2"], ["Table Salt"], []),
    "S5": (["Salt 1 tsp", "Olive oil and Dijon Mustard"], ["Sea salt", "Olive oil"], ["Sea salt"]),
}
ingr, food, prov = SC[sys.argv[2]]
doc = db.user_boats.find_one(KEY)
if not os.path.exists(BK):
    open(BK, "w").write(json_util.dumps(doc))
reg = [l for l in doc["registry"] if l["id"] != LID and l.get("kind") != "mpa"]
reg.append({"id": LID, "name": "TEST_Bidir Meals", "isSystem": False})
meals = [it(59001, "1. Dinner salt"), it(59002, "[Cook it all]", True)] + [it(59010 + n, x, True) for n, x in enumerate(ingr)]
sets = {"registry": reg, f"data.{LID}": meals, f"list_ts.{LID}": t, "sec_ts.registry": t, "sec_ts.areas": t, "updated_at": t,
        "data.provisions": [it(59100 + n, p) for n, p in enumerate(prov)], "list_ts.provisions": t}
sets["areas"] = [{"id": "t59galley", "name": "Galley Cupboard 1", "food": True,
    "items": [{"id": f"t59a{n}", "name": f, "qty": 1, "removed": False} for n, f in enumerate(food)]}]
unset = {f"data.{l['id']}": "" for l in doc["registry"] if l.get("kind") == "mpa"}
db.user_boats.update_one(KEY, {"$set": sets, **({"$unset": unset} if unset else {})})
print("seeded", sys.argv[2], ingr, food, prov)
