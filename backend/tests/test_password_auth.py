# Email + password auth: register, login, lockout, forgot/reset, origin guard, no hash leakage
import os
import time
import uuid
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
HOST = BASE_URL.split("://")[1]
PW_EMAIL = "test.user.password@example.com"
PW_PASS = "Harbour2026!"

mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = mongo[os.environ.get("DB_NAME", "test_database")]


def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def uniq():
    return f"test.user.pw{uuid.uuid4().hex[:8]}@example.com"


def make_token(user_id, expired=False, used=False):
    tok = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.password_reset_tokens.insert_one({"token_hash": hashlib.sha256(tok.encode()).hexdigest(), "user_id": user_id,
                                         "used": used, "created_at": now,
                                         "expires_at": now + (timedelta(hours=-1) if expired else timedelta(hours=1))})
    return tok


@pytest.fixture(scope="module", autouse=True)
def setup_pw_user():
    db.login_attempts.delete_many({})
    if not db.users.find_one({"email": PW_EMAIL}):
        r = s().post(f"{API}/auth/register", json={"email": PW_EMAIL, "password": PW_PASS, "name": "Password Skipper"})
        assert r.status_code == 200, r.text
    yield
    db.login_attempts.delete_many({})
    db.users.delete_many({"email": {"$regex": r"^test\.user\.pw[0-9a-f]{8}@example\.com$"}})


# Register
class TestRegister:
    def test_register_new_lowercased_free(self):
        e = uniq()
        c = s()
        r = c.post(f"{API}/auth/register", json={"email": e.upper().replace("EXAMPLE.COM", "Example.com"), "password": "Sailing123", "name": "TEST Reg"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == e and d["role"] == "free" and "password_hash" not in d
        assert "session_token" in r.cookies or "session_token" in c.cookies
        sc = r.headers.get("set-cookie", "").lower()
        assert "httponly" in sc and "secure" in sc and "samesite=none" in sc
        me = c.get(f"{API}/auth/me")
        assert me.status_code == 200 and me.json()["email"] == e and "password_hash" not in me.text
        u = db.users.find_one({"email": e})
        assert u["password_hash"].startswith("$2b$")

    def test_register_short_password(self):
        r = s().post(f"{API}/auth/register", json={"email": uniq(), "password": "short"})
        assert r.status_code == 422
        assert "8" in str(r.json()["detail"])

    def test_register_existing_password_account(self):
        r = s().post(f"{API}/auth/register", json={"email": PW_EMAIL.upper(), "password": "Whatever123"})
        assert r.status_code == 400
        assert r.json()["detail"] == "An account with this email already exists. Sign in instead."

    def test_register_existing_google_account(self):
        r = s().post(f"{API}/auth/register", json={"email": "test.user.free@example.com", "password": "Whatever123"})
        assert r.status_code == 400
        assert r.json()["detail"].startswith("This email already signs in with Google")
        assert not db.users.find_one({"email": "test.user.free@example.com"}).get("password_hash")


# Login
class TestLogin:
    def test_login_ok_case_insensitive(self):
        c = s()
        r = c.post(f"{API}/auth/login", json={"email": "Test.User.PASSWORD@example.com", "password": PW_PASS})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == PW_EMAIL and "password_hash" not in r.text
        assert c.get(f"{API}/auth/me").status_code == 200

    def test_login_wrong_password(self):
        r = s().post(f"{API}/auth/login", json={"email": PW_EMAIL, "password": "nope-nope"})
        assert r.status_code == 401 and r.json()["detail"] == "Incorrect email or password"
        db.login_attempts.delete_many({})

    def test_login_google_only_user(self):
        r = s().post(f"{API}/auth/login", json={"email": "test.user.free@example.com", "password": "anything1"})
        assert r.status_code == 401
        db.login_attempts.delete_many({})

    def test_lockout_after_5(self):
        e = uniq()
        s().post(f"{API}/auth/register", json={"email": e, "password": "RightPass1"})
        codes = [s().post(f"{API}/auth/login", json={"email": e, "password": "WrongPass1"}).status_code for _ in range(5)]
        assert codes == [401] * 5
        r = s().post(f"{API}/auth/login", json={"email": e, "password": "RightPass1"})
        assert r.status_code == 429 and "Too many attempts" in r.json()["detail"]
        db.login_attempts.delete_many({})
        assert s().post(f"{API}/auth/login", json={"email": e, "password": "RightPass1"}).status_code == 200

    def test_lockout_xff_spoof(self):
        """Security probe: does a spoofed X-Forwarded-For bypass the lock?"""
        e = uniq()
        s().post(f"{API}/auth/register", json={"email": e, "password": "RightPass1"})
        for _ in range(5):
            s().post(f"{API}/auth/login", json={"email": e, "password": "WrongPass1"})
        r = s().post(f"{API}/auth/login", json={"email": e, "password": "RightPass1"}, headers={"X-Forwarded-For": "1.2.3.4"})
        db.login_attempts.delete_many({})
        assert r.status_code == 429, f"lockout bypassed with spoofed XFF -> {r.status_code}"


# Forgot / reset
class TestReset:
    def test_forgot_unknown_email_ok(self):
        r = s().post(f"{API}/auth/forgot-password", json={"email": "nobody.here.xyz@example.com"})
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_reset_flow_single_use_and_sessions_cleared(self):
        e = uniq()
        c = s()
        uid = c.post(f"{API}/auth/register", json={"email": e, "password": "OldPass123"}).json()["user_id"]
        assert c.get(f"{API}/auth/me").status_code == 200
        tok = make_token(uid)
        r = s().post(f"{API}/auth/reset-password", json={"token": tok, "password": "NewPass456"})
        assert r.status_code == 200 and r.json() == {"ok": True}
        assert c.get(f"{API}/auth/me").status_code == 401
        assert s().post(f"{API}/auth/login", json={"email": e, "password": "OldPass123"}).status_code == 401
        assert s().post(f"{API}/auth/login", json={"email": e, "password": "NewPass456"}).status_code == 200
        r2 = s().post(f"{API}/auth/reset-password", json={"token": tok, "password": "Another789"})
        assert r2.status_code == 400 and "expired or was already used" in r2.json()["detail"]
        db.login_attempts.delete_many({})

    def test_reset_expired(self):
        e = uniq()
        uid = s().post(f"{API}/auth/register", json={"email": e, "password": "OldPass123"}).json()["user_id"]
        r = s().post(f"{API}/auth/reset-password", json={"token": make_token(uid, expired=True), "password": "NewPass456"})
        assert r.status_code == 400

    def test_reset_bogus_and_short(self):
        assert s().post(f"{API}/auth/reset-password", json={"token": "x" * 40, "password": "NewPass456"}).status_code == 400
        assert s().post(f"{API}/auth/reset-password", json={"token": "x" * 40, "password": "short"}).status_code == 422


# Origin guard
class TestOrigin:
    def test_evil_origin_blocked(self):
        r = s().post(f"{API}/auth/login", json={"email": PW_EMAIL, "password": PW_PASS}, headers={"Origin": "https://evil.com"})
        assert r.status_code == 403

    def test_same_origin_ok(self):
        r = s().post(f"{API}/auth/login", json={"email": PW_EMAIL, "password": PW_PASS}, headers={"Origin": BASE_URL})
        assert r.status_code == 200

    def test_webhook_exempt(self):
        r = s().post(f"{API}/stripe/webhook", data="{}", headers={"Origin": "https://evil.com"})
        assert r.status_code != 403

    def test_seeded_sessions_still_work(self):
        for tok, role in [("test_session_admin_1", "beta_tester"), ("test_session_free_1", "free"), ("test_session_pro_1", "pro"), ("test_session_beta_1", "beta_tester")]:
            r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == 200 and r.json()["role"] == role and "password_hash" not in r.text


# Iteration 14: per-email lockout, register race, forgot swallow, timing, atomic reset
class TestIter14Fixes:
    def test_lockout_rotating_xff_still_counts(self):
        e = uniq()
        s().post(f"{API}/auth/register", json={"email": e, "password": "RightPass1"})
        codes = [s().post(f"{API}/auth/login", json={"email": e, "password": "WrongPass1"},
                          headers={"X-Forwarded-For": f"9.9.9.{i}"}).status_code for i in range(5)]
        assert codes == [401] * 5
        for xff in ["1.2.3.4", "5.6.7.8, 10.0.0.1", ""]:
            h = {"X-Forwarded-For": xff} if xff else {}
            r = s().post(f"{API}/auth/login", json={"email": e, "password": "RightPass1"}, headers=h)
            assert r.status_code == 429, f"xff={xff!r} -> {r.status_code}"
        assert db.login_attempts.find_one({"identifier": f"email:{e}"})["locked_until"] is not None
        db.login_attempts.delete_many({})

    def test_reset_clears_lock(self):
        e = uniq()
        uid = s().post(f"{API}/auth/register", json={"email": e, "password": "RightPass1"}).json()["user_id"]
        for _ in range(5):
            s().post(f"{API}/auth/login", json={"email": e, "password": "WrongPass1"})
        assert s().post(f"{API}/auth/login", json={"email": e, "password": "RightPass1"}).status_code == 429
        r = s().post(f"{API}/auth/reset-password", json={"token": make_token(uid), "password": "NewPass456"})
        assert r.status_code == 200
        assert db.login_attempts.find_one({"identifier": f"email:{e}"}) is None
        assert s().post(f"{API}/auth/login", json={"email": e, "password": "NewPass456"}).status_code == 200

    def test_register_race_no_500(self):
        from concurrent.futures import ThreadPoolExecutor
        e = uniq()
        with ThreadPoolExecutor(8) as ex:
            res = list(ex.map(lambda _: s().post(f"{API}/auth/register", json={"email": e, "password": "RacePass1"}), range(8)))
        codes = [r.status_code for r in res]
        assert codes.count(200) == 1, codes
        assert all(c in (200, 400) for c in codes), codes
        for r in res:
            if r.status_code == 400:
                assert "already exists" in r.json()["detail"] or "Google" in r.json()["detail"]
        assert db.users.count_documents({"email": e}) == 1

    def test_unknown_email_401_and_lock(self):
        e = f"nobody.{uuid.uuid4().hex[:6]}@example.com"
        r = s().post(f"{API}/auth/login", json={"email": e, "password": "Whatever1"})
        assert r.status_code == 401 and r.json()["detail"] == "Incorrect email or password"
        db.login_attempts.delete_many({})

    def test_login_timing_similar(self):
        def t(email, pw):
            best = 9e9
            for _ in range(3):
                st = time.perf_counter()
                s().post(f"{API}/auth/login", json={"email": email, "password": pw})
                best = min(best, time.perf_counter() - st)
            db.login_attempts.delete_many({})
            return best
        known = t(PW_EMAIL, "WrongPass9")
        unknown = t(f"nobody.{uuid.uuid4().hex[:6]}@example.com", "WrongPass9")
        print(f"timing known={known:.3f}s unknown={unknown:.3f}s")
        assert abs(known - unknown) < 0.15

    def test_reset_concurrent_single_use(self):
        from concurrent.futures import ThreadPoolExecutor
        e = uniq()
        uid = s().post(f"{API}/auth/register", json={"email": e, "password": "OldPass123"}).json()["user_id"]
        tok = make_token(uid)
        with ThreadPoolExecutor(6) as ex:
            codes = list(ex.map(lambda i: s().post(f"{API}/auth/reset-password", json={"token": tok, "password": f"NewPass45{i}"}).status_code, range(6)))
        assert sorted(codes) == [200] + [400] * 5, codes

    def test_forgot_unsafe_name_no_500(self):
        """User-controlled name inside reset email html could trip email guard (ValueError)."""
        e = uniq()
        s().post(f"{API}/auth/register", json={"email": e, "password": "RightPass1", "name": "cvv"})
        r = s().post(f"{API}/auth/forgot-password", json={"email": e})
        assert r.status_code == 200 and r.json() == {"ok": True}, f"{r.status_code} {r.text}"
