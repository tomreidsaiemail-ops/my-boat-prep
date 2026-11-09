# Create Zone Map Overview (Schematic): upload own overview (kind=overview) + How-to help admin list - iteration 141
import io
import os
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}


def maps():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    assert r.status_code == 200
    return next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])["zone_maps"]


def jpeg():
    b = io.BytesIO()
    Image.new("RGB", (300, 200), (40, 120, 200)).save(b, "JPEG")
    return b.getvalue()


def post(kind, headers=PRO):
    return requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.jpg", jpeg(), "image/jpeg")}, data={"kind": kind}, headers=headers, timeout=60)


# Upload own overview
class TestOverviewUpload:
    def test_overview_appended_after_existing(self):
        before = maps()
        n_ov = sum(1 for m in before if m["kind"] == "overview")
        r = post("overview")
        assert r.status_code == 200, r.text
        after = r.json()["zone_maps"]
        new = [m for m in after if m["id"] not in {x["id"] for x in before}]
        try:
            assert len(new) == 1
            m = new[0]
            assert m["kind"] == "overview" and m["swatches"] == []
            assert m["name"] == (f"My zone map overview {n_ov + 1}" if n_ov else "My zone map overview")
            assert after[-1]["id"] == m["id"]
            assert [x["id"] for x in after[:-1]] == [x["id"] for x in before]
            assert any(x["id"] == m["id"] for x in maps())  # persisted
            img = requests.get(f"{API}/boats/main/zone-maps/{m['id']}", headers=PRO, timeout=60)
            assert img.status_code == 200 and img.content[:3] == b"\xff\xd8\xff"
        finally:
            for m in new:
                requests.delete(f"{API}/boats/main/zone-maps/{m['id']}", headers=PRO, timeout=30)
        assert [x["id"] for x in maps()] == [x["id"] for x in before]

    def test_bad_kind_422(self):
        before = [x["id"] for x in maps()]
        assert post("other").status_code == 422
        assert [x["id"] for x in maps()] == before

    def test_unauth_401(self):
        assert requests.post(f"{API}/boats/main/zone-maps", files={"file": ("z.jpg", jpeg(), "image/jpeg")}, data={"kind": "overview"}, timeout=30).status_code == 401
