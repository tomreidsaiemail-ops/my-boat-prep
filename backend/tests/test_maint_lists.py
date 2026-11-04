# Iteration 84: Boat Maintenance lists - master attribute admin lists, AI boat-kind / maint-lists, item-file (PDF) and item-photo for maint_ lists
import io
import os
import pytest
import requests
from PIL import Image
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
E = dotenv_values("/app/backend/.env")
DB = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
BOAT = "TEST_it84_maint"
PRO, FREE = "test_session_pro_1", "test_session_free_1"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def launch_free():
    return requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {FREE}"}).json().get("launch_free")


def sess(tok):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module", autouse=True)
def boat():
    state = {"boat": {"vessel": "TEST_IT84"}, "registry": [], "data": {}, "updated_at": "2026-01-01T00:00:00Z"}
    r = sess(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state)
    assert r.status_code == 200, r.text
    yield
    DB.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": BOAT})
    DB.item_files.delete_many({"owner_id": "test-user-pro", "boat_id": BOAT})
    DB.item_photos.delete_many({"owner_id": "test-user-pro", "boat_id": BOAT})


# Master attribute admin lists
class TestMasterAttributes:
    def test_migration_flag(self):
        assert DB.migrations.find_one({"_id": "master_attributes"})

    def test_admin_lists_prefix(self):
        r = sess(PRO).get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - master"})
        assert r.status_code == 200
        names = {l["name"]: l for l in r.json()["lists"]}
        assert "Admin - master attributes" in names and "Admin - master attribute types" in names
        attrs = [i["label"] for i in names["Admin - master attributes"]["items"]]
        types = [i["label"] for i in names["Admin - master attribute types"]["items"]]
        assert any("|" in a for a in attrs)
        assert any(t.lower().startswith("furling type") and "In-Mast Furling" in t for t in types)
        assert len(types) >= 7

    def test_private(self):
        # templates should be private (not offered as public list templates)
        docs = list(DB.list_templates.find({"name": {"$regex": "^Admin - master"}}, {"_id": 0, "name": 1, "private": 1, "custom": 1}))
        assert len(docs) == 2, docs


# AI boat kind
class TestBoatKind:
    def test_free_403(self):
        if launch_free():
            pytest.skip("Launch-free promo is on: every user is premium")
        r = sess(FREE).post(f"{BASE_URL}/api/ai/boat-kind", json={"make": "Beneteau", "model": "Oceanis 38", "boat_type": "Yacht - Sloop"})
        assert r.status_code == 403

    def test_empty_422(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/boat-kind", json={"make": "", "model": "X", "boat_type": "Yacht"})
        assert r.status_code == 422

    def test_sailboat(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/boat-kind", json={"make": "Beneteau", "model": "Oceanis 38", "boat_type": "Yacht - Sloop"}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["sailboat"] is True and isinstance(r.json()["name"], str)
        assert DB.boat_kinds.find_one({"key": "beneteau oceanis 38 yacht - sloop"})

    def test_motor(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/boat-kind", json={"make": "Riviera", "model": "4400", "boat_type": "Motor Cruiser"}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["sailboat"] is False

    def test_cached(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/boat-kind", json={"make": " beneteau ", "model": "OCEANIS 38", "boat_type": "Yacht - Sloop"}, timeout=20)
        assert r.status_code == 200 and r.json()["sailboat"] is True


# AI maintenance lists
class TestMaintLists:
    def test_free_403(self):
        if launch_free():
            pytest.skip("Launch-free promo is on: every user is premium")
        r = sess(FREE).post(f"{BASE_URL}/api/ai/maint-lists", json={"make": "Beneteau", "model": "Oceanis 38", "lists": ["sailLoft"]})
        assert r.status_code == 403

    def test_invalid_keys_422(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/maint-lists", json={"make": "Beneteau", "model": "Oceanis 38", "lists": ["bogus"]})
        assert r.status_code == 422

    def test_tailored(self):
        opts = ["In-Boom Furling", "In-Mast Furling", "Forestay Furling"]
        body = {"make": "Beneteau", "model": "Oceanis 38", "boat_type": "Yacht - Sloop", "lists": ["sailLoft", "groundTackle", "bogus"],
                "attrs": {"sailLoft": [{"key": "furling_type", "name": "Furling type", "options": opts}]}}
        r = sess(PRO).post(f"{BASE_URL}/api/ai/maint-lists", json=body, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "asks_left" in d
        assert set(d["lists"]) <= {"sailLoft", "groundTackle"} and "sailLoft" in d["lists"]
        for groups in d["lists"].values():
            for g in groups:
                assert g["heading"] and g["items"]
                for i in g["items"]:
                    assert i["label"]
                    assert set(i["attrs"]) <= {"furling_type"}
                    if "furling_type" in i["attrs"]:
                        assert i["attrs"]["furling_type"] in opts
        assert all(not i["attrs"] for g in d["lists"].get("groundTackle", []) for i in g["items"])


# PDF item files + item photos for maint_ lists
class TestItemFiles:
    def test_pdf_lifecycle(self):
        s = sess(PRO)
        r = s.post(f"{BASE_URL}/api/boats/{BOAT}/item-file", params={"list_id": "maint_sailLoft_1"}, files={"file": ("manual.pdf", PDF, "application/pdf")})
        assert r.status_code == 200, r.text
        fid = r.json()["file_id"]
        assert r.json()["name"] == "manual.pdf" and len(fid) == 32
        g = s.get(f"{BASE_URL}/api/boats/{BOAT}/item-file/{fid}")
        assert g.status_code == 200 and g.content.startswith(b"%PDF") and g.headers["content-type"].startswith("application/pdf")
        # other user can't read it
        assert sess(FREE).get(f"{BASE_URL}/api/boats/{BOAT}/item-file/{fid}", params={"owner": "test-user-pro"}).status_code == 404
        assert s.delete(f"{BASE_URL}/api/boats/{BOAT}/item-file/{fid}").status_code == 200
        assert s.get(f"{BASE_URL}/api/boats/{BOAT}/item-file/{fid}").status_code == 404

    def test_non_pdf_400(self):
        r = sess(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/item-file", params={"list_id": "maint_sailLoft_1"}, files={"file": ("x.pdf", b"hello", "application/pdf")})
        assert r.status_code == 400
        r = sess(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/item-file", params={"list_id": "maint_sailLoft_1"}, files={"file": ("x.txt", PDF, "text/plain")})
        assert r.status_code == 400

    def test_too_big_400(self):
        big = PDF + b"0" * (5 * 1024 * 1024 + 10)
        r = sess(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/item-file", params={"list_id": "maint_sailLoft_1"}, files={"file": ("big.pdf", big, "application/pdf")}, timeout=90)
        assert r.status_code in (400, 413)

    def test_bad_list_422(self):
        r = sess(PRO).post(f"{BASE_URL}/api/boats/{BOAT}/item-file", params={"list_id": "boatBudget"}, files={"file": ("m.pdf", PDF, "application/pdf")})
        assert r.status_code == 422

    def test_unknown_boat_404(self):
        r = sess(PRO).post(f"{BASE_URL}/api/boats/TEST_nope_84/item-file", params={"list_id": "maint_x"}, files={"file": ("m.pdf", PDF, "application/pdf")})
        assert r.status_code == 404

    def test_photo_maint_list(self):
        b = io.BytesIO(); Image.new("RGB", (200, 150), "blue").save(b, "JPEG")
        s = sess(PRO)
        r = s.post(f"{BASE_URL}/api/boats/{BOAT}/item-photo", params={"list_id": "maint_deckHardware_1737000000000"}, files={"file": ("i.jpg", b.getvalue(), "image/jpeg")})
        assert r.status_code == 200, r.text
        pid = r.json()["photo_id"]
        assert s.get(f"{BASE_URL}/api/boats/{BOAT}/item-photo/{pid}").status_code == 200
        assert s.delete(f"{BASE_URL}/api/boats/{BOAT}/item-photo/{pid}").status_code == 200
