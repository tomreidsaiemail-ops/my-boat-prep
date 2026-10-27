# Magic List Top-Up: POST /api/ai/list-topup (Pro/Beta only, shares 20/day with list-draft). Makes exactly 1 real AI call.
import os
import time
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/ai/list-topup"


def sess(token):
    s = requests.Session()
    s.cookies.set("session_token", token)
    return s


ITEMS = [
    {"label": "1. Deck (outside)", "heading": True},
    {"label": "Tidy lines", "heading": False},
    {"label": "Secure Dinghy", "heading": False},
    {"label": "2. Below", "heading": True},
    {"label": "Close hatches", "heading": False},
]


class TestTopUpValidation:
    def test_unauthenticated_401(self):
        r = requests.post(URL, json={"name": "X", "items": ITEMS})
        assert r.status_code == 401

    def test_free_user_403(self):
        r = sess("test_session_free_1").post(URL, json={"name": "X", "items": ITEMS})
        assert r.status_code == 403

    def test_empty_body_422(self):
        r = sess("test_session_pro_1").post(URL, json={})
        assert r.status_code == 422
        assert "list name" in r.text.lower()

    def test_blank_fields_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "  ", "description": " ", "items": []})
        assert r.status_code == 422

    def test_name_too_long_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "x" * 61, "items": ITEMS})
        assert r.status_code == 422

    def test_description_too_long_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "X", "description": "x" * 513})
        assert r.status_code == 422

    def test_too_many_items_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "X", "items": [{"label": f"i{n}"} for n in range(401)]})
        assert r.status_code == 422


class TestTopUpAI:
    def test_pro_topup_success(self):
        t = time.time()
        r = sess("test_session_pro_1").post(URL, json={"name": "TEST_Leaving", "description": "Leaving the marina on a yacht", "items": ITEMS}, timeout=120)
        print(f"took {time.time() - t:.1f}s")
        assert r.status_code == 200, r.text
        data = r.json()
        sugg = data["suggestions"]
        assert isinstance(sugg, list) and 0 < len(sugg) <= 25
        assert isinstance(data["drafts_left"], int) and 0 <= data["drafts_left"] < 20
        heads = {"1. deck (outside)", "2. below"}
        existing = {i["label"].lower() for i in ITEMS}
        seen = set()
        for s in sugg:
            assert set(s.keys()) == {"item", "heading"}
            assert s["heading"] == "" or s["heading"].lower() in heads, s
            assert s["item"].lower() not in existing
            assert s["item"].lower() not in seen
            seen.add(s["item"].lower())
        print(sugg)
        assert any(s["heading"] for s in sugg)
