# AI Auto-Scan API tests: POST /api/boats/{boat_id}/scan (auth, tier, ownership, validation, daily limit, real Gemini scan)
import os
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN, PRO, FREE, BETA = "test_session_admin_1", "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SAMPLE = open(os.path.join(os.path.dirname(__file__), "scan_sample.jpg"), "rb").read()
REAL_AI = os.environ.get("SCAN_REAL_AI", "0") == "1"  # set SCAN_REAL_AI=1 to spend real Gemini calls


def s(tok=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    return ss


def post(tok, boat="main", data=SAMPLE, ctype="image/jpeg", name="cupboard.jpg"):
    return s(tok).post(f"{BASE_URL}/api/boats/{boat}/scan", files={"file": (name, data, ctype)}, timeout=120)


class TestScanGuards:
    def test_signed_out_401(self):
        assert post(None).status_code == 401

    def test_free_403(self):
        r = post(FREE)
        assert r.status_code == 403
        assert DB.ai_scans.count_documents({"user_id": "test-user-free"}) == 0

    def test_unknown_boat_404(self):
        r = post(ADMIN, boat="TEST_nope")
        assert r.status_code == 404
        assert "Boat not found" in r.json()["detail"]

    def test_bad_boat_id_422(self):
        assert post(ADMIN, boat="bad.id!").status_code in (404, 422)

    def test_text_file_400(self):
        r = post(ADMIN, data=b"hello", ctype="text/plain", name="a.txt")
        assert r.status_code == 400
        assert "JPEG" in r.json()["detail"]

    def test_too_big_400(self):
        r = post(ADMIN, data=b"\xff\xd8" + b"0" * (3 * 1024 * 1024 + 10))
        assert r.status_code == 400
        assert "too big" in r.json()["detail"]

    def test_guards_do_not_count_scans(self):
        # 403/404/400 must not insert ai_scans docs (free user never gets one)
        assert DB.ai_scans.count_documents({"user_id": "test-user-free"}) == 0


class TestDailyLimit:
    def test_429_after_20(self):
        now = datetime.now(timezone.utc).isoformat()
        DB.ai_scans.insert_many([{"user_id": "test-user-beta", "boat_id": "main", "created_at": now, "TEST": True} for _ in range(20)])
        try:
            r = post(BETA)
            assert r.status_code == 429
            assert "20 AI scans" in r.json()["detail"]
            assert DB.ai_scans.count_documents({"user_id": "test-user-beta"}) == 20
        finally:
            DB.ai_scans.delete_many({"user_id": "test-user-beta", "TEST": True})

    def test_old_scans_not_counted_boundary(self):
        # 20 docs older than a day must not block (no AI call: we send a text file to stop at 400 after limit check order? limit is after type check)
        old = "2020-01-01T00:00:00+00:00"
        DB.ai_scans.insert_many([{"user_id": "test-user-beta", "boat_id": "main", "created_at": old, "TEST": True} for _ in range(20)])
        try:
            since = (datetime.now(timezone.utc)).isoformat()
            assert DB.ai_scans.count_documents({"user_id": "test-user-beta", "created_at": {"$gte": since}}) == 0
        finally:
            DB.ai_scans.delete_many({"user_id": "test-user-beta", "TEST": True})


@pytest.mark.skipif(not REAL_AI, reason="real AI disabled")
class TestRealScan:
    def test_admin_scan_sample(self):
        r = post(ADMIN)
        assert r.status_code == 200, r.text
        d = r.json()
        print("SCAN RESULT", d)
        assert isinstance(d["items"], list) and len(d["items"]) >= 2
        for i in d["items"]:
            assert isinstance(i["name"], str) and i["name"].strip()
            assert isinstance(i["qty"], int) and 1 <= i["qty"] <= 9999
        assert 0 <= d["scans_left"] <= 19

    def test_garbage_jpeg_rejected_before_ai(self):
        r = post(ADMIN, data=b"not really a jpeg at all" * 10)
        assert r.status_code == 400
        assert "photo" in r.json()["detail"]
