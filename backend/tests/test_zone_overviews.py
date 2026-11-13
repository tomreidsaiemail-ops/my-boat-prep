# Zone Map Overviews (colourless AI plans + draggable preset colour squares) API tests - iteration 112
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MID = open("/tmp/mid").read().strip()
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}


def maps():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    assert r.status_code == 200
    return next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])["zone_maps"]


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (300, 200), (200, 120, 40)).save(b, "JPEG")
    return b.getvalue()


@pytest.fixture
def original_swatches():
    m = next(m for m in maps() if m["id"] == MID)
    yield m["swatches"]
    r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": m["swatches"]}, headers=PRO, timeout=30)
    assert r.status_code == 200


# Presets from admin list
class TestPresets:
    def test_presets_order_and_shape(self):
        r = requests.get(f"{API}/zone-colour-presets", headers=PRO, timeout=30)
        assert r.status_code == 200
        p = r.json()["presets"]
        assert p and p[0]["label"] == "Cockpit"
        assert all(set(x) == {"label", "colour"} for x in p)

    def test_presets_unauth(self):
        assert requests.get(f"{API}/zone-colour-presets", timeout=30).status_code == 401

    def test_presets_crew_ok(self):
        assert requests.get(f"{API}/zone-colour-presets", headers=FREE, timeout=30).status_code == 200


# Swatch saving
class TestSwatches:
    def test_existing_overview_shape(self):
        m = next(m for m in maps() if m["id"] == MID)
        assert m["kind"] == "overview" and m["colour"] == "" and m["name"] == "Full interior"
        assert isinstance(m["swatches"], list)

    def test_save_and_persist(self, original_swatches):
        sw = original_swatches + [{"id": "TEST_s1", "x": 0.6, "y": 0.5, "colour": "green", "label": " TEST Zone "}]
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        got = next(m for m in maps() if m["id"] == MID)["swatches"]
        t = next(s for s in got if s["id"] == "TEST_s1")
        assert t == {"id": "TEST_s1", "x": 0.6, "y": 0.5, "colour": "Green", "label": "TEST Zone"}

    def test_bad_colour_400(self, original_swatches):
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": [{"id": "a", "x": 0.1, "y": 0.1, "colour": "Notacolour"}]}, headers=PRO, timeout=30)
        assert r.status_code == 400

    def test_too_many_422(self, original_swatches):
        sw = [{"id": f"a{i}", "x": 0.1, "y": 0.1, "colour": "Gold"} for i in range(101)]
        assert requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30).status_code == 422

    def test_out_of_range_422(self, original_swatches):
        sw = [{"id": "a", "x": 1.5, "y": 0.1, "colour": "Gold"}]
        assert requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30).status_code == 422

    def test_crew_cannot_save_404(self, original_swatches):
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": []}, headers=FREE, timeout=30)
        assert r.status_code == 404
        assert len(next(m for m in maps() if m["id"] == MID)["swatches"]) == len(original_swatches)

    def test_unknown_map_404(self):
        r = requests.put(f"{API}/boats/main/zone-maps/00000000-0000-0000-0000-000000000000/swatches", json={"swatches": []}, headers=PRO, timeout=30)
        assert r.status_code == 404


# Photo vs overview interplay
class TestPhotoAndUse:
    def test_photo_takes_colour_overview_skipped_and_non_overview_404(self):
        r = requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.jpg", jpeg(), "image/jpeg")}, headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        photo = next(m for m in r.json()["zone_maps"] if m["kind"] == "photo")
        try:
            assert photo["colour"] == "Gold"  # first palette colour; overview doesn't use one
            assert photo["swatches"] == []
            r2 = requests.put(f"{API}/boats/main/zone-maps/{photo['id']}/swatches", json={"swatches": []}, headers=PRO, timeout=30)
            assert r2.status_code == 404
            r3 = requests.put(f"{API}/boats/main/zone-maps/{photo['id']}/meta", json={"name": "TEST Galley"}, headers=PRO, timeout=30)
            assert r3.status_code == 200
            assert next(m for m in maps() if m["id"] == photo["id"])["colour"] == "Orange"
            ov = next(m for m in maps() if m["id"] == MID)
            assert ov["colour"] == "" and ov["kind"] == "overview"
        finally:
            requests.delete(f"{API}/boats/main/zone-maps/{photo['id']}", headers=PRO, timeout=30)


    def test_crew_sees_overview_with_swatches(self):
        r = requests.get(f"{API}/me/boats", headers=FREE, timeout=30)
        b = next(b for b in r.json()["boats"] if b["crew"] and b["owner_id"] == "test-user-pro")
        m = next(m for m in b["zone_maps"] if m["id"] == MID)
        assert m["kind"] == "overview" and len(m["swatches"]) >= 1
        img = requests.get(f"{API}/boats/main/zone-maps/{MID}?owner=test-user-pro", headers=FREE, timeout=60)
        assert img.status_code == 200 and img.content[:3] == b"\xff\xd8\xff"
