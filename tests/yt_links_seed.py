# Seed helper for YouTube link rendering tests (iteration 61) on the Pro boat.
# Usage: python3 yt_links_seed.py seed | restore   (backup at /tmp/pro_boat_61.json)
# seed: adds 'TEST_YT Links' checklist + 'TEST_YT Meals' meal list, voyage notes with YouTube links, beta user as crew.
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
t = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
LA, LM = "custom_9000000000061", "custom_9000000000062"
BK = "/tmp/pro_boat_61.json"

if sys.argv[1] == "restore":
    db.user_boats.replace_one(KEY, json_util.loads(open(BK).read()))
    print("restored"); sys.exit()

def it(i, label, indent=False):
    d = {"id": i, "checked": False, "label": label}
    if indent: d["indent"] = True
    return d

doc = db.user_boats.find_one(KEY)
if not os.path.exists(BK):
    open(BK, "w").write(json_util.dumps(doc))
links = [it(61001, "Watch https://www.youtube.com/watch?v=dQw4w9WgXcQ first"),
         it(61002, "[Fry onions, see youtu.be/abc123XYZ.]"),
         it(61003, "Shorts https://youtube.com/shorts/xyz789"),
         it(61004, "m.youtube.com/watch?v=1 and https://youtu.be/2"),
         it(61005, "Docs at https://example.com/page"),
         it(61006, "Plain item no links")]
meals = [it(61101, "1. Pasta night"), it(61102, "[Boil pasta, watch https://youtu.be/pasta01 for sauce.]", True),
         it(61103, "Spaghetti 500g", True), it(61104, "Basil https://youtu.be/basil99", True)]
reg = [l for l in doc["registry"] if l["id"] not in (LA, LM) and l.get("kind") != "mpa"]
reg += [{"id": LA, "name": "TEST_YT Links", "isSystem": False}, {"id": LM, "name": "TEST_YT Meals", "isSystem": False}]
sets = {"registry": reg, f"data.{LA}": links, f"data.{LM}": meals, f"list_ts.{LA}": t, f"list_ts.{LM}": t,
        "sec_ts.registry": t, "updated_at": t,
        "voyage_notes": "Leaving Saturday 8am.\nKnots refresher: https://www.youtube.com/watch?v=knot42 and youtu.be/reef7.\nSite: https://example.com"}
unset = {f"data.{l['id']}": "" for l in doc["registry"] if l.get("kind") == "mpa"}
db.user_boats.update_one(KEY, {"$set": sets, "$addToSet": {"crew": "test-user-beta"}, **({"$unset": unset} if unset else {})})
print("seeded")
