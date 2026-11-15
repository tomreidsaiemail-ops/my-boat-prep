# Crew photos (crew_photo.py), crew/register photo_v, request_html photo ask, area photos prune with areas[].photos, Magic Scan extra files
import io
import os
import sys
import pytest
import requests
from datetime import datetime, timedelta, timezone
from PIL import Image
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
BETA = {"Cookie": "session_token=test_session_beta_1"}
ADMIN = {"Cookie": "session_token=test_session_admin_1"}
FREE_ENTRY = "8d45f646-e0ce-4d7f-9fa8-fca60ff6a26e"


def _env(k):
    for line in open("/app/backend/.env"):
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip().strip('"')


mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


def png(colour=(200, 30, 30), size=(64, 64)):
    b = io.BytesIO()
    Image.new("RGB", size, colour).save(b, "PNG")
    return b.getvalue()


@pytest.fixture(scope="module", autouse=True)
def restore():
    users = {u["user_id"]: u.get("photo") for u in mdb.users.find({"user_id": {"$in": ["test-user-free", "test-user-pro"]}}, {"user_id": 1, "photo": 1})}
    boat = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"areas": 1, "area_photos": 1})
    entry = mdb.crew_register.find_one({"entry_id": FREE_ENTRY}, {"user_id": 1})
    yield
    for uid, p in users.items():
        mdb.users.update_one({"user_id": uid}, {"$set": {"photo": p}} if p else {"$unset": {"photo": ""}})
    mdb.user_boats.update_one({"_id": boat["_id"]}, {"$set": {"areas": boat.get("areas") or [], "area_photos": boat.get("area_photos") or []}})
    if entry and "user_id" not in entry:
        mdb.crew_register.update_one({"entry_id": FREE_ENTRY}, {"$unset": {"user_id": ""}})


class TestCrewPhoto:
    def test_upload_and_access(self):
        r = requests.post(f"{API}/crew-photo", files={"file": ("me.png", png(), "image/png")}, headers=FREE, timeout=60)
        assert r.status_code == 200, r.text
        v = r.json()["photo_v"]
        assert isinstance(v, str) and v
        doc = mdb.users.find_one({"user_id": "test-user-free"}, {"photo": 1})
        assert doc["photo"]["v"] == v and doc["photo"]["path"]
        for who, h in [("self", FREE), ("skipper", PRO), ("co-crew", BETA)]:
            g = requests.get(f"{API}/crew-photo/test-user-free", headers=h, timeout=30)
            assert g.status_code == 200, f"{who}: {g.status_code} {g.text[:200]}"
            assert g.headers["content-type"].startswith("image/png")
            assert g.content[:4] == b"\x89PNG"

    def test_unrelated_404(self):
        g = requests.get(f"{API}/crew-photo/test-user-free", headers=ADMIN, timeout=30)
        assert g.status_code == 404

    def test_bad_type_400(self):
        r = requests.post(f"{API}/crew-photo", files={"file": ("x.txt", b"hello", "text/plain")}, headers=FREE, timeout=30)
        assert r.status_code == 400

    def test_unauth_401(self):
        assert requests.get(f"{API}/crew-photo/test-user-free", timeout=30).status_code == 401

    def test_crew_list_photo_v(self):
        requests.post(f"{API}/crew-photo", files={"file": ("me.png", png(), "image/png")}, headers=FREE, timeout=60)
        r = requests.get(f"{API}/boats/main/crew", headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        crew = r.json()["crew"]
        m = next(c for c in crew if c.get("user_id") == "test-user-free")
        assert m.get("photo_v")
        b = next((c for c in crew if c.get("user_id") == "test-user-beta"), None)
        if b:
            assert "photo_v" in b

    def test_register_photo_v(self):
        mdb.crew_register.update_one({"entry_id": FREE_ENTRY}, {"$set": {"user_id": "test-user-free"}})
        r = requests.get(f"{API}/crew-register", headers=PRO, timeout=30)
        assert r.status_code == 200
        rows = r.json()["crew"]
        row = next(x for x in rows if x["entry_id"] == FREE_ENTRY)
        assert row.get("photo_v")
        other = [x for x in rows if x["entry_id"] != FREE_ENTRY]
        assert all("photo_v" in x for x in other)

    def test_delete_photo(self):
        r = requests.delete(f"{API}/crew-photo", headers=FREE, timeout=30)
        assert r.status_code == 200 and r.json()["ok"] is True
        assert "photo" not in mdb.users.find_one({"user_id": "test-user-free"}, {"photo": 1})
        assert requests.get(f"{API}/crew-photo/test-user-free", headers=FREE, timeout=30).status_code == 404
        r = requests.get(f"{API}/boats/main/crew", headers=PRO, timeout=30)
        m = next(c for c in r.json()["crew"] if c.get("user_id") == "test-user-free")
        assert m.get("photo_v") is None

    def test_request_html_photo_ask(self):
        from crew_register import request_html
        assert "Please add a photo of yourself" in request_html("Skip", "Ann", "a@b.c", "https://x")
        assert "Please add a photo of yourself" in request_html("Skip", "Ann", "a@b.c", "https://x", quick=True)


class TestAreaPhotosPrune:
    def test_photos_array_kept(self):
        ids = []
        for c in [(1, 2, 3), (4, 5, 6), (7, 8, 9)]:
            r = requests.post(f"{API}/boats/main/area-photos", files={"file": ("c.png", png(c), "image/png")}, headers=PRO, timeout=60)
            assert r.status_code == 200, r.text
            ids.append(r.json()["photo"]["id"])
        boat = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"areas": 1, "area_photos": 1})
        areas = boat["areas"] + [{"id": "TEST_area_multi", "name": "TEST_Multi", "items": [], "photo": {"id": ids[0], "v": "1"},
                                  "photos": [{"id": i, "v": "1"} for i in ids[:2]]}]
        old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        aps = [{**p, "created_at": old} if p["id"] in ids else p for p in boat["area_photos"]]
        mdb.user_boats.update_one({"_id": boat["_id"]}, {"$set": {"areas": areas, "area_photos": aps}})
        r = requests.post(f"{API}/boats/main/area-photos", files={"file": ("c.png", png(), "image/png")}, headers=PRO, timeout=60)
        assert r.status_code == 200
        kept = {p["id"] for p in mdb.user_boats.find_one({"_id": boat["_id"]}, {"area_photos": 1})["area_photos"]}
        assert ids[0] in kept and ids[1] in kept, "photos[] ids must be kept"
        assert ids[2] not in kept, "unused old photo should be pruned"
        g = requests.get(f"{API}/boats/main/area-photos/{ids[1]}", headers=PRO, timeout=30)
        assert g.status_code == 200
        g = requests.get(f"{API}/boats/main/area-photos/{ids[1]}?owner=test-user-pro", headers=FREE, timeout=30)
        assert g.status_code == 200


class TestScanExtra:
    def test_bad_extra_type_400(self):
        files = [("file", ("a.png", png(), "image/png")), ("extra", ("b.txt", b"nope", "text/plain"))]
        r = requests.post(f"{API}/boats/main/scan", files=files, headers=PRO, timeout=60)
        assert r.status_code == 400, r.text

    def test_scan_with_extras_ai(self):
        # one real AI call: main photo + 2 extras
        files = [("file", ("a.png", png((240, 240, 240), (256, 256)), "image/png")),
                 ("extra", ("b.png", png((10, 120, 200), (256, 256)), "image/png")),
                 ("extra", ("c.png", png((30, 200, 90), (256, 256)), "image/png"))]
        r = requests.post(f"{API}/boats/main/scan", files=files, headers=PRO, timeout=120)
        assert r.status_code != 422, r.text
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["items"], list) and "scans_left" in d
