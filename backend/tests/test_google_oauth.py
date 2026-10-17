# Own Google OAuth (authorization-code) sign-in: POST /api/auth/google validation + legacy endpoint removal + seeded sessions
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
GOOD_REDIRECT = f"{BASE_URL}/auth/google"


class TestGoogleOAuth:
    @pytest.mark.parametrize("uri", [
        "https://evil.com/steal",
        BASE_URL.replace("https://", "http://") + "/auth/google",
        BASE_URL,
        BASE_URL + "/",
        BASE_URL + "/auth/google/",
        BASE_URL + "/auth/google?x=1",
        "javascript:alert(1)",
        "",
    ])
    def test_bad_redirect_400(self, uri):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"code": "abcdefghijklmnop", "redirect_uri": uri})
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == "Invalid redirect address"

    def test_fake_code_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"code": "4/fake_code_1234567890", "redirect_uri": GOOD_REDIRECT})
        assert r.status_code == 401, r.text
        assert r.json()["detail"] == "Google sign-in failed, please try again"
        assert "session_token" not in r.cookies

    def test_short_code_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"code": "short", "redirect_uri": GOOD_REDIRECT})
        assert r.status_code == 422

    def test_missing_fields_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={})
        assert r.status_code == 422

    def test_long_redirect_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"code": "abcdefghijkl", "redirect_uri": "https://a.com/" + "x" * 400})
        assert r.status_code == 422

    def test_legacy_session_endpoint_removed(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": "abc"}, headers={"X-Session-ID": "abc"})
        assert r.status_code in (404, 405)

    @pytest.mark.parametrize("token,email,admin", [
        ("test_session_admin_1", "tomreidsaiemail@gmail.com", True),
        ("test_session_free_1", "test.user.free@example.com", False),
        ("test_session_pro_1", "test.user.pro@example.com", False),
        ("test_session_beta_1", "test.user.beta@example.com", False),
    ])
    def test_seeded_sessions_cookie(self, token, email, admin):
        r = requests.get(f"{BASE_URL}/api/auth/me", cookies={"session_token": token})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email and d["is_admin"] is admin

    def test_admin_users_with_cookie(self):
        r = requests.get(f"{BASE_URL}/api/admin/users", cookies={"session_token": "test_session_admin_1"})
        assert r.status_code == 200 and isinstance(r.json(), list)
        r = requests.get(f"{BASE_URL}/api/admin/users", cookies={"session_token": "test_session_free_1"})
        assert r.status_code == 403

    def test_me_unauth_401(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401
