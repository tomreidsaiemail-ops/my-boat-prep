# Manual seed/cleanup for iteration 96 UI tests: TEST pro users with a Beneteau Oceanis 38 boat (A: no maint lists, B: the 5 old maint lists)
import sys, copy
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
USERS = {"TEST_it96_a": "test_session_it96_a", "TEST_it96_b": "test_session_it96_b"}
OLD = [("deckHardware", "Deck Hardware"), ("sailLoft", "Sail Loft"), ("runningRigging", "Running Rigging"), ("standingRigging", "Standing Rigging"), ("groundTackle", "Ground Tackle")]

if sys.argv[1:] == ["clean"]:
    for uid, tok in USERS.items():
        print(uid, db.users.delete_one({"user_id": uid}).deleted_count, db.user_sessions.delete_many({"user_id": uid}).deleted_count,
              db.user_boats.delete_many({"owner_id": uid}).deleted_count, db.ai_drafts.delete_many({"user_id": uid}).deleted_count)
    sys.exit()

src = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
now = datetime.now(timezone.utc)
for uid, tok in USERS.items():
    db.users.update_one({"user_id": uid}, {"$set": {"user_id": uid, "email": f"{uid.lower()}@example.com", "name": uid, "picture": "", "role": "pro",
                        "created_at": now.isoformat(), "tos_accepted_at": now.isoformat(), "tos_version": "2026-06", "last_boat": "main"}}, upsert=True)
    db.user_sessions.update_one({"session_token": tok}, {"$set": {"session_token": tok, "user_id": uid, "created_at": now, "expires_at": now + timedelta(days=2)}}, upsert=True)
    boat = copy.deepcopy(src["boat"])
    boat.update({"vessel": f"TEST {uid}", "skipper": "TEST Skipper", "callsign": "ZMT96", "boat_type": "Sloop", "make": "Beneteau", "model": "Oceanis 38",
                 "budget_currency": "NZD", "weather": {}, "budget_notes": ""})
    registry = [{"id": "myTodo", "name": "My To Do", "isSystem": True}]
    data = {"myTodo": []}
    if uid.endswith("_b"):
        for i, (k, n) in enumerate(OLD):
            lid = f"maint_{k}_179000000000{i}"
            registry.append({"id": lid, "name": n, "isSystem": False, "kind": "maint", "maint": k, "category": "Boat Maintenance"})
            data[lid] = [{"id": 1, "label": "Starter", "checked": False, "maint": True, "attrs": {}}]
    db.user_boats.update_one({"owner_id": uid, "boat_id": "main"}, {"$set": {"owner_id": uid, "boat_id": "main", "boat": boat, "registry": registry, "data": data,
                             "updated_at": now.isoformat(), "synced_at": now.isoformat()}}, upsert=True)
    print("seeded", uid, tok)
