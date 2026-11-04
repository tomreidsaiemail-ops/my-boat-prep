# Iteration 83 UI setup/teardown: TEST_ui83 boat (Pro) with sub-areas (folders), zone map pins, seeded Leaving Dock Departure heading (usage: python ui83_setup.py setup|teardown)
import io, os, sys, json, requests
from pymongo import MongoClient
from dotenv import dotenv_values
from PIL import Image

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
DB = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
BOAT, PRO_ID = "TEST_ui83", "test-user-pro"
T0 = "2026-01-01T00:00:00Z"


def s():
    ss = requests.Session(); ss.cookies.set("session_token", "test_session_pro_1"); return ss


def png(color):
    b = io.BytesIO(); Image.new("RGB", (400, 300), color).save(b, "PNG"); return b.getvalue()


def setup():
    teardown()
    prev = DB.users.find_one({"user_id": PRO_ID}, {"_id": 0, "last_boat": 1}) or {}
    json.dump({"last_boat": prev.get("last_boat")}, open("/tmp/ui83_prev.json", "w"))
    areas = [
        {"id": "a_nav", "name": "Saloon nav desk cupboard", "items": [{"id": "i1", "name": "Binoculars", "qty": 1}]},
        {"id": "a_red", "name": "Red folder", "parent_id": "a_nav", "items": [{"id": "i3", "name": "Paper charts", "qty": 3}, {"id": "i5", "name": "Tide tables", "qty": 1}]},
        {"id": "a_box", "name": "Spares box", "parent_id": "a_nav", "items": []},
        {"id": "a_cockpit", "name": "Cockpit locker", "items": [{"id": "i4", "name": "Winch handle", "qty": 2}]},
    ]
    ld = [
        {"id": 101, "label": "Tidy lines", "checked": False},
        {"id": 102, "label": "Departure", "checked": False},
        {"id": 103, "label": "Cast off bow line", "checked": False, "indent": True},
        {"id": 104, "label": "Cast off stern line", "checked": False, "indent": True},
        {"id": 105, "label": "Fenders", "checked": False},
    ]
    state = {"boat": {"vessel": "TEST_UI83", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com", "route_start": "Mana", "route_dest": "Picton"},
             "registry": [{"id": "leavingDock", "name": "Leaving Dock", "isSystem": True}, {"id": "routeHazards", "name": "Route Planning", "isSystem": True},
                          {"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
             "data": {"shipsLog": [], "leavingDock": ld, "routeHazards": [{"id": 201, "label": "Check tides", "checked": False}]}, "areas": areas,
             "updated_at": T0, "list_ts": {"shipsLog": T0, "leavingDock": T0, "routeHazards": T0}, "sec_ts": {"boat": T0, "registry": T0}}
    r = s().put(f"{BASE}/api/me/boat", params={"boat_id": BOAT}, json=state); print("put boat", r.status_code, r.text[:200])
    r = s().post(f"{BASE}/api/boats/{BOAT}/zone-maps", files={"file": ("m.png", png("orange"), "image/png")}); print("map", r.status_code)
    maps = r.json()["zone_maps"]
    p1 = [{"id": "p1", "x": 0.2, "y": 0.2, "label": "Saloon nav desk cupboard", "area_id": "a_nav"}, {"id": "p2", "x": 0.5, "y": 0.5, "label": "Cockpit locker", "area_id": "a_cockpit"}]
    print("pins", s().put(f"{BASE}/api/boats/{BOAT}/zone-maps/{maps[0]['id']}/pins", json={"pins": p1}).status_code)
    s().put(f"{BASE}/api/me/last-boat", json={"key": BOAT})


def teardown():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    try:
        prev = json.load(open("/tmp/ui83_prev.json")).get("last_boat")
    except Exception:
        prev = None
    if prev and prev != BOAT:
        DB.users.update_one({"user_id": PRO_ID}, {"$set": {"last_boat": prev}})
    else:
        DB.users.update_one({"user_id": PRO_ID}, {"$unset": {"last_boat": ""}})


if __name__ == "__main__":
    setup() if sys.argv[1] == "setup" else teardown()
