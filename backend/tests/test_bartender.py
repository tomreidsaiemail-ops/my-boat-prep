# Magic Bartender: POST /api/ai/bartender (cocktails, photos, youtube) and bartender scan (POST /api/boats/{id}/scan?bartender=true)
import os
import io
import asyncio
import time
import pytest
import requests
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
BETA = {"Authorization": "Bearer test_session_beta_1"}
BOAT = "main"


def run(fn):
    async def wrap():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        return await fn(db)
    return asyncio.run(wrap())


def bottle_jpeg():
    src = "/tmp/vodka.png"
    if not os.path.exists(src):
        r = requests.get("https://www.thecocktaildb.com/images/ingredients/Vodka.png", timeout=20)
        open(src, "wb").write(r.content)
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGB", im.size, "white")
    bg.paste(im, mask=im.split()[3])
    buf = io.BytesIO()
    bg.save(buf, "JPEG", quality=85)
    return buf.getvalue()


# --- /api/ai/bartender validation + auth ---
def test_bartender_requires_auth():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ["Vodka"]})
    assert r.status_code == 401


def test_bartender_empty_ingredients_422():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": []}, headers=PRO)
    assert r.status_code == 422


def test_bartender_too_many_ingredients_422():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": [f"x{i}" for i in range(301)]}, headers=PRO)
    assert r.status_code == 422


@pytest.fixture
def first200_off():
    doc = run(lambda db: db.app_settings.find_one({"key": "first200"}, {"_id": 0, "running": 1}))
    was = bool(doc and doc.get("running"))
    if was:
        run(lambda db: db.app_settings.update_one({"key": "first200"}, {"$set": {"running": False}}))
        time.sleep(11)
    yield
    if was:
        run(lambda db: db.app_settings.update_one({"key": "first200"}, {"$set": {"running": True}}))


def test_bartender_free_forbidden(first200_off):
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ["Vodka"]}, headers=FREE)
    assert r.status_code in (402, 403), r.text


# --- real AI mix ---
def test_bartender_pro_success():
    ing = ["Vodka", "White rum", "Limes", "Fresh mint", "Ginger beer", "Soda water", "Cola", "Lemons", "Tonic water"]
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ing}, headers=PRO, timeout=150)
    assert r.status_code == 200, r.text
    d = r.json()
    cs = d["cocktails"]
    assert 1 <= len(cs) <= 12
    names = [c["name"].lower() for c in cs]
    assert len(names) == len(set(names))
    with_photo = 0
    for c in cs:
        assert isinstance(c["name"], str) and c["name"]
        assert isinstance(c["uses"], list) and isinstance(c["missing"], list)
        assert len(c["missing"]) <= 2
        assert c["photo"] == "" or (c["photo"].startswith("https://") and "thecocktaildb" in c["photo"])
        with_photo += bool(c["photo"])
        u = urlparse(c["youtube"])
        assert u.netloc == "www.youtube.com" and u.path == "/results"
        assert c["name"].lower() in parse_qs(u.query)["search_query"][0].lower()
    print("cocktails:", [(c["name"], c["missing"], bool(c["photo"])) for c in cs])
    assert with_photo >= 1, "expected at least one TheCocktailDB photo for common cocktails"
    assert "asks_left" in d


# --- bartender scan ---
def test_scan_bartender_reads_bottle():
    r = requests.post(f"{BASE_URL}/api/boats/{BOAT}/scan", params={"bartender": "true"}, headers=BETA if False else PRO,
                      files={"file": ("bottle.jpg", bottle_jpeg(), "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d["items"], list)
    print("scan items:", d["items"])
    assert any("vodka" in i["name"].lower() for i in d["items"]), d["items"]
    for i in d["items"]:
        assert isinstance(i["qty"], int) and i["qty"] >= 1


def test_scan_bartender_bad_file_400():
    r = requests.post(f"{BASE_URL}/api/boats/{BOAT}/scan", params={"bartender": "true"}, headers=PRO,
                      files={"file": ("x.jpg", b"not an image", "image/jpeg")}, timeout=30)
    assert r.status_code == 400


def test_scan_bartender_unknown_boat_404():
    r = requests.post(f"{BASE_URL}/api/boats/nope-boat-xyz/scan", params={"bartender": "true"}, headers=PRO,
                      files={"file": ("bottle.jpg", bottle_jpeg(), "image/jpeg")}, timeout=30)
    assert r.status_code == 404
