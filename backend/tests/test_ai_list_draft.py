# AI List Builder: POST /api/ai/list-draft (Pro/Beta only, 20/day). Makes exactly 1 real AI call.
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/ai/list-draft"


def sess(token):
    s = requests.Session()
    s.cookies.set("session_token", token)
    return s


class TestAiListDraft:
    def test_unauthenticated_401(self):
        r = requests.post(URL, json={"name": "Anchoring", "description": "Anchoring checks"})
        assert r.status_code == 401

    def test_free_user_403(self):
        r = sess("test_session_free_1").post(URL, json={"name": "Anchoring", "description": "Anchoring checks"})
        assert r.status_code == 403
        assert "upgrade to pro" in r.text.lower()

    def test_empty_description_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "X", "description": "  "})
        assert r.status_code == 422

    def test_missing_description_422(self):
        r = sess("test_session_pro_1").post(URL, json={})
        assert r.status_code == 422

    def test_too_long_name_422(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "x" * 61, "description": "ok"})
        assert r.status_code == 422

    def test_pro_draft_success(self):
        t = time.time()
        r = sess("test_session_pro_1").post(URL, json={"name": "Mooring up", "description": "Mooring up checks"}, timeout=120)
        print(f"took {time.time() - t:.1f}s")
        assert r.status_code == 200, r.text
        data = r.json()
        lines = data["lines"]
        assert isinstance(lines, list) and len(lines) > 3
        assert isinstance(data["drafts_left"], int) and 0 <= data["drafts_left"] < 20
        assert lines[0].startswith("1. ")
        nums = [int(m.group(1)) for l in lines if (m := re.match(r"^(\d+)\. ", l))]
        assert nums == list(range(1, len(nums) + 1))
        assert 3 <= len(nums) <= 8
        assert len(lines) > len(nums)
        print("\n".join(lines))


def test_too_long_description_422():
    r = sess("test_session_pro_1").post(URL, json={"name": "X", "description": "x" * 513})
    assert r.status_code == 422
