# Iteration 99: paper-log title/date required (422), Ship's Log email/PDF folder layout, admin template-list cap
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


# Paper log: title and date are required now
class TestPaperLogRequired:
    def test_missing_title_422(self, png):
        assert post(png, {"date": "2024-03-01"}).status_code == 422

    def test_empty_title_422(self, png):
        assert post(png, {"title": "", "date": "2024-03-01"}).status_code == 422

    def test_missing_date_422(self, png):
        assert post(png, {"title": "T"}).status_code == 422

    def test_bad_date_422(self, png):
        assert post(png, {"title": "T", "date": "2024/03/01"}).status_code == 422

    def test_long_title_422(self, png):
        assert post(png, {"title": "x" * 121, "date": "2024-03-01"}).status_code == 422

    def test_no_auth_still_401(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", files={"file": ("p.png", png, "image/png")}, data={})
        assert r.status_code == 401


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
