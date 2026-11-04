# Iteration 85 Excel export setup/teardown: TEST_xl85 Pro boat with budget costs/dates, maint attrs (units, photo, PDF, own/inherited due),
# inventory folders + zone map, service logs, crew member (free user) + pending/declined invites, tricky list names. Usage: python xl85_setup.py setup|teardown
import os, sys, json, requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
DB = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
BOAT, PRO_ID, FREE_ID = "TEST_xl85", "test-user-pro", "test-user-free"
T0 = "2026-01-01T00:00:00Z"
FAR = "2099-01-01T00:00:00+00:00"


def s(tok="test_session_pro_1"):
    ss = requests.Session(); ss.cookies.set("session_token", tok); return ss


def setup():
    teardown()
    for uid, f in ((PRO_ID, "/tmp/xl85_prev_pro.json"), (FREE_ID, "/tmp/xl85_prev_free.json")):
        prev = DB.users.find_one({"user_id": uid}, {"_id": 0, "last_boat": 1}) or {}
        json.dump({"last_boat": prev.get("last_boat")}, open(f, "w"))
    areas = [
        {"id": "x_nav", "name": "TEST_Nav cupboard", "items": [{"id": "xi1", "name": "Binoculars", "qty": 1}]},
        {"id": "x_red", "name": "TEST_Red folder", "parent_id": "x_nav", "items": [{"id": "xi2", "name": "Paper charts", "qty": 3, "removed": True}]},
        {"id": "x_galley", "name": "TEST_Galley", "food": True, "items": [{"id": "xi3", "name": "Rice", "qty": 2}]},
        {"id": "x_empty", "name": "TEST_Empty locker", "items": []},
    ]
    reg = [
        {"id": "shipsLog", "name": "Ship's Log", "isSystem": True},
        {"id": "custom_xl_chk", "name": "TEST_Deck Checks", "isSystem": False},
        {"id": "boatBudget", "name": "Boat Budget", "isSystem": False, "kind": "budget"},
        {"id": "maint_sailLoft_xl", "name": "Sail Loft", "isSystem": False, "kind": "maint", "maint": "sailLoft", "category": "Boat Maintenance"},
        {"id": "custom_xl_long", "name": "TEST_A very long list name that exceeds thirty one chars", "isSystem": False},
        {"id": "custom_xl_long2", "name": "TEST_A very long list name that exceeds the limit too", "isSystem": False},
        {"id": "custom_xl_ill", "name": "TEST_Fuel/Water: [tanks]?*", "isSystem": False},
        {"id": "custom_xl_dup", "name": "Boat details", "isSystem": False},
        {"id": "custom_xl_empty", "name": "TEST_Empty", "isSystem": False},
    ]
    data = {
        "shipsLog": [],
        "custom_xl_chk": [
            {"id": 1, "label": "1. Foredeck", "checked": False},
            {"id": 2, "label": "Anchor locker", "checked": True, "indent": True, "area": "x_nav"},
            {"id": 3, "label": "Windlass", "checked": False, "flagged": True, "indent": True},
            {"id": 4, "label": "Loose item", "checked": False},
        ],
        "boatBudget": [
            {"id": 11, "label": "Insurance", "product": "Hull policy", "url": "https://example.com/ins", "paid": "2026-03-15", "cost": "1,234.50", "budget": True, "checked": False},
            {"id": 12, "label": "Fuel", "product": "", "url": "", "paid": "", "cost": "", "budget": True, "checked": False},
            {"id": 13, "label": "Antifouling", "product": "Paint", "url": "", "paid": "2026-02-01", "cost": "250", "budget": True, "checked": False},
        ],
        "maint_sailLoft_xl": [
            {"id": 21, "label": "Mainsails", "maint": True, "checked": False, "attrs": {"next_service_date": "2026-12-01", "last_service_date": "2025-12-01"}},
            {"id": 22, "label": "Mainsail", "maint": True, "indent": True, "checked": False, "attrs": {
                "sail_type": "Main sail", "sail_material": "Dacron", "sail_area": "35.5", "sail_area__unit": "sqm", "age": "5",
                "weight": "12.5", "weight__unit": "kg", "image": "photo_ref_1", "pdf_manual": "file_ref_1", "pdf_manual__name": "main-manual.pdf",
                "brand": "North Sails", "last_service_date": "2026-01-10"}},
            {"id": 23, "label": "Trysail", "maint": True, "indent": True, "checked": False, "attrs": {"next_service_date": "2027-01-15"}},
            {"id": 24, "label": "Headsails", "maint": True, "checked": False, "attrs": {}},
            {"id": 25, "label": "Genoa", "maint": True, "indent": True, "checked": False, "attrs": {}},
        ],
        "custom_xl_long": [{"id": 31, "label": "L1", "checked": False}],
        "custom_xl_long2": [{"id": 32, "label": "L2", "checked": False}],
        "custom_xl_ill": [{"id": 33, "label": "Diesel", "checked": False}],
        "custom_xl_dup": [{"id": 34, "label": "Dup list item", "checked": False}],
        "custom_xl_empty": [],
    }
    state = {"boat": {"vessel": "TEST_XL85", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com", "currency": "NZD"},
             "registry": reg, "data": data, "areas": areas,
             "engine_log": [{"id": "e2", "date": "2026-05-02", "hours": "1,250.5", "notes": "Oil change"}, {"id": "e1", "date": "2026-01-10", "hours": "1200", "notes": "Impeller"}],
             "electrical_log": [{"id": "el1", "date": "2026-04-01", "electrician": "Sparky Ltd", "notes": "Batteries"}],
             "updated_at": T0, "list_ts": {k: T0 for k in data}, "sec_ts": {"boat": T0, "registry": T0, "areas": T0, "engine_log": T0, "electrical_log": T0}}
    r = s().put(f"{BASE}/api/me/boat", params={"boat_id": BOAT}, json=state); print("put boat", r.status_code, r.text[:200])
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$set": {
        "zone_maps": [{"id": "zm1", "name": "TEST_Deck plan", "colour": "Blue", "updated_at": T0, "pins": [{"id": "p1", "label": "Nav", "area_id": "x_nav", "x": 0.2, "y": 0.3}]}, {"id": "zm2", "colour": "Red", "updated_at": T0, "pins": []}],
        "crew": [FREE_ID], "crew_roles": {FREE_ID: ["Navigator", "Cook"]}, "rsvp": {FREE_ID: {"status": "yes"}},
        "agreements": {FREE_ID: {"accepted_at": "2026-02-20T10:00:00+00:00"}}, "crew_names": {FREE_ID: "TEST_Free Crew"}}})
    DB.crew_invites.insert_many([
        {"invite_id": "xl85_inv1", "owner_id": PRO_ID, "boat_id": BOAT, "name": "TEST_Pending", "email": "pend@example.com", "roles": ["Deckhand"], "created_at": T0, "expires_at": FAR, "token_hash": "xl85hash1"},
        {"invite_id": "xl85_inv2", "owner_id": PRO_ID, "boat_id": BOAT, "name": "TEST_Declined", "email": "dec@example.com", "roles": [], "created_at": T0, "expires_at": FAR, "declined_at": "2026-03-01T00:00:00+00:00", "token_hash": "xl85hash2"},
    ])
    print("last-boat", s().put(f"{BASE}/api/me/last-boat", json={"key": BOAT}).status_code)


def teardown():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.crew_invites.delete_many({"invite_id": {"$in": ["xl85_inv1", "xl85_inv2"]}})
    for uid, f in ((PRO_ID, "/tmp/xl85_prev_pro.json"), (FREE_ID, "/tmp/xl85_prev_free.json")):
        if os.path.exists(f):
            prev = json.load(open(f)).get("last_boat")
            DB.users.update_one({"user_id": uid}, {"$set": {"last_boat": prev or "main"}})


if __name__ == "__main__":
    setup() if sys.argv[1] == "setup" else teardown()
