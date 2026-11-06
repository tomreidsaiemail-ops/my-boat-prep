# Zone photos tagged with a zone + colour (POST zone-maps with zone/colour form fields) - iteration 114
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
CREATED = []


def maps():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    assert r.status_code == 200
    return next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])["zone_maps"]


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (200, 150), (240, 140, 40)).save(b, "JPEG")
    return b.getvalue()


def upload(data=None, headers=PRO):
    return requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.jpg", jpeg(), "image/jpeg")}, data=data or {}, headers=headers, timeout=60)


def track(before, resp):
    ids = {m["id"] for m in before}
    new = [m for m in resp.json()["zone_maps"] if m["id"] not in ids]
    CREATED.extend(m["id"] for m in new)
    return new


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for mid in CREATED:
        requests.delete(f"{API}/boats/main/zone-maps/{mid}", headers=PRO, timeout=30)


class TestZoneUpload:
    def test_existing_galley_photos_have_zone(self):
        g = [m for m in maps() if m.get("zone") == "Galley"]
        assert len(g) >= 2
        assert all(m["colour"] == "Orange" for m in g)
        assert all("zone" in m for m in maps())

    def test_galley_third_photo(self):
        before = maps()
        n = sum(1 for m in before if (m.get("zone") or "").lower() == "galley")
        r = upload({"zone": "Galley", "colour": "Orange"})
        assert r.status_code == 200, r.text
        new = track(before, r)
        assert len(new) == 1
        assert new[0]["name"] == f"Galley {n + 1}"
        assert new[0]["colour"] == "Orange" and new[0]["zone"] == "Galley" and new[0]["kind"] == "photo"
        assert any(m["id"] == new[0]["id"] for m in maps())  # persisted

    def test_saloon_orange_clash(self):
        r = upload({"zone": "Saloon", "colour": "Orange"})
        assert r.status_code == 400
        assert "Orange" in r.json()["detail"]

    def test_invalid_colour(self):
        r = upload({"zone": "Saloon", "colour": "Blurple"})
        assert r.status_code == 400
        assert "colour" in r.json()["detail"].lower()

    def test_saloon_green_ok(self):
        before = maps()
        r = upload({"zone": "Saloon", "colour": "Green"})
        assert r.status_code == 200, r.text
        new = track(before, r)
        assert new[0]["name"] == "Saloon" and new[0]["colour"] == "Green" and new[0]["zone"] == "Saloon"

    def test_zone_whitespace_normalised(self):
        before = maps()
        r = upload({"zone": "  Nav   station ", "colour": "navy"})
        assert r.status_code == 200, r.text
        new = track(before, r)
        assert new[0]["zone"] == "Nav station" and new[0]["colour"] == "Navy"

    def test_no_zone_old_behaviour(self):
        before = maps()
        used = {m["colour"] for m in before if m["kind"] != "overview"}
        r = upload()
        assert r.status_code == 200, r.text
        new = track(before, r)
        assert new[0]["name"] == "" and new[0]["zone"] == ""
        assert new[0]["colour"] and new[0]["colour"] not in used

    def test_unauth(self):
        r = upload({"zone": "Galley", "colour": "Orange"}, headers={})
        assert r.status_code == 401


class TestMetaSameZone:
    def test_recolour_galley_photo_same_zone_no_clash(self):
        g = [m for m in maps() if m.get("zone") == "Galley"]
        # Set colour Orange on a Galley photo explicitly; siblings are Orange too but same zone -> OK
        r = requests.put(f"{API}/boats/main/zone-maps/{g[1]['id']}/meta", json={"colour": "Orange"}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        m = next(x for x in r.json()["zone_maps"] if x["id"] == g[1]["id"])
        assert m["colour"] == "Orange" and m["zone"] == "Galley"

    def test_recolour_to_other_zone_colour_clashes(self):
        before = maps()
        r = upload({"zone": "Heads", "colour": "Teal"})
        assert r.status_code == 200, r.text
        new = track(before, r)[0]
        r2 = requests.put(f"{API}/boats/main/zone-maps/{new['id']}/meta", json={"colour": "Orange"}, headers=PRO, timeout=30)
        assert r2.status_code == 400
        assert "Orange" in r2.json()["detail"]
