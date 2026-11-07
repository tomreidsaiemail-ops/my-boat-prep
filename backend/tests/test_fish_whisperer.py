# Magic Fish Whisperer: /api/ai/fish access/validation, /api/me/catches ownership, help panel templates
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
FREE = {"session_token": "test_session_free_1"}
BETA = {"session_token": "test_session_beta_1"}
FAKE_ID = "0" * 32


def _jpeg(color=(200, 200, 200), size=(64, 64)):
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, "JPEG")
    return b.getvalue()


def _pro_catches():
    r = requests.get(f"{BASE_URL}/api/me/catches", cookies=PRO, timeout=30)
    assert r.status_code == 200
    return r.json()["catches"]


# Access control
class TestFishAccess:
    def test_unauthenticated_401(self):
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, timeout=30)
        assert r.status_code == 401

    def test_free_user_forbidden(self):
        me = requests.get(f"{BASE_URL}/api/auth/me", cookies=FREE, timeout=30).json()
        if me.get("premium"):
            pytest.skip("launch_free promo makes free users premium; Pro gate can't be exercised")
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, cookies=FREE, timeout=30)
        assert r.status_code in (402, 403)
        assert "Pro" in r.json().get("detail", "")

    def test_catches_unauthenticated_401(self):
        assert requests.get(f"{BASE_URL}/api/me/catches", timeout=30).status_code == 401


# Input validation (no AI call made)
class TestFishValidation:
    def test_bad_content_type(self):
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.txt", b"hello", "text/plain")}, cookies=PRO, timeout=30)
        assert r.status_code == 400
        assert "JPEG" in r.json()["detail"]

    def test_too_big(self):
        big = b"\xff\xd8\xff" + os.urandom(3 * 1024 * 1024 + 10)
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.jpg", big, "image/jpeg")}, cookies=PRO, timeout=60)
        assert r.status_code in (400, 413)

    def test_bad_lat(self):
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, data={"lat": "200"}, cookies=PRO, timeout=30)
        assert r.status_code == 422

    def test_bad_catch_id_pattern(self):
        r = requests.get(f"{BASE_URL}/api/me/catches/not-a-hex/photo", cookies=PRO, timeout=30)
        assert r.status_code == 422


# Catch log ownership
class TestCatchOwnership:
    def test_pro_list_shape(self):
        cs = _pro_catches()
        assert isinstance(cs, list)
        for c in cs:
            assert "_id" not in c and "user_id" not in c
            assert {"catch_id", "created_at", "report", "has_photo"} <= set(c)

    def test_free_does_not_see_pro_catches(self):
        pro_ids = {c["catch_id"] for c in _pro_catches()}
        r = requests.get(f"{BASE_URL}/api/me/catches", cookies=FREE, timeout=30)
        assert r.status_code == 200
        assert not pro_ids & {c["catch_id"] for c in r.json()["catches"]}

    def test_other_user_photo_and_delete_404(self):
        cs = _pro_catches()
        if not cs:
            pytest.skip("no pro catch")
        cid = cs[0]["catch_id"]
        assert requests.get(f"{BASE_URL}/api/me/catches/{cid}/photo", cookies=FREE, timeout=30).status_code == 404
        assert requests.delete(f"{BASE_URL}/api/me/catches/{cid}", cookies=FREE, timeout=30).status_code == 404
        assert cid in {c["catch_id"] for c in _pro_catches()}

    def test_owner_photo(self):
        cs = [c for c in _pro_catches() if c["has_photo"]]
        if not cs:
            pytest.skip("no pro catch with photo")
        r = requests.get(f"{BASE_URL}/api/me/catches/{cs[0]['catch_id']}/photo", cookies=PRO, timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/")
        assert len(r.content) > 1000

    def test_delete_unknown_404(self):
        assert requests.delete(f"{BASE_URL}/api/me/catches/{FAKE_ID}", cookies=PRO, timeout=30).status_code == 404


# Real AI call (1x): a plain grey square is not a fish -> not_fish, nothing saved, asks_left returned
class TestNotFish:
    def test_not_fish(self):
        before = {c["catch_id"] for c in _pro_catches()}
        r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("a.jpg", _jpeg((40, 120, 40), (400, 300)), "image/jpeg")},
                          data={"lat": "-36.84", "lon": "174.76", "when": "today"}, cookies=PRO, timeout=150)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["not_fish"] is True
        assert isinstance(d["message"], str) and d["message"]
        assert "asks_left" in d
        after = {c["catch_id"] for c in _pro_catches()}
        assert after == before


# Seeded help panel lists
class TestHelpTemplates:
    @pytest.mark.parametrize("name,needle", [("Admin - Help Panel - Magic Fish Whisperer", "puffer fish"),
                                             ("Admin - Help Panel - Magic Bartender", "MAGIC BARTENDER")])
    def test_help_seeded(self, name, needle):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel - "}, cookies=PRO, timeout=30)
        assert r.status_code == 200
        tpls = r.json()["lists"]
        t = [x for x in tpls if x.get("name", "").strip().lower() == name.lower()]
        assert t, f"{name} not in templates"
        assert any(needle in i.get("label", "") for i in t[0].get("items", []))
