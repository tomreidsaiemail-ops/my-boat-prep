# Iteration 82 UI setup/teardown: temporary TEST_ui82 boat for Pro with inventory areas + 2 zone maps (usage: python ui82_setup.py setup|teardown)
import io, os, sys, json, requests
from pymongo import MongoClient
from dotenv import dotenv_values
from PIL import Image

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
DB = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
BOAT, PRO_ID = "TEST_ui82", "test-user-pro"
T0 = "2026-01-01T00:00:00Z"


def s():
    ss = requests.Session(); ss.cookies.set("session_token", "test_session_pro_1"); return ss


def png(color):
    b = io.BytesIO(); Image.new("RGB", (400, 300), color).save(b, "PNG"); return b.getvalue()


def setup():
    teardown()
    prev = DB.users.find_one({"user_id": PRO_ID}, {"_id": 0, "last_boat": 1}) or {}
    json.dump({"last_boat": prev.get("last_boat")}, open("/tmp/ui82_prev.json", "w"))
    areas = [
        {"id": "a_nav", "name": "Saloon nav desk cupboard", "items": [{"id": "i1", "name": "Binoculars", "qty": 1}]},
        {"id": "a_galley", "name": "Galley drawer", "items": [{"id": "i2", "name": "Can opener", "qty": 1}]},
        {"id": "a_red", "name": "Red folder", "items": [{"id": "i3", "name": "Paper charts", "qty": 3}]},
        {"id": "a_cockpit", "name": "Cockpit locker", "items": [{"id": "i4", "name": "Winch handle", "qty": 2}]},
        {"id": "a_fwd", "name": "Forward cabin shelf", "items": []},
    ]
    state = {"boat": {"vessel": "TEST_UI82", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
             "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
             "data": {"shipsLog": []}, "areas": areas,
             "updated_at": T0, "list_ts": {"shipsLog": T0}, "sec_ts": {"boat": T0, "registry": T0}}
    r = s().put(f"{BASE}/api/me/boat", params={"boat_id": BOAT}, json=state); print("put boat", r.status_code, r.text[:200])
    for c in ["orange", "skyblue"]:
        r = s().post(f"{BASE}/api/boats/{BOAT}/zone-maps", files={"file": ("m.png", png(c), "image/png")}); print("map", r.status_code)
    maps = r.json()["zone_maps"]
    print([(m["id"], m.get("colour"), m.get("name")) for m in maps])
    # Map 1 (Gold): pin Cockpit locker + Galley drawer; Map 2: pin Saloon nav desk
    p1 = [{"id": "p1", "x": 0.2, "y": 0.2, "label": "Cockpit locker", "area_id": "a_cockpit"}, {"id": "p2", "x": 0.5, "y": 0.5, "label": "Galley drawer", "area_id": "a_galley"}]
    print("pins1", s().put(f"{BASE}/api/boats/{BOAT}/zone-maps/{maps[0]['id']}/pins", json={"pins": p1}).status_code)
    p2 = [{"id": "p3", "x": 0.3, "y": 0.3, "label": "Saloon nav desk cupboard", "area_id": "a_nav"}]
    r = s().put(f"{BASE}/api/boats/{BOAT}/zone-maps/{maps[1]['id']}/pins", json={"pins": p2}); print("pins2", r.status_code, r.text[:300])
    s().put(f"{BASE}/api/me/last-boat", json={"key": BOAT})


def teardown():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    try:
        prev = json.load(open("/tmp/ui82_prev.json")).get("last_boat")
    except Exception:
        prev = None
    if prev and prev != BOAT:
        DB.users.update_one({"user_id": PRO_ID}, {"$set": {"last_boat": prev}})
    else:
        DB.users.update_one({"user_id": PRO_ID}, {"$unset": {"last_boat": ""}})


if __name__ == "__main__":
    setup() if sys.argv[1] == "setup" else teardown()
