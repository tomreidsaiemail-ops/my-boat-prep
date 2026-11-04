# Iteration 82: zone map colours (sequence, presets by name, manual override, no duplicates) and sub-areas in the inventory PDF
import io
import os
import pytest
import requests
from PIL import Image
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
PRO, PRO_ID, BOAT = "test_session_pro_1", "test-user-pro", "TEST_colours"


def s():
    x = requests.Session()
    x.headers["Authorization"] = f"Bearer {PRO}"
    return x


def png():
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), (20, 80, 160)).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def maps():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    DB.user_boats.insert_one({"owner_id": PRO_ID, "boat_id": BOAT, "crew": [], "boat": {"vessel": "TEST_Colours"}, "registry": [], "data": {}, "areas": []})
    out = None
    for _ in range(3):
        r = s().post(f"{BASE_URL}/api/boats/{BOAT}/zone-maps", files={"file": ("m.png", png(), "image/png")})
        assert r.status_code == 200, r.text
        out = r.json()["zone_maps"]
    yield out
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


def meta(map_id, **body):
    return s().put(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{map_id}/meta", json=body)


def test_new_maps_take_the_sequence(maps):
    assert [m["colour"] for m in maps] == ["Gold", "Blue", "Green"]


def test_preset_by_name_contains_word(maps):
    r = meta(maps[1]["id"], name="Cockpit and helm")
    # Gold is taken by map 1, so the preset can't be used and the map keeps its colour
    assert r.status_code == 200 and r.json()["zone_maps"][1]["colour"] == "Blue"
    r = meta(maps[0]["id"], colour="Red")
    assert r.status_code == 200 and r.json()["zone_maps"][0]["colour"] == "Red"
    r = meta(maps[2]["id"], name="Galley area")
    assert r.json()["zone_maps"][2]["colour"] == "Orange" and r.json()["zone_maps"][2]["name"] == "Galley area"


def test_duplicate_colour_rejected(maps):
    r = meta(maps[1]["id"], colour="Orange")
    assert r.status_code == 400 and "already used" in r.json()["detail"]
    assert meta(maps[1]["id"], colour="Pinkish").status_code == 400


def test_manual_colour_not_overridden_by_name(maps):
    assert meta(maps[1]["id"], colour="Teal").status_code == 200
    r = meta(maps[1]["id"], name="Saloon")
    assert r.json()["zone_maps"][1]["colour"] == "Teal"


def test_boat_state_returns_colours(maps):
    import sys
    os.environ.update({k: v for k, v in ENV.items() if v})
    sys.path.insert(0, "/app/backend")
    from inventory import boat_maps
    got = {m["id"]: (m["colour"], m["name"]) for m in boat_maps(DB.user_boats.find_one({"owner_id": PRO_ID, "boat_id": BOAT}))}
    assert got[maps[2]["id"]] == ("Orange", "Galley area")


def test_preset_list_seeded():
    doc = DB.list_templates.find_one({"name": "Admin - Zone Map Predetermined Colours"})
    assert doc and doc.get("private") and any("Cockpit" in i["label"] for i in doc["items"])


def test_inventory_pdf_puts_sub_areas_after_parent():
    import sys
    os.environ.update({k: v for k, v in ENV.items() if v})
    sys.path.insert(0, "/app/backend")
    from inventory import inventory_list_for_pdf
    areas = [{"id": "a", "name": "Nav desk cupboard", "items": [{"name": "Pencils", "qty": 2}]}, {"id": "b", "name": "Galley", "items": [{"name": "Pan", "qty": 1}]},
             {"id": "c", "name": "Red folder", "parent_id": "a", "items": [{"name": "Charts", "qty": 3}]}]
    labels = [i["label"] for i in inventory_list_for_pdf(areas)["items"]]
    assert labels == ["Nav desk cupboard: Pencils x2", "Nav desk cupboard › Red folder: Charts x3", "Galley: Pan x1"]
