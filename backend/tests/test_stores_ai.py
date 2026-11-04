# Shopping scan (POST /boats/{id}/scan?shopping=true), stores sync (POST /ai/mpa/consumed), Whisper transcribe (POST /ai/transcribe)
import io
import math
import os
import struct
import wave

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
FREE = {"session_token": "test_session_free_1"}
PHOTO_URL = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900"
STOCK = [{"name": "Beer cans", "qty": 6, "area": "Bilge"}, {"name": "Milk 2L", "qty": 1, "area": "Fridge"},
         {"name": "Steaks", "qty": 4, "area": "Freezer"}, {"name": "Tinned tomatoes", "qty": 3, "area": "Pantry"}]


@pytest.fixture(scope="module")
def photo():
    r = requests.get(PHOTO_URL, timeout=30)
    assert r.status_code == 200
    return r.content


def tone_wav(seconds=1.5):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes(b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(int(16000 * seconds))))
    return buf.getvalue()


class TestShoppingScan:
    def test_shopping_scan_returns_weights(self, photo):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true"}, cookies=PRO,
                          files={"file": ("shop.jpg", photo, "image/jpeg")}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["items"], list) and len(d["items"]) > 0
        for i in d["items"]:
            assert isinstance(i["name"], str) and i["name"]
            assert isinstance(i["qty"], int) and i["qty"] >= 1
            assert isinstance(i["weight_g"], int) and i["weight_g"] >= 0
        assert "scans_left" in d
        print("shopping items", d["items"][:5])

    def test_shopping_scan_free_user_blocked(self, photo):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true"}, cookies=FREE,
                          files={"file": ("shop.jpg", photo, "image/jpeg")}, timeout=60)
        assert r.status_code in (200, 402, 403)  # launch_free promo makes free users premium

    def test_shopping_scan_bad_type(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true"}, cookies=PRO,
                          files={"file": ("a.txt", b"hello", "text/plain")}, timeout=60)
        assert r.status_code == 400


class TestConsumed:
    def test_consumed_matches_and_caps(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", cookies=PRO, timeout=120,
                          json={"text": "We drank 10 beers from the bilge and finished the milk. Also ate a pizza.", "stock": STOCK})
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d) >= {"items", "unknown", "asks_left"}
        by_n = {i["n"]: i for i in d["items"]}
        assert 1 in by_n and by_n[1]["qty"] <= 6, d
        assert 2 in by_n and by_n[2]["qty"] == 1, d
        for i in d["items"]:
            assert 1 <= i["n"] <= len(STOCK)
            assert i["qty"] <= STOCK[i["n"] - 1]["qty"]
            assert isinstance(i["weight_g"], int)
        assert any("pizza" in u.lower() for u in d["unknown"]), d
        print("consumed", d)

    def test_consumed_validation(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", cookies=PRO, json={"text": "x", "stock": STOCK}, timeout=30)
        assert r.status_code == 422
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", cookies=PRO, json={"text": "two beers", "stock": []}, timeout=30)
        assert r.status_code == 422

    def test_consumed_free_blocked(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", cookies=FREE, json={"text": "two beers", "stock": STOCK}, timeout=30)
        assert r.status_code in (200, 402, 403)  # launch_free promo makes free users premium

    def test_consumed_unauth(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", json={"text": "two beers", "stock": STOCK}, timeout=30)
        assert r.status_code == 401


class TestParseConsumedUnit:
    def test_parse_drops_invalid_and_caps(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        from stores_ai import StockItem, parse_consumed
        stock = [StockItem(**s) for s in STOCK]
        out = parse_consumed(stock)('{"items":[{"n":1,"qty":50,"weight_g":9000},{"n":9,"qty":1},{"n":"x"},{"n":1,"qty":1},{"n":2,"qty":1,"weight_g":"abc"}],"unknown":["pizza"," "]}')
        assert out["items"] == [{"n": 1, "qty": 6, "weight_g": 9000}, {"n": 2, "qty": 1, "weight_g": 0}]
        assert out["unknown"] == ["pizza"]


class TestTranscribe:
    def test_transcribe_wav_ok(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=PRO, files={"file": ("note.wav", tone_wav(), "audio/wav")}, timeout=90)
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["text"], str)
        print("transcribe", r.json())

    def test_transcribe_webm_codecs_type_ok(self):
        # browsers may send 'audio/webm;codecs=opus'; the backend strips params. Use wav bytes labelled as wav w/ params.
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=PRO, files={"file": ("note.wav", tone_wav(), "audio/wav;rate=16000")}, timeout=90)
        assert r.status_code == 200, r.text

    def test_transcribe_rejects_other_type(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=PRO, files={"file": ("a.png", b"\x89PNG" + b"0" * 2000, "image/png")}, timeout=30)
        assert r.status_code == 400

    def test_transcribe_rejects_tiny(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=PRO, files={"file": ("a.webm", b"0" * 100, "audio/webm")}, timeout=30)
        assert r.status_code == 400

    def test_transcribe_rejects_big(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=PRO, files={"file": ("a.webm", b"0" * (8 * 1024 * 1024 + 10), "audio/webm")}, timeout=60)
        assert r.status_code in (400, 413)

    def test_transcribe_free_blocked(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", cookies=FREE, files={"file": ("note.wav", tone_wav(), "audio/wav")}, timeout=30)
        assert r.status_code in (200, 402, 403)  # launch_free promo makes free users premium
