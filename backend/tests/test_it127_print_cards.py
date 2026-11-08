# Print Cards: QR cards PDF (/api/inventory/qr-cards.pdf) and contents cards PDF (/api/inventory/folder-cards.pdf)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}


def card(**kw):
    c = {"url": f"{BASE_URL}/?scan_area=amw1pvdq802hq&b=main&o=test-user-pro", "name": "Fridge", "parent": "", "zone": "Galley", "hex": "#F28C28"}
    c.update(kw)
    return c


def post(path, body, cookies=PRO):
    return requests.post(f"{BASE_URL}/api/inventory/{path}", json=body, cookies=cookies, timeout=30)


class TestQrCards:
    def test_qr_pdf_ok(self):
        cards = [card(), card(name="Red folder", parent="Nav station", zone="Nav station", hex="#1F3A5F"), card(name="No zone", zone="", hex="")]
        r = post("qr-cards.pdf", {"vessel": "TEST_Kia Ora", "cards": cards})
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("application/pdf")
        assert "Cupboard QR cards.pdf" in r.headers.get("content-disposition", "")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1500

    def test_qr_pdf_multi_page(self):
        r = post("qr-cards.pdf", {"vessel": "", "cards": [card(name=f"Area {n} with a long name that wraps onto lines") for n in range(23)]})
        assert r.status_code == 200
        assert r.content.count(b"/Type /Page") - r.content.count(b"/Type /Pages") == 3

    def test_qr_pdf_unauth(self):
        r = post("qr-cards.pdf", {"cards": [card()]}, cookies={})
        assert r.status_code == 401

    @pytest.mark.parametrize("bad", [
        {"url": "javascript:alert(1)"}, {"url": "ftp://x.example.com/a"}, {"url": "https://a b.com/x"},
        {"hex": "red"}, {"hex": "#12345"}, {"hex": "#GGGGGG"}, {"name": ""}, {"name": "x" * 121}, {"zone": "z" * 81},
    ])
    def test_qr_pdf_validation(self, bad):
        r = post("qr-cards.pdf", {"cards": [card(**bad)]})
        assert r.status_code == 422, (bad, r.status_code)

    def test_qr_pdf_empty_and_too_many(self):
        assert post("qr-cards.pdf", {"cards": []}).status_code == 422
        assert post("qr-cards.pdf", {"cards": [card()] * 301}).status_code == 422

    def test_qr_pdf_300_ok(self):
        r = post("qr-cards.pdf", {"cards": [card()] * 300})
        assert r.status_code == 200


class TestContentsCards:
    def test_contents_pdf_ok(self):
        r = post("folder-cards.pdf", {"vessel": "TEST", "cards": [{"name": "Red folder", "parent": "Nav station", "zone": "Nav", "items": [{"name": "Charts", "qty": 2}]}]})
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert "Folder and box contents cards.pdf" in r.headers.get("content-disposition", "")

    def test_contents_pdf_empty(self):
        assert post("folder-cards.pdf", {"cards": []}).status_code == 422
