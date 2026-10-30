# Seed helper for MPA wide-match (split/noise/admin synonyms) tests on the Pro boat (iteration 58).
# Usage: python3 mpa_rules_seed.py seed [withold] | restore   (backup at /tmp/pro_boat_58.json)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
LID, OLD = "custom_9000000000058", "custom_9000000000059"
BK = "/tmp/pro_boat_58.json"

def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent: d["indent"] = True
    return d

if sys.argv[1] == "restore":
    db.user_boats.replace_one(KEY, json_util.loads(open(BK).read()))
    print("restored"); sys.exit()

doc = db.user_boats.find_one(KEY)
if not os.path.exists(BK):
    open(BK, "w").write(json_util.dumps(doc))
reg = [l for l in doc["registry"] if l["id"] not in (LID, OLD) and l.get("kind") != "mpa"]
reg.append({"id": LID, "name": "TEST_Wide Meals", "isSystem": False})
meals = [it(58001, "1. Dinner peas"), it(58002, "[Cook it all]", True), it(58003, "Sea salt 1 tsp", True), it(58004, "Fresh peas 200g", True),
         it(58005, "Olive oil and Dijon Mustard", True), it(58006, " Salt & pepper", True), it(58007, "Chips 1", True)]
sets = {"registry": reg, f"data.{LID}": meals, f"list_ts.{LID}": t, "sec_ts.registry": t, "sec_ts.areas": t, "updated_at": t}
if len(sys.argv) > 2:  # old-style boat synonyms list that must be ignored now
    reg.append({"id": OLD, "name": "Food Synonyms", "isSystem": False})
    sets[f"data.{OLD}"] = [it(59001, "1. Chips"), it(59002, "Crisps", True)]
    sets[f"list_ts.{OLD}"] = t
ar = lambda i, n, q=1: {"id": i, "name": n, "qty": q, "removed": False}
sets["areas"] = [{"id": "t58galley", "name": "Galley Cupboard 1", "food": True,
    "items": [ar("t58a1", "Table Salt"), ar("t58a2", "Frozen peas 500g"), ar("t58a3", "Olive oil"), ar("t58a4", "Dijon mustard 200grams"), ar("t58a5", "Crisps")]}]
unset = {f"data.{l['id']}": "" for l in doc["registry"] if l.get("kind") == "mpa"}
db.user_boats.update_one(KEY, {"$set": sets, **({"$unset": unset} if unset else {})})
print("seeded", [l["name"] for l in db.user_boats.find_one(KEY)["registry"]])
