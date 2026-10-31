# MLG YouTube link validation: youtube_links.check_links unit + POST /api/ai/list-draft with/without YouTube requested (2 real AI calls)
import asyncio
import os
import sys

import httpx
import pytest
import requests

sys.path.insert(0, "/app/backend")
from youtube_links import check_links, find_urls, wants_youtube  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/ai/list-draft"


def sess(token):
    s = requests.Session()
    s.cookies.set("session_token", token)
    return s


# Unit: wants_youtube / find_urls / check_links
class TestYouTubeUnit:
    def test_wants_youtube(self):
        assert wants_youtube("Knots", "each with a YouTube video link")
        assert wants_youtube("", "you tube clips")
        assert wants_youtube("", "see youtu.be/abc")
        assert not wants_youtube("Anchoring", "Anchoring checks for a calm bay")

    def test_find_urls(self):
        line = "Bowline https://www.youtube.com/watch?v=dQw4w9WgXcQ, and youtu.be/abc."
        assert find_urls(line) == ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtu.be/abc"]
        assert find_urls("notyoutube.com/x") == []

    def test_check_links_real_and_fake(self):
        lines = [
            "1. Knots",
            "Real https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "Fake https://www.youtube.com/watch?v=zzzzzzzzzz9",
            "Fake channel https://www.youtube.com/@thisChannelDoesNotExist-xq77zz9k1",
            "No link",
        ]
        res = asyncio.run(check_links(lines))
        assert res["checked"] == 3
        bad_lines = sorted(b["line"] for b in res["bad"])
        assert bad_lines == [2, 3], res

    def test_check_links_none(self):
        assert asyncio.run(check_links(["a", "b"])) == {"checked": 0, "bad": []}


# API: list-draft without / with YouTube request (real LLM, 2 calls total)
class TestListDraftYouTube:
    def test_no_youtube_shape_unchanged(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "TEST_Anchoring", "description": "Anchoring checks for an overnight stop"}, timeout=150)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) == {"lines", "drafts_left"}
        assert isinstance(d["lines"], list) and len(d["lines"]) > 0

    def test_youtube_requested_validated(self):
        r = sess("test_session_pro_1").post(URL, json={"name": "TEST_Knots", "description": "Knots every sailor should know, each with a YouTube video link"}, timeout=150)
        assert r.status_code == 200, r.text
        d = r.json()
        print("LINES", d["lines"])
        print("YT", d.get("youtube"))
        assert "youtube" in d
        yt = d["youtube"]
        assert isinstance(yt["checked"], int)
        bad = {b["url"] for b in yt["bad"]}
        all_urls = {u for l in d["lines"] for u in find_urls(l)}
        assert yt["checked"] == len(all_urls)
        for b in yt["bad"]:
            assert b["url"] in find_urls(d["lines"][b["line"]])
        # independently verify each bad one truly fails and each good video link exists
        with httpx.Client(timeout=10, follow_redirects=True) as c:
            for u in all_urls:
                full = u if u.startswith("http") else f"https://{u}"
                if any(k in full for k in ("watch?", "youtu.be/", "/shorts/", "/live/", "/embed/")):
                    code = c.get("https://www.youtube.com/oembed", params={"url": full, "format": "json"}).status_code
                    if u in bad:
                        assert code in (400, 404), (u, code)
                    else:
                        assert code not in (400, 404), (u, code)
