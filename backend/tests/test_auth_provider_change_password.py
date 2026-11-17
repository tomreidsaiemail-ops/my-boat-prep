# Auth provider lockdown + two-step change password (check-password / change-password / forgot / reset / register)
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "test.user.password@example.com"
PW = "Harbour2026!"
GOOGLE_MSG = "handled by Google"


def _db():
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


DB = _db()


def clear_lock():
    DB.login_attempts.delete_many({"identifier": f"email:{EMAIL}"})


def login():
    clear_lock()
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PW})
    if r.status_code != 200 or r.json().get("verify"):
        pytest.skip(f"Email login failed: {r.status_code} {r.text[:200]}")
    return s


def bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


# auth_provider in /me
class TestProviderInMe:
    @pytest.mark.parametrize("tok", ["test_session_free_1", "test_session_pro_1", "test_session_beta_1"])
    def test_google_users(self, tok):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=bearer(tok))
        assert r.status_code == 200
        assert r.json()["auth_provider"] == "google"

    def test_email_user(self):
        s = login()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["auth_provider"] == "email"
        assert r.json()["has_password"] is True


# check-password + lock
class TestCheckPassword:
    def test_right_and_wrong(self):
        s = login()
        r = s.post(f"{BASE_URL}/api/auth/check-password", json={"current": PW})
        assert r.status_code == 200 and r.json() == {"ok": True}
        r = s.post(f"{BASE_URL}/api/auth/check-password", json={"current": "WrongPass123"})
        assert r.status_code == 400
        assert r.json()["detail"] == "Your current password isn't right"
        clear_lock()

    def test_lock_after_5_shared_with_login(self):
        s = login()
        try:
            codes = [s.post(f"{BASE_URL}/api/auth/check-password", json={"current": "WrongPass123"}).status_code for _ in range(5)]
            assert codes == [400] * 5
            r = s.post(f"{BASE_URL}/api/auth/check-password", json={"current": PW})
            assert r.status_code == 429
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PW})
            assert r.status_code == 429  # shared lock
        finally:
            clear_lock()

    def test_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/auth/check-password", json={"current": PW})
        assert r.status_code == 401

    def test_google_403(self):
        r = requests.post(f"{BASE_URL}/api/auth/check-password", json={"current": "whatever123"}, headers=bearer("test_session_free_1"))
        assert r.status_code == 403
        assert GOOGLE_MSG in r.json()["detail"]


# change-password
class TestChangePassword:
    def test_wrong_current_400(self):
        s = login()
        r = s.post(f"{BASE_URL}/api/auth/change-password", json={"current": "WrongPass123", "password": "NewPass2026!"})
        assert r.status_code == 400
        clear_lock()

    def test_short_new_422(self):
        s = login()
        r = s.post(f"{BASE_URL}/api/auth/change-password", json={"current": PW, "password": "short"})
        assert r.status_code == 422

    def test_change_same_value_and_other_sessions_signed_out(self):
        s1 = login()
        s2 = login()
        r = s1.post(f"{BASE_URL}/api/auth/change-password", json={"current": PW, "password": PW})
        assert r.status_code == 200 and r.json() == {"ok": True}
        assert s1.get(f"{BASE_URL}/api/auth/me").status_code == 200
        assert s2.get(f"{BASE_URL}/api/auth/me").status_code == 401
        # password still works
        login()

    def test_google_403(self):
        r = requests.post(f"{BASE_URL}/api/auth/change-password", json={"current": "whatever123", "password": "NewPass2026!"}, headers=bearer("test_session_pro_1"))
        assert r.status_code == 403
        assert GOOGLE_MSG in r.json()["detail"]


# forgot / reset
class TestForgotReset:
    def test_forgot_google_400(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "test.user.free@example.com"})
        assert r.status_code == 400
        assert GOOGLE_MSG in r.json()["detail"]

    def test_forgot_email_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": EMAIL})
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_forgot_unknown_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200

    def test_reset_google_403_and_no_hash_set(self):
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        ins = DB.password_reset_tokens.insert_one({"token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": "test-user-free",
                                                   "used": False, "created_at": now - timedelta(hours=2), "expires_at": now + timedelta(hours=1)})
        try:
            r = requests.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "password": "NewPass2026!"})
            assert r.status_code == 403
            assert GOOGLE_MSG in r.json()["detail"]
            u = DB.users.find_one({"user_id": "test-user-free"})
            assert not u.get("password_hash")
            assert u.get("auth_provider") == "google"
            assert requests.get(f"{BASE_URL}/api/auth/me", headers=bearer("test_session_free_1")).status_code == 200
        finally:
            DB.password_reset_tokens.delete_one({"_id": ins.inserted_id})


# register
class TestRegister:
    def test_register_google_email(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": "test.user.free@example.com", "password": "NewPass2026!"})
        assert r.status_code == 400
        assert r.json()["detail"] == "This email signs in with Google. Use Continue with Google instead."

    def test_register_existing_email_account(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": EMAIL, "password": "NewPass2026!"})
        assert r.status_code == 400
        assert "Sign in instead" in r.json()["detail"]

    def test_register_sets_email_provider(self):
        email = f"test_prov_{uuid.uuid4().hex[:8]}@example.com"
        try:
            r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "NewPass2026!", "name": "TEST_prov"})
            assert r.status_code == 200
            u = DB.users.find_one({"email": email})
            assert u and u["auth_provider"] == "email"
        finally:
            u = DB.users.find_one({"email": email}, {"user_id": 1})
            if u:
                DB.user_sessions.delete_many({"user_id": u["user_id"]})
                DB.email_codes.delete_many({"email": email})
                DB.users.delete_one({"user_id": u["user_id"]})
