# Seed helper for meal type tests on the Pro boat's Meal Plan.
# Usage: python3 meal_type_seed.py old | oldparen | edited | deleted | custom | info
# old = untouched old 21-meal plan (first 135 items, ids 3000.., no meal_type); oldparen = same with "(recipe)" lines;
# edited = old with one label changed; deleted = old with one item removed; custom = add TEST_ custom list without type words.
import os, sys, json, subprocess
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
# Built-in list generated from the frontend source
src = subprocess.run(["node", "-e", """
const fs=require('fs');let s=fs.readFileSync('/app/frontend/src/lib/mealPlan.js','utf8').replace(/export const /g,'const ');
eval(s+';console.log(JSON.stringify({base:MEAL_PLAN_BASE_LEN,items:MEAL_PLAN_ITEMS}))');"""], capture_output=True, text=True).stdout
B = json.loads(src)
old = [{"id": 3000 + k, "checked": False, "label": i["label"], **({"indent": True} if i.get("indent") else {})} for k, i in enumerate(B["items"][:B["base"]])]
cmd = sys.argv[1]
def setplan(p):
    db.user_boats.update_one(KEY, {"$set": {"data.mealPlan": p, "list_ts.mealPlan": t, "updated_at": t}})
if cmd == "old": setplan(old)
elif cmd == "oldparen": setplan([{**i, "label": "(" + i["label"][1:-1] + ")"} if i["label"].startswith("[") else i for i in old])
elif cmd == "edited": p = [dict(i) for i in old]; p[0]["label"] = "1. Day 1 Breakfast: Porridge with jam"; setplan(p)
elif cmd == "deleted": setplan(old[:4] + old[5:])
elif cmd == "custom":
    lid = "custom_9000000000003"
    names = ["Pasta", "Curry", "Pancakes", "Brownie", "Apples"]
    items, i = [], 93000
    for n, name in enumerate(names):
        items += [{"id": i, "checked": False, "label": f"{n+1}. {name}"}, {"id": i+1, "checked": False, "label": "[Cook]", "indent": True}, {"id": i+2, "checked": False, "label": "100g pasta", "indent": True}]; i += 3
    d = db.user_boats.find_one(KEY)
    reg = [l for l in d["registry"] if l["id"] != lid] + [{"id": lid, "name": "TEST_Typeless Meals", "isSystem": False}]
    db.user_boats.update_one(KEY, {"$set": {"registry": reg, f"data.{lid}": items, f"list_ts.{lid}": t, "sec_ts.registry": t, "updated_at": t}})
d = db.user_boats.find_one(KEY)
mp = d["data"]["mealPlan"]
print(cmd, "mealPlan len", len(mp), "typed", sum(1 for i in mp if i.get("meal_type")), "first", mp[0]["label"], mp[1]["label"][:20], "trip", d["boat"].get("trip_days"))
