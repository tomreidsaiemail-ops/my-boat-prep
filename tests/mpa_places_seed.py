# Seed helper for MPA main-word matching + places popover tests (iteration 62) on the Pro boat.
# Usage: python3 mpa_places_seed.py seed | restore   (backup at /tmp/pro_boat_62.json; private admin list 'Admin - Food Synonyms' tpl_test62syn)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
LID = "custom_9000000000062"
TPL = "tpl_test62syn"
BK = "/tmp/pro_boat_62.json"

if sys.argv[1] == "restore":
    db.user_boats.replace_one(KEY, json_util.loads(open(BK).read()))
    db.list_templates.delete_one({"list_id": TPL})
    print("restored"); sys.exit()

def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent: d["indent"] = True
    return d

syn = [("1. Salt", 0), ("Salt", 1), ("Table Salt", 1), ("Sea Salt", 1), ("Rock Salt", 1),
       ("3. Peppers", 0), ("Bell Peppers", 1), ("Chilli", 1), ("4. Pepper", 0), ("Ground Black Pepper", 1), ("White Pepper", 1)]
db.list_templates.delete_one({"list_id": TPL})
db.list_templates.insert_one({"list_id": TPL, "custom": True, "private": True, "name": "Admin - Food Synonyms", "description": "",
    "items": [{"id": f"s{n}", "label": l, **({"indent": True} if ind else {})} for n, (l, ind) in enumerate(syn)],
    "created_at": t, "updated_at": t, "updated_by": "test-admin-1"})

doc = db.user_boats.find_one(KEY)
if not os.path.exists(BK):
    open(BK, "w").write(json_util.dumps(doc))
ingr = ["Salt and pepper", "Pepper 1 tsp", "Sea Salt", "Rice 200g", "Chilli pickle"]
meals = [it(62001, "1. Dinner pasta"), it(62002, "[Boil pasta]", True)] + [it(62010 + n, x, True) for n, x in enumerate(ingr)]
reg = [l for l in doc["registry"] if l["id"] != LID and l.get("kind") != "mpa"]
reg.append({"id": LID, "name": "TEST_Places Meals", "isSystem": False})
sets = {"registry": reg, f"data.{LID}": meals, f"list_ts.{LID}": t, "sec_ts.registry": t, "sec_ts.areas": t, "updated_at": t,
        "data.provisions": [], "list_ts.provisions": t}
A1 = ["Sea Salt", "Table Salt", "Chilli pickle", "Rice"]
A2 = ["Rock Salt", "Ground Black Pepper", "Sea Salt"]
sets["areas"] = [
    {"id": "t62galley1", "name": "Galley Cupboard 1", "food": True, "items": [{"id": f"t62a{n}", "name": f, "qty": 1, "removed": False} for n, f in enumerate(A1)]},
    {"id": "t62galley2", "name": "Galley Cupboard 2", "food": True, "items": [{"id": f"t62b{n}", "name": f, "qty": 1, "removed": False} for n, f in enumerate(A2)]},
]
unset = {f"data.{l['id']}": "" for l in doc["registry"] if l.get("kind") == "mpa"}
db.user_boats.update_one(KEY, {"$set": sets, **({"$unset": unset} if unset else {})})
print("seeded")
