# Manual seed/cleanup for iteration 103 UI tests: TEST pro user with 6 maint lists + custom maint list + TEST outline checklist (10.2.1 move bug)
import sys, copy
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
UID, TOK = "TEST_it103", "test_session_it103"

if sys.argv[1:] == ["clean"]:
    print(db.users.delete_one({"user_id": UID}).deleted_count, db.user_sessions.delete_many({"user_id": UID}).deleted_count,
          db.user_boats.delete_many({"owner_id": UID}).deleted_count)
    sys.exit()

src = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
now = datetime.now(timezone.utc)
db.users.update_one({"user_id": UID}, {"$set": {"user_id": UID, "email": "test_it103@example.com", "name": UID, "picture": "", "role": "pro",
                    "created_at": now.isoformat(), "tos_accepted_at": now.isoformat(), "tos_version": "2026-06", "last_boat": "main"}}, upsert=True)
db.user_sessions.update_one({"session_token": TOK}, {"$set": {"session_token": TOK, "user_id": UID, "created_at": now, "expires_at": now + timedelta(days=2)}}, upsert=True)
boat = copy.deepcopy(src["boat"])
boat.update({"vessel": "TEST it103", "skipper": "TEST Skipper", "callsign": "ZMT103", "boat_type": "Sloop", "make": "Beneteau", "model": "Oceanis 38",
             "budget_currency": "NZD", "weather": {}, "budget_notes": "", "arrive": {}})
registry = [{"id": "myTodo", "name": "My To Do List", "isSystem": True}, {"id": "shipsLog", "name": "Ship's Log", "isSystem": True},
            {"id": "riggingChecks", "name": "Rigging Checks", "isSystem": True, "description": ""},
            {"id": "custom_1790000000001", "name": "TEST_Outline", "isSystem": False}]
data = {"myTodo": [], "shipsLog": [], "riggingChecks": [{"id": 200, "label": "Shrouds ok", "checked": False}]}


def it(i, label, depth=0):
    d = {"id": i, "label": label, "checked": False}
    if depth:
        d["indent"] = True
    if depth > 1:
        d["level"] = depth
    return d


# 1..10 top-level; 4 > 4.1 > 4.1.1 ; 5 > 5.1 ; 10 > 10.1, 10.2 > 10.2.1
outline = [it(1, "One"), it(2, "Two"), it(3, "Three"), it(4, "Four"), it(41, "Four.A", 1), it(411, "Four.A.i", 2), it(5, "Five"), it(51, "Five.A", 1),
           it(6, "Six"), it(7, "Seven"), it(8, "Eight"), it(9, "Nine"), it(10, "Ten"), it(101, "Ten.A", 1), it(102, "Ten.B", 1), it(1021, "Ten.B.i", 2)]
data["custom_1790000000001"] = outline
KEYS = [("deckHardware", "Deck Hardware"), ("sailLoft", "Sail Loft"), ("runningRigging", "Running Rigging"), ("standingRigging", "Standing Rigging"),
        ("groundTackle", "Ground Tackle"), ("sparsHardware", "Spars & Heavy Hardware")]
for n, (k, name) in enumerate(KEYS):
    lid = f"maint_{k}_17900000001{n}"
    registry.append({"id": lid, "name": name, "isSystem": False, "kind": "maint", "maint": k, "category": "Boat Maintenance"})
    b = (n + 1) * 100
    data[lid] = [{"id": b, "label": "Cat A", "checked": False, "maint": True, "attrs": {}},
                 {"id": b + 1, "label": f"{name} item 1", "checked": False, "maint": True, "attrs": {}, "indent": True},
                 {"id": b + 2, "label": f"{name} item 2", "checked": False, "maint": True, "attrs": {}, "indent": True},
                 {"id": b + 3, "label": "Cat B", "checked": False, "maint": True, "attrs": {}},
                 {"id": b + 4, "label": f"{name} item 3", "checked": False, "maint": True, "attrs": {}, "indent": True}]
registry.append({"id": "maint_custom_179000000020", "name": "TEST Custom Maint", "isSystem": False, "kind": "maint", "maint": "custom",
                 "attrs": [{"key": "brand", "name": "Brand", "type": "char", "max": 1000}], "columns": ["brand"]})
data["maint_custom_179000000020"] = [{"id": 900, "label": "Cat", "checked": False, "maint": True, "attrs": {}},
                                     {"id": 901, "label": "Widget", "checked": False, "maint": True, "attrs": {}, "indent": True}]
db.user_boats.update_one({"owner_id": UID, "boat_id": "main"}, {"$set": {"owner_id": UID, "boat_id": "main", "boat": boat, "registry": registry, "data": data,
                         "rigging_log": [], "updated_at": now.isoformat(), "synced_at": now.isoformat()}}, upsert=True)
print("seeded", UID, TOK)
