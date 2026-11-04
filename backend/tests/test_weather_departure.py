# Iteration 83: folder/box contents cards PDF, weather & routing photos (Navigator) and the Departure decision in the Ship's Log PDF
import io
import os
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
PRO, PRO_ID, BOAT = "test_session_pro_1", "test-user-pro", "TEST_wx83"


def s():
    x = requests.Session()
    x.headers["Authorization"] = f"Bearer {PRO}"
    return x


def png(colour=(30, 99, 214)):
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (400, 260), colour).save(b, "PNG")
    return b.getvalue()


@pytest.fixture(scope="module", autouse=True)
def boat():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.user_boats.insert_one({"owner_id": PRO_ID, "boat_id": BOAT, "crew": [], "boat": {"vessel": "TEST Wx"}, "registry": [], "data": {"shipsLog": []}, "areas": []})
    yield
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.item_photos.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


def card(name, n, long=False):
    return {"name": name, "parent": "Nav desk cupboard", "zone": "Saloon", "items": [{"name": ("Very long spare part name " * 6 if long else f"Item {k}"), "qty": k + 1} for k in range(n)]}


def test_folder_cards_pdf_handles_many_and_long_items():
    r = s().post(f"{BASE_URL}/api/inventory/folder-cards.pdf", json={"vessel": "TEST", "cards": [card("Red folder", 400, True), card("Blue box", 0), card("Box 3", 30), card("Box 4", 5), card("Box 5", 2)]})
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_folder_cards_needs_a_card():
    assert s().post(f"{BASE_URL}/api/inventory/folder-cards.pdf", json={"vessel": "x", "cards": []}).status_code == 422


def test_weather_photo_upload_and_ship_log_pdf_has_it():
    r = s().post(f"{BASE_URL}/api/boats/{BOAT}/item-photo", params={"list_id": "weatherRouting"}, files={"file": ("w.png", png(), "image/png")})
    assert r.status_code == 200, r.text
    pid = r.json()["photo_id"]
    log = {"log_id": "0e8c3a52-6c1f-4a5b-9d8e-7b1f2c3d4e5f", "owner_id": PRO_ID, "vessel": "TEST Wx", "skipper": "S", "callsign": "", "local_date": "today", "pob": 1,
           "lists": [{"name": "Ship's Log", "items": [{"label": "Departure decision - Mana to Picton", "checked": False, "flagged": False,
                                                       "answer": "Why we're going: window", "photos": [{"photo_id": pid, "note": "PredictWind route"}]}]}]}
    DB.ship_logs.delete_many({"log_id": log["log_id"]})
    DB.ship_logs.insert_one(log)
    try:
        with_photo = requests.get(f"{BASE_URL}/api/ship-logs/{log['log_id']}.pdf")
        assert with_photo.status_code == 200 and with_photo.content[:4] == b"%PDF"
        DB.ship_logs.update_one({"log_id": log["log_id"]}, {"$set": {"lists.0.items.0.photos": []}})
        without = requests.get(f"{BASE_URL}/api/ship-logs/{log['log_id']}.pdf")
        assert len(with_photo.content) > len(without.content) + 500
    finally:
        DB.ship_logs.delete_many({"log_id": log["log_id"]})


def test_render_items_carries_detail_and_photos():
    import sys
    sys.path.insert(0, "/app/backend")
    from ship_log import render_items
    ctx = {"vessel": "V", "callsign": "", "position": "", "local_date": "", "pob": 1, "boat_type": "", "children": 0, "mmsi": "", "pets": []}
    out = render_items([{"label": "Departure decision", "detail": "Why: window", "weather_photos": [{"photo_id": "a" * 32, "note": "n"}]}], ctx)
    assert out[0]["answer"] == "Why: window" and out[0]["photos"] == [{"photo_id": "a" * 32, "note": "n"}]
