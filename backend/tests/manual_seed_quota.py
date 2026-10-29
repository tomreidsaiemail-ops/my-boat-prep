# Manual helper: seed/clear the shared Magic quota for a test user. Usage: python manual_seed_quota.py <user_id> <daily_used> <purchased> | clear <user_id>
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
if sys.argv[1] == "clear":
    DB.magic_quota.delete_one({"user_id": sys.argv[2]})
else:
    uid, used, bought = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    # Use a far-future date window: set both today's UTC date; reset only happens if local date differs, so set per common zones
    today = datetime.now(timezone.utc).date().isoformat()
    DB.magic_quota.update_one({"user_id": uid}, {"$set": {"daily_used": used, "purchased_allowance": bought, "last_reset_date": today}}, upsert=True)
print(DB.magic_quota.find_one({"user_id": sys.argv[-1] if sys.argv[1] == "clear" else sys.argv[1]}, {"_id": 0}))
