# Behave Like First Time: POST /api/me/first-time-reset
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _s(tok=None):
    s = requests.Session()
    if tok:
        s.cookies.set("session_token", tok)
    return s


def test_reset_requires_auth():
    r = _s().post(f"{BASE_URL}/api/me/first-time-reset")
    assert r.status_code == 401


def test_untagged_admin_no_reset():
    r = _s("test_session_admin_1").post(f"{BASE_URL}/api/me/first-time-reset")
    assert r.status_code == 200
    assert r.json() == {"reset": False}


def test_untagged_crew_no_reset():
    r = _s("test_session_welcome_crew").post(f"{BASE_URL}/api/me/first-time-reset")
    assert r.status_code == 200
    assert r.json()["reset"] is False


def test_tagged_user_reset_true_and_welcome_cleared():
    s = _s("test_session_welcome_new")
    r = s.post(f"{BASE_URL}/api/me/first-time-reset")
    assert r.status_code == 200
    assert r.json()["reset"] is True
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    assert not me.get("welcome")
