# Admin - Global Config: starting Model Vessel wizard config list (seeded at startup)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LINE = "Starting Model Vessel Wizard, Admin - Model Vessel - Basic Introduction Walkthrough"


@pytest.mark.parametrize("token", ["test_session_beta_1", "test_session_pro_1", "test_session_free_1"])
def test_global_config_list(token):
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Global Config"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    lists = r.json()["lists"]
    gc = [l for l in lists if l["name"] == "Admin - Global Config"]
    assert len(gc) == 1
    assert LINE in [i["label"] for i in gc[0]["items"]]


def test_model_vessel_prefix_not_including_config():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Model Vessel"}, headers={"Authorization": "Bearer test_session_pro_1"})
    assert r.status_code == 200
    names = [l["name"] for l in r.json()["lists"]]
    assert "Admin - Model Vessel - Basic Introduction Walkthrough" in names
    assert "Admin - Global Config" not in names


def test_wizards_mine():
    r = requests.get(f"{BASE_URL}/api/wizards/mine", headers={"Authorization": "Bearer test_session_pro_1"})
    assert r.status_code == 200
    assert isinstance(r.json()["finished"], list)


def test_unauth_admin_lists():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Global Config"})
    assert r.status_code in (200, 401)
