# 2FA email code at account creation + "ADMIN - 2FA Special Users" list + change password
import hashlib
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
LIST = "ADMIN - 2FA Special Users"
PW = "TestHarbour2026!"

mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def chash(email, code):
    return hashlib.sha256(f"{email}:{code}".encode()).hexdigest()


def new_email(tag):
    return f"test_2fa_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def cleanup(email):
    u = mdb.users.find_one({"email": email})
    if u:
        mdb.user_sessions.delete_many({"user_id": u["user_id"]})
        mdb.users.delete_one({"user_id": u["user_id"]})
    mdb.email_codes.delete_many({"email": email})
    mdb.login_attempts.delete_many({"identifier": f"email:{email}"})


def set_code(email, code="123456"):
    now = datetime.now(timezone.utc)
    rec = mdb.email_codes.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
    assert rec, "no unused code doc"
    mdb.email_codes.update_one({"_id": rec["_id"]}, {"$set": {"code_hash": chash(email, code), "expires_at": now + timedelta(minutes=15)}})


# Seed: special list
class TestSeed:
    def test_list_seeded(self):
        d = mdb.list_templates.find_one({"name": LIST, "custom": True})
        assert d and d.get("private") is True
        labels = [i["label"].strip().lower() for i in d["items"]]
        assert len(labels) == len(set(labels))
        assert len(labels) >= 33
        assert "test.user.password@example.com" in labels

    def test_not_served_to_non_admin(self):
        r = requests.get(f"{API}/admin-lists", params={"prefix": "ADMIN - 2FA Special"}, headers={"Authorization": "Bearer test_session_free_1"})
        assert r.status_code == 400
        r = requests.get(f"{API}/templates", headers={"Authorization": "Bearer test_session_free_1"})
        if r.status_code == 200:
            assert LIST not in r.text
        r = requests.get(f"{API}/admin/template-lists", headers={"Authorization": "Bearer test_session_free_1"})
        assert r.status_code in (401, 403)


# Register -> code -> verify
class TestRegisterVerify:
    def test_full_flow(self):
        email = new_email("reg")
        try:
            s = requests.Session()
            r = s.post(f"{API}/auth/register", json={"email": email, "password": PW, "name": "TEST 2FA"})
            assert r.status_code == 200, r.text
            assert r.json() == {"verify": True, "email": email}
            assert "session_token" not in r.cookies and not s.cookies.get("session_token")
            assert s.get(f"{API}/auth/me").status_code == 401
            assert mdb.email_codes.count_documents({"email": email, "used": False}) == 1
            u = mdb.users.find_one({"email": email})
            assert u["email_verified"] is False

            # login before verifying -> verify, no new code (cooldown)
            r = s.post(f"{API}/auth/login", json={"email": email, "password": PW})
            assert r.status_code == 200 and r.json().get("verify") is True
            assert not s.cookies.get("session_token")
            assert mdb.email_codes.count_documents({"email": email}) == 1
            # resend in cooldown -> ok, no new code
            r = s.post(f"{API}/auth/resend-code", json={"email": email})
            assert r.status_code == 200 and r.json() == {"ok": True}
            assert mdb.email_codes.count_documents({"email": email}) == 1

            set_code(email)
            r = s.post(f"{API}/auth/verify-email", json={"email": email, "code": "000000"})
            assert r.status_code == 400 and "isn't right" in r.json()["detail"]
            r = s.post(f"{API}/auth/verify-email", json={"email": email, "code": "123456"})
            assert r.status_code == 200, r.text
            assert r.json()["email"] == email and r.json()["has_password"] is True
            assert s.get(f"{API}/auth/me").status_code == 200
            assert mdb.users.find_one({"email": email})["email_verified"] is True
            assert mdb.email_codes.count_documents({"email": email, "used": False}) == 0
            # code reuse fails
            r = requests.post(f"{API}/auth/verify-email", json={"email": email, "code": "123456"})
            assert r.status_code == 400 and "expired" in r.json()["detail"]
            # login after verification -> normal user
            s2 = requests.Session()
            r = s2.post(f"{API}/auth/login", json={"email": email, "password": PW})
            assert r.status_code == 200 and r.json().get("email") == email and "verify" not in r.json()
            assert s2.get(f"{API}/auth/me").status_code == 200
            # resend for verified user -> no code
            n = mdb.email_codes.count_documents({"email": email})
            assert requests.post(f"{API}/auth/resend-code", json={"email": email}).json() == {"ok": True}
            assert mdb.email_codes.count_documents({"email": email}) == n
        finally:
            cleanup(email)

    def test_five_wrong_tries_expire(self):
        email = new_email("tries")
        try:
            r = requests.post(f"{API}/auth/register", json={"email": email, "password": PW})
            assert r.json().get("verify") is True
            set_code(email)
            for _ in range(5):
                r = requests.post(f"{API}/auth/verify-email", json={"email": email, "code": "999999"})
                assert r.status_code == 400 and "isn't right" in r.json()["detail"]
            r = requests.post(f"{API}/auth/verify-email", json={"email": email, "code": "123456"})
            assert r.status_code == 400 and "expired" in r.json()["detail"]
            assert mdb.users.find_one({"email": email})["email_verified"] is False
        finally:
            cleanup(email)

    def test_bad_inputs(self):
        assert requests.post(f"{API}/auth/verify-email", json={"email": "x@example.com", "code": "12ab56"}).status_code == 422
        assert requests.post(f"{API}/auth/resend-code", json={"email": "nobody_2fa@example.com"}).json() == {"ok": True}
        assert requests.post(f"{API}/auth/resend-code", json={"email": "not-an-email"}).status_code == 422

    def test_resend_after_cooldown_and_hourly_cap(self):
        email = new_email("cap")
        try:
            requests.post(f"{API}/auth/register", json={"email": email, "password": PW})
            # age the code docs past cooldown to simulate time passing
            for i in range(6):
                mdb.email_codes.update_many({"email": email}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=2)}})
                requests.post(f"{API}/auth/resend-code", json={"email": email})
            assert mdb.email_codes.count_documents({"email": email}) == 5
            assert mdb.email_codes.count_documents({"email": email, "used": False}) == 1
        finally:
            cleanup(email)

    def test_google_only_user_resend_no_code(self):
        # existing seeded session user (no password) -> no code
        n = mdb.email_codes.count_documents({"email": "test.user.free@example.com"})
        assert requests.post(f"{API}/auth/resend-code", json={"email": "test.user.free@example.com"}).json() == {"ok": True}
        assert mdb.email_codes.count_documents({"email": "test.user.free@example.com"}) == n


# Special list skips the code
class TestSpecialList:
    def test_special_email_signs_in_immediately(self):
        email = new_email("special")
        mdb.list_templates.update_one({"name": LIST, "custom": True}, {"$push": {"items": {"id": 9999, "label": f"  {email.upper()}  "}}})
        try:
            s = requests.Session()
            r = s.post(f"{API}/auth/register", json={"email": email, "password": PW})
            assert r.status_code == 200, r.text
            assert r.json().get("email") == email and "verify" not in r.json()
            assert s.get(f"{API}/auth/me").status_code == 200
            assert mdb.users.find_one({"email": email})["email_verified"] is True
            assert mdb.email_codes.count_documents({"email": email}) == 0
        finally:
            mdb.list_templates.update_one({"name": LIST, "custom": True}, {"$pull": {"items": {"id": 9999}}})
            cleanup(email)

    def test_existing_password_user_logs_in(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": "test.user.password@example.com", "password": "Harbour2026!"})
        assert r.status_code == 200 and r.json().get("email") == "test.user.password@example.com"
        assert s.get(f"{API}/auth/me").status_code == 200
        tok = s.cookies.get("session_token")
        mdb.user_sessions.delete_one({"session_token": tok})

    def test_existing_session_users(self):
        for t in ("test_session_admin_1", "test_session_free_1"):
            assert requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t}"}).status_code == 200


# Change password
class TestChangePassword:
    def test_change_password(self):
        email = new_email("chg")
        mdb.list_templates.update_one({"name": LIST, "custom": True}, {"$push": {"items": {"id": 9998, "label": email}}})
        try:
            s1 = requests.Session()
            assert s1.post(f"{API}/auth/register", json={"email": email, "password": PW}).json().get("email") == email
            s2 = requests.Session()
            assert s2.post(f"{API}/auth/login", json={"email": email, "password": PW}).status_code == 200
            r = s1.post(f"{API}/auth/change-password", json={"current": "wrongpass1", "password": "NewHarbour2026!"})
            assert r.status_code == 400 and "current password" in r.json()["detail"]
            r = s1.post(f"{API}/auth/change-password", json={"current": PW, "password": "short"})
            assert r.status_code == 422
            r = s1.post(f"{API}/auth/change-password", json={"current": PW, "password": "NewHarbour2026!"})
            assert r.status_code == 200 and r.json() == {"ok": True}
            assert s1.get(f"{API}/auth/me").status_code == 200
            assert s2.get(f"{API}/auth/me").status_code == 401
            assert requests.post(f"{API}/auth/login", json={"email": email, "password": PW}).status_code == 401
            s3 = requests.Session()
            assert s3.post(f"{API}/auth/login", json={"email": email, "password": "NewHarbour2026!"}).status_code == 200
        finally:
            mdb.list_templates.update_one({"name": LIST, "custom": True}, {"$pull": {"items": {"id": 9998}}})
            cleanup(email)

    def test_change_password_bearer_keeps_current(self):
        email = new_email("bear")
        uid = f"test-2fa-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        mdb.users.insert_one({"user_id": uid, "email": email, "name": "TEST", "role": "free", "picture": "", "email_verified": True, "created_at": now.isoformat()})
        tok = f"test_sess_2fa_{uuid.uuid4().hex}"
        mdb.user_sessions.insert_one({"user_id": uid, "session_token": tok, "expires_at": now + timedelta(days=1), "created_at": now})
        try:
            h = {"Authorization": f"Bearer {tok}"}
            me = requests.get(f"{API}/auth/me", headers=h).json()
            assert me["has_password"] is False
            r = requests.post(f"{API}/auth/change-password", json={"current": "", "password": "SetHarbour2026!"}, headers=h)
            assert r.status_code == 200
            assert requests.get(f"{API}/auth/me", headers=h).json()["has_password"] is True
            s = requests.Session()
            assert s.post(f"{API}/auth/login", json={"email": email, "password": "SetHarbour2026!"}).json().get("email") == email
        finally:
            cleanup(email)

    def test_change_password_unauth(self):
        assert requests.post(f"{API}/auth/change-password", json={"current": "", "password": "abcdefgh1"}).status_code == 401
