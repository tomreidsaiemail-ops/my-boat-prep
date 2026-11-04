# Manual seed/cleanup for iteration 97 racing-weight UI tests: TEST pro users M (metric, levels) and F (feet/gal, petrol, no levels)
import sys, copy
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
USERS = {"TEST_it97_m": "test_session_it97_m", "TEST_it97_f": "test_session_it97_f"}

if sys.argv[1:] == ["clean"]:
    for uid in USERS:
        print(uid, db.users.delete_one({"user_id": uid}).deleted_count, db.user_sessions.delete_many({"user_id": uid}).deleted_count,
              db.user_boats.delete_many({"owner_id": uid}).deleted_count)
    sys.exit()

src = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
now = datetime.now(timezone.utc)


def item(i, label, w=None, unit=None, cat=False):
    attrs = {}
    if w is not None:
        attrs["weight"] = str(w)
        if unit:
            attrs["weight__unit"] = unit
    d = {"id": i, "label": label, "checked": False, "maint": True, "attrs": attrs}
    if not cat:
        d["indent"] = 1
    return d


def mlist(k, n, i):
    return {"id": f"maint_{k}_17900000000{i}", "name": n, "isSystem": False, "kind": "maint", "maint": k, "category": "Boat Maintenance"}


for uid, tok in USERS.items():
    metric = uid.endswith("_m")
    db.users.update_one({"user_id": uid}, {"$set": {"user_id": uid, "email": f"{uid.lower()}@example.com", "name": uid, "picture": "", "role": "pro",
                        "created_at": now.isoformat(), "tos_accepted_at": now.isoformat(), "tos_version": "2026-06", "last_boat": "main"}}, upsert=True)
    db.user_sessions.update_one({"session_token": tok}, {"$set": {"session_token": tok, "user_id": uid, "created_at": now, "expires_at": now + timedelta(days=2)}}, upsert=True)
    boat = copy.deepcopy(src["boat"])
    boat.update({"vessel": f"TEST {uid}", "skipper": "TEST Skipper", "callsign": "ZMT97", "boat_type": "Sloop", "make": "Beneteau", "model": "Oceanis 38",
                 "budget_currency": "NZD", "weather": {}, "budget_notes": "", "arrive": {}})
    registry = [{"id": "myTodo", "name": "My To Do", "isSystem": True}, {"id": "leavingDock", "name": "Leaving Dock", "isSystem": True}]
    data = {"myTodo": [], "leavingDock": [{"id": 1, "label": "Tidy lines", "checked": False}]}
    if metric:
        # fuel (0.5*100+20)*0.84=58.8, water 0.75*200=150, gas full (2+1)*4.5=13.5 + bottles 13.5 = 27 -> fluids 235.8
        boat.update({"units": "m", "tank_units": "L", "fuel_tank": "100", "fuel_jerry": "1", "fuel_jerry_size": "20", "water_tank": "200", "water_jerry": "",
                     "water_jerry_size": "", "gas_bottles": "2", "gas_kg": "4.5", "gas_extra": "1", "pob": 4, "children": 0, "boat_weight": "5000", "crew_weight": "80",
                     "depart": {"levels": {"fuel": "half", "water": "3q"}}})
        lists = {"deckHardware": [item(1, "Winches", 10, "kg"), item(2, "Shackles", 500, "g"), item(3, "Blocks", 2, "lb"), item(4, "Pins", 16, "oz")],
                 "sailLoft": [item(1, "Mainsail", 25)], "standingRigging": [item(1, "Shrouds")], "groundTackle": [item(1, "Anchor", 30, "kg")],
                 "sparsHardware": [item(1, "Mast", 145, "kg")]}
        areas = [{"id": "a_fridge", "name": "Fridge", "food": True, "items": [{"id": "i1", "name": "Milk", "qty": 2, "unit_g": 1000},
                  {"id": "i2", "name": "Bread", "qty": 1, "unit_g": 500, "removed": True}, {"id": "i3", "name": "Water bottles", "qty": 6, "unit_g": 1500},
                  {"id": "i4", "name": "Apples", "qty": 3}]}]
        engine_log = []
    else:
        # 20 gal fuel *3.785*0.74 petrol, water 10 gal *3.785, no levels -> full; crew default 187 lb x 2
        boat.update({"units": "ft", "tank_units": "gal", "fuel_tank": "20", "fuel_jerry": "", "water_tank": "10", "water_jerry": "", "gas_bottles": "", "gas_kg": "",
                     "gas_extra": "", "pob": 2, "children": 0, "boat_weight": "10000", "crew_weight": "", "depart": {}})
        lists = {"deckHardware": [item(1, "Winches", 10), item(2, "Cleat", 1, "kg")]}
        areas = []
        engine_log = [{"id": 1, "date": "2026-01-02", "engine_type": "Diesel inboard", "hours": "10"},
                      {"id": 2, "date": "2026-01-10", "engine_type": "Outboard petrol", "hours": "12"}]
    for i, (k, items) in enumerate(lists.items()):
        m = mlist(k, {"deckHardware": "Deck Hardware", "sailLoft": "Sail Loft", "standingRigging": "Standing Rigging", "groundTackle": "Ground Tackle",
                      "sparsHardware": "Spars & Heavy Hardware"}[k], i)
        registry.append(m)
        data[m["id"]] = [item(100, "TEST Category", cat=True)] + items
    if metric:
        c = {"id": "maint_custom_179000000099", "name": "TEST Custom weights", "isSystem": False, "kind": "maint", "maint": "custom", "category": "Boat Maintenance",
             "attrs": [{"key": "weight", "name": "Weight", "type": "decimal weight"}], "columns": ["weight"]}
        registry.append(c)
        data[c["id"]] = [item(1, "Heavy thing", 999, "kg")]
    db.user_boats.update_one({"owner_id": uid, "boat_id": "main"}, {"$set": {"owner_id": uid, "boat_id": "main", "boat": boat, "registry": registry, "data": data,
                             "areas": areas, "engine_log": engine_log, "updated_at": now.isoformat(), "synced_at": now.isoformat()}}, upsert=True)
    print("seeded", uid, tok)
