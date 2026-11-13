# Zone Map Overview single full-interior plan (iteration 161): layout_comment, one Magic use per drawing, reuse/retry, use -> overview
# Live drawings: run with ZONE_LIVE=1 (2 drawings: first + retry). Tests are ordered and share state via module dict.
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
PRO = {"Cookie": "session_token=test_session_pro_1"}
BETA = {"Cookie": "session_token=test_session_beta_1"}
COMMENT = f"TEST_ Owner's version, 3 cabins, galley on port, head in fore peak {uuid.uuid4().hex[:6]}"
BODY = {"boat_type": "Yacht - Sloop", "make": "Beneteau", "model": "Oceanis 38", "year_built": "2014", "layout_comment": COMMENT, "retry": False}
S = {}


def left(h=PRO):
    return requests.get(f"{API}/magic/quota", headers=h, timeout=30).json()["left"]


def poll(job, h=PRO, limit=240):
    t0 = time.time()
    while True:
        s = requests.get(f"{API}/zone-schematics/{job}", headers=h, timeout=30).json()
        if s["status"] != "running" or time.time() - t0 > limit:
            print("job", job, s, round(time.time() - t0), "s")
            return s
        time.sleep(5)


# Removed endpoint + validation (no drawing)
class TestStatic:
    def test_old_zone_layouts_gone(self):
        r = requests.post(f"{API}/boats/main/zone-layouts", json={}, headers=PRO, timeout=30)
        assert r.status_code in (404, 405)

    def test_comment_too_long_422(self):
        r = requests.post(f"{API}/boats/main/zone-schematics", json={**BODY, "layout_comment": "x" * 301}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_me_boat_layout_comment_roundtrip(self):
        state = requests.get(f"{API}/me/boat", headers=BETA, timeout=30).json()
        orig = state["boat"].get("layout_comment", "")
        state["boat"]["layout_comment"] = "TEST_ comment roundtrip"
        payload = {k: v for k, v in state.items() if k not in ("owner_id", "boat_id", "role", "synced_at")}
        r = requests.put(f"{API}/me/boat", json=payload, headers=BETA, timeout=30)
        assert r.status_code == 200, r.text
        assert requests.get(f"{API}/me/boat", headers=BETA, timeout=30).json()["boat"]["layout_comment"] == "TEST_ comment roundtrip"
        payload["boat"]["layout_comment"] = "y" * 301
        assert requests.put(f"{API}/me/boat", json=payload, headers=BETA, timeout=30).status_code == 422
        payload["boat"]["layout_comment"] = orig
        assert requests.put(f"{API}/me/boat", json=payload, headers=BETA, timeout=30).status_code == 200


@pytest.mark.skipif(not os.environ.get("ZONE_LIVE"), reason="set ZONE_LIVE=1 for live (quota-costing) drawings")
class TestLive:
    def test_1_start_consumes_one(self):
        before = left()
        r = requests.post(f"{API}/boats/main/zone-schematics", json=BODY, headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 1 and len(d["job_id"]) == 36 and not d.get("reused")
        assert d["scans_left"] == before - 1 == left()
        S["job"], S["left"] = d["job_id"], d["scans_left"]

    def test_2_reuse_same_fields(self):
        r = requests.post(f"{API}/boats/main/zone-schematics", json=BODY, headers=PRO, timeout=60)
        d = r.json()
        assert r.status_code == 200 and d["reused"] is True and d["job_id"] == S["job"]
        assert left() == S["left"]

    def test_3_done_one_image(self):
        s = poll(S["job"])
        assert s["status"] == "done", s
        assert s["total"] == 1 and s["images"] == [{"id": "0", "title": "Full interior"}]
        img = requests.get(f"{API}/zone-schematics/{S['job']}/0", headers=PRO, timeout=60)
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/jpeg") and img.content[:3] == b"\xff\xd8\xff"
        open("/tmp/zone_plan_job", "w").write(S["job"])
        assert requests.get(f"{API}/zone-schematics/{S['job']}/1", headers=PRO, timeout=30).status_code == 404

    def test_4_use_adds_overview_and_cleanup(self):
        before = {m["id"] for m in requests.get(f"{API}/me/boats", headers=PRO, timeout=30).json()["boats"][0]["zone_maps"]} \
            if False else {m["id"] for b in requests.get(f"{API}/me/boats", headers=PRO, timeout=30).json()["boats"]
                           if b["boat_id"] == "main" and not b.get("crew") for m in b["zone_maps"]}
        r = requests.post(f"{API}/boats/main/zone-schematics/{S['job']}/use", json={"image_ids": ["0"]}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        new = [m for m in r.json()["zone_maps"] if m["id"] not in before]
        try:
            assert len(new) == 1 and new[0]["name"] == "Full interior" and new[0]["kind"] == "overview"
        finally:
            for m in new:
                assert requests.delete(f"{API}/boats/main/zone-maps/{m['id']}", headers=PRO, timeout=30).status_code == 200

    def test_5_retry_new_job_one_more_use(self):
        before = left()
        r = requests.post(f"{API}/boats/main/zone-schematics", json={**BODY, "retry": True}, headers=PRO, timeout=60)
        d = r.json()
        assert r.status_code == 200 and d["job_id"] != S["job"] and not d.get("reused")
        assert d["scans_left"] == before - 1
        s = poll(d["job_id"])
        assert s["status"] == "done" and len(s["images"]) == 1, s
        assert left() == before - 1
