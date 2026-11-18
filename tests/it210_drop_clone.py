# Iteration 210: remove a TEST_ 'Crew Prep - <name>' clone list from test-user-pro/model_vessel by list id. Usage: python it210_drop_clone.py <list_id>
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
db = MongoClient("mongodb://localhost:27017")["test_database"]
Q = {"owner_id": "test-user-pro", "boat_id": "model_vessel"}
lid = sys.argv[1]
d = db.user_boats.find_one(Q)
l = next((x for x in d["registry"] if x["id"] == lid), None)
assert l and l["name"].startswith("Crew Prep - TEST_210"), l
now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
r = db.user_boats.update_one(Q, {"$pull": {"registry": {"id": lid}}, "$unset": {f"data.{lid}": "", f"list_ts.{lid}": ""},
                                 "$addToSet": {"deleted_lists": lid}, "$set": {"sec_ts.registry": now, "sec_ts.deleted_lists": now, "updated_at": now}})
print("modified", r.modified_count)
