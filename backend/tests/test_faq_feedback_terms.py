# FAQ, Feedback, Terms acceptance, emergency_checked boat state, FAQ in email-log PDF
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


def H(who):
    return {"Authorization": f"Bearer test_session_{who}_1"}


def get_faq(who="admin"):
    r = requests.get(f"{API}/faq", headers=H(who), timeout=20)
    assert r.status_code == 200
    return r.json()["items"]


@pytest.fixture(scope="module", autouse=True)
def restore_faq():
    original = get_faq()
    yield
    requests.put(f"{API}/admin/faq", json={"items": original}, headers=H("admin"), timeout=20)


# --- FAQ read ---
class TestFaqRead:
    @pytest.mark.parametrize("who", ["admin", "free", "pro", "beta"])
    def test_any_user_reads(self, who):
        items = get_faq(who)
        assert any(i["id"] == 1 and i["question"].startswith("Does My Boat Prep") for i in items)

    def test_unauth_401(self):
        assert requests.get(f"{API}/faq", timeout=20).status_code == 401


# --- FAQ admin write ---
class TestFaqWrite:
    def test_non_admin_403(self):
        for who in ("free", "pro", "beta"):
            r = requests.put(f"{API}/admin/faq", json={"items": []}, headers=H(who), timeout=20)
            assert r.status_code == 403, who

    def test_unauth_401(self):
        assert requests.put(f"{API}/admin/faq", json={"items": []}, timeout=20).status_code == 401

    def test_save_strips_and_drops_blank(self):
        original = get_faq()
        payload = {"items": original + [
            {"id": "t1", "question": "  TEST_Q1  ", "answer": "  TEST_A1 "},
            {"id": "t2", "question": "   ", "answer": "ans"},
            {"id": "t3", "question": "TEST_Q3", "answer": ""},
        ]}
        r = requests.put(f"{API}/admin/faq", json=payload, headers=H("admin"), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == len(original) + 1
        assert items[-1] == {"id": "t1", "question": "TEST_Q1", "answer": "TEST_A1"}
        persisted = get_faq("free")
        assert persisted[-1]["question"] == "TEST_Q1"
        assert not any(i["id"] in ("t2", "t3") for i in persisted)

    def test_reorder_persists(self):
        original = [i for i in get_faq() if not str(i["question"]).startswith("TEST_")]
        payload = {"items": [{"id": "t9", "question": "TEST_first", "answer": "x"}] + original}
        r = requests.put(f"{API}/admin/faq", json=payload, headers=H("admin"), timeout=20)
        assert r.status_code == 200
        assert get_faq()[0]["question"] == "TEST_first"

    def test_too_long_question_422(self):
        r = requests.put(f"{API}/admin/faq", json={"items": [{"id": 5, "question": "q" * 301, "answer": "a"}]}, headers=H("admin"), timeout=20)
        assert r.status_code == 422


# --- Feedback ---
class TestFeedback:
    @pytest.mark.parametrize("body", [
        {"title": "", "message": "hello"}, {"title": "   ", "message": "hello"},
        {"title": "TEST t", "message": ""}, {"title": "TEST t", "message": " \n "}, {"title": "TEST t"},
    ])
    def test_blank_422(self, body):
        r = requests.post(f"{API}/feedback", json=body, headers=H("free"), timeout=20)
        assert r.status_code == 422

    def test_unauth_401(self):
        assert requests.post(f"{API}/feedback", json={"title": "a", "message": "b"}, timeout=20).status_code == 401

    def test_daily_limit_429(self):
        now = datetime.now(timezone.utc).isoformat()
        ids = [f"TEST_{uuid.uuid4()}" for _ in range(5)]
        mdb.feedback.insert_many([{"feedback_id": i, "user_id": "test-user-beta", "title": "TEST", "message": "x", "created_at": now} for i in ids])
        try:
            r = requests.post(f"{API}/feedback", json={"title": "TEST limit", "message": "x"}, headers=H("beta"), timeout=20)
            assert r.status_code == 429
            assert "tomorrow" in r.json()["detail"]
        finally:
            mdb.feedback.delete_many({"feedback_id": {"$in": ids}})

    @pytest.mark.skipif(os.environ.get("RUN_REAL_EMAIL") != "1", reason="sends a real email to ADMIN_EMAIL; set RUN_REAL_EMAIL=1")
    def test_send_one_real_email(self):
        r = requests.post(f"{API}/feedback", json={"title": "  TEST feedback - please ignore ", "message": "Automated test.\nLine two."}, headers=H("free"), timeout=40)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        doc = mdb.feedback.find_one({"user_id": "test-user-free"}, sort=[("created_at", -1)])
        assert doc["title"] == "TEST feedback - please ignore"
        assert doc["tier"] == "Free"
        assert doc.get("email_id")


# --- Terms acceptance ---
class TestTerms:
    def test_bad_version_422(self):
        for v in ("june", "2026-6", "", "2026-06-01x"):
            r = requests.post(f"{API}/auth/accept-terms", json={"version": v}, headers=H("beta"), timeout=20)
            assert r.status_code == 422, v

    def test_unauth_401(self):
        assert requests.post(f"{API}/auth/accept-terms", json={"version": "2026-06"}, timeout=20).status_code == 401

    def test_accept_sets_tos_version(self):
        try:
            r = requests.post(f"{API}/auth/accept-terms", json={"version": "2026-06"}, headers=H("beta"), timeout=20)
            assert r.status_code == 200
            assert r.json()["tos_version"] == "2026-06"
            me = requests.get(f"{API}/auth/me", headers=H("beta"), timeout=20).json()
            assert me["tos_version"] == "2026-06"
        finally:
            mdb.users.update_one({"user_id": "test-user-beta"}, {"$unset": {"tos_version": "", "tos_accepted_at": ""}})


# --- Boat state emergency_checked ---
class TestEmergencyChecked:
    def test_roundtrip(self):
        before = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20)
        assert before.status_code == 200
        state = before.json()
        payload = {k: state[k] for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "deleted_lists")}
        try:
            payload["emergency_checked"] = {"mayDay": True}
            r = requests.put(f"{API}/me/boat", json=payload, headers=H("pro"), timeout=20)
            assert r.status_code == 200
            assert r.json()["emergency_checked"] == {"mayDay": True}
            g = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20).json()
            assert g["emergency_checked"] == {"mayDay": True}
        finally:
            payload["emergency_checked"] = state.get("emergency_checked", {})
            requests.put(f"{API}/me/boat", json=payload, headers=H("pro"), timeout=20)

    def test_default_empty_when_omitted(self):
        state = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20).json()
        payload = {k: state[k] for k in ("boat", "registry", "data", "updated_at", "log_sent", "engine_log", "deleted_lists")}
        r = requests.put(f"{API}/me/boat", json=payload, headers=H("pro"), timeout=20)
        assert r.status_code == 200
        assert r.json()["emergency_checked"] == {}


# --- FAQ in email-log PDF ---
class TestFaqEmail:
    def test_email_log_with_faq(self):
        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        mdb.ship_logs.delete_many({"owner_id": "test-user-pro", "created_at": {"$gte": since}})
        r = requests.post(f"{API}/me/email-log", json={"local_date": "1 Jan 2026", "list_ids": ["faq"]}, headers=H("pro"), timeout=60)
        assert r.status_code == 200, r.text
        log_id = r.json()["log_sent"]["log_id"]
        log = mdb.ship_logs.find_one({"log_id": log_id})
        assert log["lists"][0]["name"] == "FAQ"
        labels = " ".join(i["label"] for i in log["lists"][0]["items"])
        assert "Does My Boat Prep work with no signal?" in labels
        pdf = requests.get(f"{API}/ship-logs/{log_id}.pdf", timeout=30)
        assert pdf.status_code == 200
        assert pdf.headers["content-type"] == "application/pdf"
        assert pdf.content[:4] == b"%PDF"
