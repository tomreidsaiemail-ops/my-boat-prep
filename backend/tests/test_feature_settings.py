# Feature Settings: PUT /api/me/features (show_sundowners) and /api/auth/me exposure
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}


@pytest.fixture
def restore_pro():
    before = requests.get(f"{BASE_URL}/api/auth/me", headers=PRO).json().get("show_sundowners", False)
    yield
    requests.put(f"{BASE_URL}/api/me/features", headers=PRO, json={"show_sundowners": before})


def test_me_has_show_sundowners_bool():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=FREE)
    assert r.status_code == 200
    assert isinstance(r.json().get("show_sundowners"), bool)


def test_set_true_then_false_persists(restore_pro):
    r = requests.put(f"{BASE_URL}/api/me/features", headers=PRO, json={"show_sundowners": True})
    assert r.status_code == 200 and r.json()["show_sundowners"] is True
    assert requests.get(f"{BASE_URL}/api/auth/me", headers=PRO).json()["show_sundowners"] is True
    r = requests.put(f"{BASE_URL}/api/me/features", headers=PRO, json={"show_sundowners": False})
    assert r.status_code == 200 and r.json()["show_sundowners"] is False
    assert requests.get(f"{BASE_URL}/api/auth/me", headers=PRO).json()["show_sundowners"] is False


def test_unauthenticated_rejected():
    r = requests.put(f"{BASE_URL}/api/me/features", json={"show_sundowners": True})
    assert r.status_code == 401


def test_invalid_body_422():
    r = requests.put(f"{BASE_URL}/api/me/features", headers=PRO, json={})
    assert r.status_code == 422
    r = requests.put(f"{BASE_URL}/api/me/features", headers=PRO, json={"show_sundowners": "notbool"})
    assert r.status_code == 422

