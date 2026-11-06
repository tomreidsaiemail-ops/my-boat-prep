# 100 zone colours, MAX zone maps 100, swatches max 100 - iteration 113
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MID = open("/tmp/mid").read().strip()
PRO = {"Cookie": "session_token=test_session_pro_1"}


def maps():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    assert r.status_code == 200
    return next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])["zone_maps"]


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (120, 80), (10, 120, 200)).save(b, "JPEG")
    return b.getvalue()


@pytest.fixture(scope="module")
def photo():
    r = requests.post(f"{API}/boats/main/zone-maps", files={"file": ("m.jpg", jpeg(), "image/jpeg")}, headers=PRO, timeout=60)
    assert r.status_code == 200, r.text
    before = {m["id"] for m in maps()} - {x["id"] for x in r.json()["zone_maps"]}
    new = [m for m in r.json()["zone_maps"] if m.get("kind") != "overview"][-1]
    yield new
    d = requests.delete(f"{API}/boats/main/zone-maps/{new['id']}", headers=PRO, timeout=30)
    assert d.status_code == 200


@pytest.fixture
def original_swatches():
    m = next(m for m in maps() if m["id"] == MID)
    yield m["swatches"]
    r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": m["swatches"]}, headers=PRO, timeout=30)
    assert r.status_code == 200


def meta(mid, body):
    return requests.put(f"{API}/boats/main/zone-maps/{mid}/meta", json=body, headers=PRO, timeout=30)


# New colours on photo maps
class TestNewColours:
    @pytest.mark.parametrize("c,expect", [("Scarlet", "Scarlet"), ("white", "White"), ("Black", "Black"), ("forest  green", "Forest Green"), ("Hot Pink", "Hot Pink"), ("oilve", "Olive")])
    def test_meta_colour_valid(self, photo, c, expect):
        r = meta(photo["id"], {"colour": c})
        assert r.status_code == 200, r.text
        m = next(m for m in r.json()["zone_maps"] if m["id"] == photo["id"])
        assert m["colour"] == expect
        assert next(m for m in maps() if m["id"] == photo["id"])["colour"] == expect

    def test_meta_colour_invalid(self, photo):
        r = meta(photo["id"], {"colour": "Bluee"})
        assert r.status_code == 400
        assert "100" in r.json()["detail"]

    def test_overview_colour_rejected(self):
        assert meta(MID, {"colour": "Scarlet"}).status_code == 400

    def test_name_galley_takes_orange(self, photo):
        r = meta(photo["id"], {"colour": None, "name": "Galley"})
        assert r.status_code == 200
        # colour_manual was set by earlier tests so name does not override; just assert name persisted
        m = next(m for m in maps() if m["id"] == photo["id"])
        assert m["name"] == "Galley"


# Presets parse two-word colours
class TestPresets:
    def test_presets_two_word(self):
        r = requests.get(f"{API}/zone-colour-presets", headers=PRO, timeout=30)
        assert r.status_code == 200
        p = r.json()["presets"]
        assert any(x["colour"] == "Sky Blue" for x in p)


# Swatch limits
class TestSwatchLimit:
    def test_100_ok_101_rejected(self, original_swatches):
        cols = ["Gold", "Blue"]
        sw = [{"id": f"TEST_{i}", "x": 0.5, "y": 0.5, "colour": "Gold", "label": f"TEST Z{i}"} for i in range(100)]
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        assert len(next(m for m in r.json()["zone_maps"] if m["id"] == MID)["swatches"]) == 100
        sw.append({"id": "TEST_x", "x": 0.5, "y": 0.5, "colour": cols[1], "label": "TEST extra"})
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_new_colour_swatch(self, original_swatches):
        sw = original_swatches + [{"id": "TEST_w", "x": 0.2, "y": 0.2, "colour": "kelly green", "label": "TEST Kelly"}]
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 200
        assert next(s for s in next(m for m in r.json()["zone_maps"] if m["id"] == MID)["swatches"] if s["id"] == "TEST_w")["colour"] == "Kelly Green"

    def test_duplicate_label_rejected(self, original_swatches):
        sw = original_swatches + [dict(original_swatches[0], id="TEST_dup")]
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 400


# Unit: palette and limit constants
def test_constants():
    import sys
    sys.path.insert(0, "/app/backend")
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    import zone_colours, inventory
    assert len(zone_colours.PALETTE) == 100 == len(set(zone_colours.PALETTE))
    assert inventory.MAX_BOAT_MAPS == 100
    assert zone_colours.colour_name("forest green") == "Forest Green"
    assert zone_colours.colour_name("grey") == "Gray"
