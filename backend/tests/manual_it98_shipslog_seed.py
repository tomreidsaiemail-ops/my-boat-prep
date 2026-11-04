# Manual seed/cleanup for iteration 98 Ship's Log folders/year-fold/paper-scan tests: TEST pro user with dated logs across 2024 and 2025
import sys, copy
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
UID, TOK = "TEST_it98_log", "test_session_it98_log"

if sys.argv[1:] == ["clean"]:
    print(db.users.delete_one({"user_id": UID}).deleted_count, db.user_sessions.delete_many({"user_id": UID}).deleted_count,
          db.user_boats.delete_many({"owner_id": UID}).deleted_count)
    sys.exit()

src = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
now = datetime.now(timezone.utc)
db.users.update_one({"user_id": UID}, {"$set": {"user_id": UID, "email": "test_it98_log@example.com", "name": UID, "picture": "", "role": "pro",
                    "created_at": now.isoformat(), "tos_accepted_at": now.isoformat(), "tos_version": "2026-06", "last_boat": "main"}}, upsert=True)
db.user_sessions.update_one({"session_token": TOK}, {"$set": {"session_token": TOK, "user_id": UID, "created_at": now, "expires_at": now + timedelta(days=2)}}, upsert=True)
boat = copy.deepcopy(src["boat"])
boat.update({"vessel": "TEST it98 Vessel", "skipper": "TEST Skipper", "callsign": "ZMT98", "boat_type": "Sloop", "make": "Beneteau", "model": "Oceanis 38",
             "route_start": "Auckland", "route_dest": "Russell", "weather": {}, "arrive": {}})
logs = [
    {"id": 1, "label": "TEST log A 2024 Mar", "checked": False, "log_date": "2024-03-01"},
    {"id": 2, "label": "TEST log B 2024 Mar", "checked": False, "log_date": "2024-03-02"},
    {"id": 3, "label": "TEST log C 2024 Mar", "checked": False, "log_date": "2024-03-04"},
    {"id": 4, "label": "TEST log D 2024 Nov", "checked": False, "log_date": "2024-11-10"},
    {"id": 1735700000000, "label": "TEST log E 2025 stamp", "checked": False},  # 2025-01-01 via timestamp id
    {"id": 6, "label": "TEST log F 2025 Jun", "checked": False, "log_date": "2025-06-15"},
    {"id": 7, "label": "TEST log G undated", "checked": False},
]
registry = [{"id": "myTodo", "name": "My To Do", "isSystem": True}, {"id": "shipsLog", "name": "Ship's Log", "isSystem": True},
            {"id": "leavingDock", "name": "Leaving Dock", "isSystem": True}]
data = {"myTodo": [], "shipsLog": logs, "leavingDock": [{"id": 1, "label": "Tidy lines", "checked": False}]}
db.user_boats.update_one({"owner_id": UID, "boat_id": "main"}, {"$set": {"owner_id": UID, "boat_id": "main", "boat": boat, "registry": registry, "data": data,
                         "areas": [], "engine_log": [], "updated_at": now.isoformat(), "synced_at": now.isoformat()}}, upsert=True)
print("seeded", UID, TOK)
