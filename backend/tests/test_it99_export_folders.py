# Iteration 99/101: paper-log title/date optional (it101), Ship's Log email/PDF folder layout, admin template-list cap
import os
import io
import pytest
import requests
from PIL import Image
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = "test_session_it98_log"  # manual_it98_shipslog_seed.py then manual_it99_folders_seed.py
ADMIN = "test_session_admin_1"
E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def png():
    b = io.BytesIO()
    Image.new("RGB", (200, 100), "white").save(b, "PNG")
    return b.getvalue()


def post(png, data):
    return requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")}, data=data)


# Paper log (it101): title/date optional (reading starts before naming); format/real-date still validated
class TestPaperLogOptional:
    def test_missing_title_and_date_200(self):
        # one real OCR call with readable text
        from PIL import ImageDraw
        b = io.BytesIO()
        im = Image.new("RGB", (600, 200), "white")
        d = ImageDraw.Draw(im)
        d.text((20, 40), "0800 Departed Auckland wind SW 15kn", fill="black")
        d.text((20, 90), "1200 Off Tiritiri baro 1015", fill="black")
        im.save(b, "PNG")
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.png", b.getvalue(), "image/png")}, timeout=120)
        if r.status_code == 429:
            pytest.skip("daily magic limit")
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j["text"], str) and j["text"].strip()
        assert "scans_left" in j

    def test_bad_date_format_422(self, png):
        assert post(png, {"title": "T", "date": "2024/03/01"}).status_code == 422

    def test_impossible_date_422(self, png):
        r = post(png, {"date": "2024-13-45"})
        assert r.status_code == 422 and "real date" in r.text

    def test_long_title_422(self, png):
        assert post(png, {"title": "x" * 121, "date": "2024-03-01"}).status_code == 422

    def test_no_auth_still_401(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", files={"file": ("p.png", png, "image/png")}, data={})
        assert r.status_code == 401

    def test_unknown_boat_404(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/nosuchboat/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")})
        assert r.status_code == 404

    def test_non_image_400(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_fake_png_400(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("a.png", b"notapng", "image/png")})
        assert r.status_code == 400


# Ship's Log email + PDF with folders
class TestShipLogEmailFolders:
    def test_email_folder_layout_and_pdf(self):
        r = requests.post(f"{BASE_URL}/api/me/email-log", headers=H(OWNER), json={"local_date": "Wednesday, 4 November 2026", "list_ids": ["shipsLog"]})
        if r.status_code == 429:
            pytest.skip("daily email limit")
        assert r.status_code == 200, r.text
        sent = r.json()["log_sent"]
        doc = db.ship_logs.find_one({"log_id": sent["log_id"]}, {"_id": 0})
        items = doc["lists"][0]["items"]
        got = [(i["label"], i.get("depth"), bool(i.get("folder"))) for i in items]
        print(got)
        assert got[0] == ("2024 Ship's Logs", 0, True)
        assert got[1][0].startswith("Auckland - Russell") and got[1][1:] == (1, True)
        assert [g[1] for g in got[2:5]] == [2, 2, 2] and got[2][0] == "TEST log A 2024 Mar"
        assert got[5] == ("TEST log D 2024 Nov", 1, False)
        assert [g[1] for g in got[6:]] == [0, 0, 0]
        pdf = requests.get(sent["pdf_url"].replace(sent["pdf_url"].split("/api/")[0], BASE_URL))
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        open("/tmp/it99_log.pdf", "wb").write(pdf.content)


# Admin template lists cap raised
class TestTemplateListCap:
    def test_admin_list_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=H(ADMIN))
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_cap_in_code(self):
        src = open("/app/backend/templates.py").read()
        assert 'find({"custom": True}, {"_id": 0}).sort("created_at", 1).to_list(1000)' in src
