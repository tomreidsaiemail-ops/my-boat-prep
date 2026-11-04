# Iteration 98: Batch Magic Scan Paper Logs endpoint + Ship's Log help admin lists
import io
import os
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER = "test_session_it98_log"  # seeded by manual_it98_shipslog_seed.py (pro, boat 'main')
ADMIN = "test_session_admin_1"


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def page_png(lines):
    img = Image.new("RGB", (1000, 600), "white")
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except Exception:
        f = ImageFont.load_default()
    for n, t in enumerate(lines):
        d.text((40, 40 + n * 70), t, fill="black", font=f)
    b = io.BytesIO()
    img.save(b, "PNG")
    return b.getvalue()


@pytest.fixture(scope="module")
def png():
    return page_png(["0800 Departed Auckland", "Wind SW 15 knots", "Baro 1015"])


# Paper log validation
class TestPaperLogValidation:
    def test_no_auth_401(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", files={"file": ("p.png", png, "image/png")}, data={"title": "T", "date": "2024-03-01"})
        assert r.status_code == 401

    def test_unknown_boat_404(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/nosuchboat/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")}, data={"title": "T", "date": "2024-03-01"})
        assert r.status_code == 404

    def test_non_image_400(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.txt", b"hello", "text/plain")}, data={"title": "T", "date": "2024-03-01"})
        assert r.status_code == 400

    def test_fake_png_400(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.png", b"notreallyapng", "image/png")}, data={"title": "T", "date": "2024-03-01"})
        assert r.status_code == 400

    def test_bad_date_422(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")}, data={"title": "T", "date": "01/03/2024"})
        assert r.status_code == 422

    def test_bad_boat_id_422(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/bad%20id!/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")}, data={"title": "T", "date": "2024-03-01"})
        assert r.status_code in (404, 422)


# Paper log real OCR (1 page)
class TestPaperLogOCR:
    def test_ocr_reads_text(self, png):
        r = requests.post(f"{BASE_URL}/api/boats/main/paper-log", headers=H(OWNER), files={"file": ("p.png", png, "image/png")},
                          data={"title": "TEST_Page", "date": "2024-03-05"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["text"], str) and "Auckland" in d["text"] and "1015" in d["text"]
        assert "scans_left" in d
        assert not any(c in d["text"] for c in "*#`")


# Ship's Log help lists reachable by non-admin
class TestLogHelpLists:
    def test_help_panels_visible_to_skipper(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel -"}, headers=H(OWNER))
        assert r.status_code == 200
        names = [l["name"] for l in r.json()["lists"]]
        assert "Admin - Help Panel - Ships Log" in names
        assert "Admin - Help Panel - Ships Log Passage Folders" in names
        log = next(l for l in r.json()["lists"] if l["name"] == "Admin - Help Panel - Ships Log")
        assert any(i["label"].startswith("Skipper's Tip:") for i in log["items"])

    def test_admin_template_lists(self):
        r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=H(ADMIN))
        assert r.status_code == 200
        d = r.json()
        assert all("updated_at" in t and "items" in t and "name" in t for t in d)
        print("template list count", len(d))

    def test_admin_template_lists_forbidden_for_non_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=H(OWNER))
        assert r.status_code == 403
