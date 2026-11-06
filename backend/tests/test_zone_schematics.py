# Zone map layout plans (Magic Mariner zone schematics) API tests - iteration 111
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
JOB = open("/tmp/job").read().strip()
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
ADMIN = {"Cookie": "session_token=test_session_admin_1"}
BOAT = {"boat_type": "Yacht - Sloop", "make": "Beneteau", "model": "Oceanis 38", "year_built": "2014", "loa": "11.5", "units": "m"}


def _del_maps(ids):
    for mid in ids:
        r = requests.delete(f"{API}/boats/main/zone-maps/{mid}", headers=PRO, timeout=30)
        assert r.status_code == 200


# Status + image of the pre-existing finished job
class TestJobRead:
    def test_status_done(self):
        r = requests.get(f"{API}/zone-schematics/{JOB}", headers=PRO, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "done" and d["total"] == 4 and d["failed"] == 0
        assert [i["id"] for i in d["images"]] == ["0", "1", "2", "3"]
        assert [i["title"] for i in d["images"]] == ["Deck & cockpit", "Saloon & galley", "Cabins", "Full interior"]
        assert all("path" not in i for i in d["images"])

    @pytest.mark.parametrize("n", ["0", "3"])
    def test_image_jpeg(self, n):
        r = requests.get(f"{API}/zone-schematics/{JOB}/{n}", headers=PRO, timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/jpeg")
        assert r.content[:3] == b"\xff\xd8\xff" and len(r.content) > 5000

    def test_image_missing_index(self):
        assert requests.get(f"{API}/zone-schematics/{JOB}/7", headers=PRO, timeout=30).status_code == 404
        assert requests.get(f"{API}/zone-schematics/{JOB}/12", headers=PRO, timeout=30).status_code == 422

    @pytest.mark.parametrize("h", [FREE, ADMIN])
    def test_other_user_404(self, h):
        assert requests.get(f"{API}/zone-schematics/{JOB}", headers=h, timeout=30).status_code == 404
        assert requests.get(f"{API}/zone-schematics/{JOB}/0", headers=h, timeout=30).status_code == 404

    def test_unauth(self):
        assert requests.get(f"{API}/zone-schematics/{JOB}", timeout=30).status_code == 401

    def test_bad_job_id_422(self):
        assert requests.get(f"{API}/zone-schematics/not-a-job", headers=PRO, timeout=30).status_code == 422


# Start validation (no live generation)
class TestStartValidation:
    def test_missing_make_model_400(self):
        r = requests.post(f"{API}/boats/main/zone-schematics", json={**BOAT, "model": "  "}, headers=PRO, timeout=30)
        assert r.status_code == 400 and "make and model" in r.json()["detail"]

    # Note: launch_free promo (first200) makes every user premium, so free users may start jobs; no live call here to save quota
    def test_unknown_boat_404(self):
        r = requests.post(f"{API}/boats/nosuchboat99/zone-schematics", json=BOAT, headers=PRO, timeout=30)
        assert r.status_code == 404

    def test_bad_units_422(self):
        assert requests.post(f"{API}/boats/main/zone-schematics", json={**BOAT, "units": "yd"}, headers=PRO, timeout=30).status_code == 422


# Use picked plans -> zone maps
class TestUse:
    def test_empty_ids_422(self):
        r = requests.post(f"{API}/boats/main/zone-schematics/{JOB}/use", json={"image_ids": []}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_bad_id_422(self):
        r = requests.post(f"{API}/boats/main/zone-schematics/{JOB}/use", json={"image_ids": ["ab"]}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_unknown_ids_400(self):
        r = requests.post(f"{API}/boats/main/zone-schematics/{JOB}/use", json={"image_ids": ["8"]}, headers=PRO, timeout=30)
        assert r.status_code == 400

    def test_other_user_use_404(self):
        r = requests.post(f"{API}/boats/main/zone-schematics/{JOB}/use", json={"image_ids": ["0"]}, headers=FREE, timeout=30)
        assert r.status_code == 404

    def test_wrong_boat_404(self):
        r = requests.post(f"{API}/boats/nosuchboat99/zone-schematics/{JOB}/use", json={"image_ids": ["0"]}, headers=PRO, timeout=30)
        assert r.status_code == 404

    def test_use_and_cleanup(self):
        r = requests.post(f"{API}/boats/main/zone-schematics/{JOB}/use", json={"image_ids": ["0", "3"]}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        maps = r.json()["zone_maps"]
        new = [m for m in maps if m["name"] in ("Deck & cockpit", "Full interior")]
        try:
            assert [m["name"] for m in new] == ["Deck & cockpit", "Full interior"]
            assert len({m.get("colour") for m in new}) == 2
            for m in new:
                img = requests.get(f"{API}/boats/main/zone-maps/{m['id']}", headers=PRO, timeout=60)
                assert img.status_code == 200 and img.content[:3] == b"\xff\xd8\xff"
        finally:
            _del_maps([m["id"] for m in new])
        # job image still served after map removal (shared path)
        assert requests.get(f"{API}/zone-schematics/{JOB}/0", headers=PRO, timeout=60).status_code == 200


# One live generation (costs a Magic use)
@pytest.mark.skipif(not os.environ.get("ZONE_LIVE"), reason="set ZONE_LIVE=1 to run a live (quota-costing) generation")
class TestLive:
    def test_live_job(self):
        r = requests.post(f"{API}/boats/main/zone-schematics", json=BOAT, headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 4 and len(d["job_id"]) == 36
        s = requests.get(f"{API}/zone-schematics/{d['job_id']}", headers=PRO, timeout=30).json()
        assert s["status"] == "running"
        t0 = time.time()
        while time.time() - t0 < 180 and s["status"] == "running":
            time.sleep(5)
            s = requests.get(f"{API}/zone-schematics/{d['job_id']}", headers=PRO, timeout=30).json()
        print("live job", d["job_id"], s, round(time.time() - t0), "s")
        open("/tmp/job_live", "w").write(d["job_id"])
        assert s["status"] == "done"
        assert len(s["images"]) + s["failed"] == 4 and len(s["images"]) >= 1
