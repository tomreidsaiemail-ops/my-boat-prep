# Iteration 210 helper: backup / show crew prep clones + invites on test-user-pro model_vessel. Usage: python it210_db.py [backup|show|clean]
import sys, os
from pymongo import MongoClient
from bson import json_util
db = MongoClient("mongodb://localhost:27017")["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
BK = "/app/test_reports/backup/model_vessel_210.json"
mode = sys.argv[1] if len(sys.argv) > 1 else "show"
d = db.user_boats.find_one(Q)
if mode == "backup":
    os.makedirs(os.path.dirname(BK), exist_ok=True)
    if not os.path.exists(BK): open(BK, "w").write(json_util.dumps(d))
    print("backed up")
reg = (d.get("registry") or d.get("state", {}).get("registry") or [])
print("keys", list(d.keys())[:30])
print("registry crew prep:", [(l.get("id"), l.get("name")) for l in reg if "crew prep" in (l.get("name") or "").lower() or "role" in (l.get("name") or "").lower()])
for i in db.crew_invites.find({"owner_id": "test-user-pro", "boat_id": "model_vessel"}, {"_id": 0, "invite_id": 1, "name": 1, "email": 1, "roles": 1, "quick": 1}):
    print("invite", i)
if mode == "clean":
    r = db.crew_invites.delete_many({"owner_id": "test-user-pro", "boat_id": "model_vessel", "name": {"$regex": "^TEST_210"}})
    print("deleted invites", r.deleted_count)
