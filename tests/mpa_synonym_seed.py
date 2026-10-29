# Seed helper for MPA Food Synonyms tests on the Pro boat (iteration 56).
# Usage: python3 mpa_synonym_seed.py seed | mine | none | restore   (backup at /tmp/pro_boat_56.json, taken on first seed)
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
BACKUP = "/tmp/pro_boat_56.json"
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
MEALS, SYN, MINE = "custom_9000000000056", "custom_9000000000057", "custom_9000000000058"


def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent:
        d["indent"] = True
    return d


ar = lambda i, n, q=1: {"id": i, "name": n, "qty": q, "removed": False}
mode = sys.argv[1]
if mode == "restore":
    d = json_util.loads(open(BACKUP).read())
    db.user_boats.replace_one(KEY, d)
    print("restored")
    sys.exit()

doc = db.user_boats.find_one(KEY)
if mode == "seed" and not os.path.exists(BACKUP):
    open(BACKUP, "w").write(json_util.dumps(doc))
reg = [l for l in doc["registry"] if l["id"] not in (MEALS, SYN, MINE, "provisions") and l.get("kind") != "mpa"]
reg.insert(0, {"id": "provisions", "name": "Provisions", "isSystem": True})
reg.append({"id": MEALS, "name": "TEST_Syn Meals", "isSystem": False})
syn_name = "Food Synonyms" if mode != "none" else "TEST_Old Synonyms"
reg.append({"id": SYN, "name": syn_name, "isSystem": False})
if mode == "mine":
    reg.append({"id": MINE, "name": "my food SYNONYMS ", "isSystem": False})
meals = [it(56001, "1. Dinner pasta"), it(56002, "[Boil the pasta, add butter and salt]", True), it(56003, "Sea salt 1 tsp", True),
         it(56004, "Butter 20g", True), it(56005, "2 eggs", True), it(56006, "200g rice", True)]
syn = [it(56101, "Salt"), it(56102, "Table Salt", True), it(56103, "Sea salt", True), it(56104, "Butter"), it(56105, "Margarine", True)]
mine = [it(56201, "Sea salt = Flaky salt")]
prov = [it(56300 + k, n) for k, n in enumerate(["Salt", "Coffee", "Tea"])]
fridge = [ar("t56b1", "Eggs", 6)] + ([ar("t56b2", "Flaky salt")] if mode == "mine" else [])
areas = [
    {"id": "t56galley", "name": "Galley Cupboard 1", "food": True, "items": [ar("t56a1", "Table Salt"), ar("t56a2", "Margarine"), ar("t56a3", "Rice"), ar("t56a4", "Coffee", 2)]},
    {"id": "t56fridge", "name": "Fridge", "food": True, "items": fridge},
    {"id": "t56locker", "name": "TEST_Bosun Locker", "items": [ar("t56d1", "Sea salt", 4)]},
]
lists = [l for l in doc["registry"] if l.get("kind") == "mpa"]
unset = {f"data.{l['id']}": "" for l in lists}
sets = {"registry": reg, "data.provisions": prov, f"data.{MEALS}": meals, f"data.{SYN}": syn, "areas": areas,
        "list_ts.provisions": t, f"list_ts.{MEALS}": t, f"list_ts.{SYN}": t, "sec_ts.registry": t, "sec_ts.areas": t, "updated_at": t}
if mode == "mine":
    sets.update({f"data.{MINE}": mine, f"list_ts.{MINE}": t})
db.user_boats.update_one(KEY, {"$set": sets, **({"$unset": unset} if unset else {})})
print("seeded", mode, [l["name"] for l in db.user_boats.find_one(KEY)["registry"]][-3:])
