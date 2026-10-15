"""Skipper's Tips master list: GET /api/tips (any user), PUT /api/admin/tips (admin only), email PDF with tips."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TOK = {"admin": "test_session_admin_1", "free": "test_session_free_1", "pro": "test_session_pro_1", "beta": "test_session_beta_1"}


def H(who):
    return {"Authorization": f"Bearer {TOK[who]}"}


@pytest.fixture(scope="module", autouse=True)
def preserve_tips():
    original = requests.get(f"{API}/tips", headers=H("admin"), timeout=15).json()["items"]
    yield original
    r = requests.put(f"{API}/admin/tips", json={"items": original}, headers=H("admin"), timeout=15)
    assert r.status_code == 200


# GET /api/tips auth
class TestTips:
    def test_unauth_401(self):
        assert requests.get(f"{API}/tips", timeout=15).status_code == 401

    @pytest.mark.parametrize("who", ["admin", "free", "pro", "beta"])
    def test_any_user_reads_same(self, who):
        r = requests.get(f"{API}/tips", headers=H(who), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"items", "updated_at"}
        assert isinstance(d["items"], list)
        assert d == requests.get(f"{API}/tips", headers=H("admin"), timeout=15).json()


    # PUT /api/admin/tips authorization + validation (same class -> same xdist worker; avoids races)
    def test_put_unauth_401(self):
        assert requests.put(f"{API}/admin/tips", json={"items": []}, timeout=15).status_code == 401

    @pytest.mark.parametrize("who", ["free", "pro", "beta"])
    def test_non_admin_403(self, who):
        r = requests.put(f"{API}/admin/tips", json={"items": [{"id": 1, "label": "TEST_hack"}]}, headers=H(who), timeout=15)
        assert r.status_code == 403
        labels = [t["label"] for t in requests.get(f"{API}/tips", headers=H(who), timeout=15).json()["items"]]
        assert "TEST_hack" not in labels

    def test_admin_save_persists_order_and_strips(self, preserve_tips):
        items = [{"id": "b", "label": "  TEST_second  "}, {"id": 1, "label": "TEST_first"}, {"id": 3, "label": "   "}]
        r = requests.put(f"{API}/admin/tips", json={"items": items}, headers=H("admin"), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["items"] == [{"id": "b", "label": "TEST_second"}, {"id": 1, "label": "TEST_first"}]
        assert d["updated_at"]
        got = requests.get(f"{API}/tips", headers=H("free"), timeout=15).json()
        assert got["items"] == d["items"]
        assert got["updated_at"] == d["updated_at"]

    def test_empty_label_dropped_or_422(self):
        r = requests.put(f"{API}/admin/tips", json={"items": [{"id": 1, "label": ""}]}, headers=H("admin"), timeout=15)
        # min_length=1 -> empty string rejected with 422; whitespace-only is dropped (tested above)
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            assert r.json()["items"] == []

    def test_label_too_long_422(self):
        r = requests.put(f"{API}/admin/tips", json={"items": [{"id": 1, "label": "x" * 501}]}, headers=H("admin"), timeout=15)
        assert r.status_code == 422

    def test_label_500_ok(self):
        r = requests.put(f"{API}/admin/tips", json={"items": [{"id": 1, "label": "x" * 500}]}, headers=H("admin"), timeout=15)
        assert r.status_code == 200

    def test_missing_items_422(self):
        assert requests.put(f"{API}/admin/tips", json={}, headers=H("admin"), timeout=15).status_code == 422

    def test_too_many_items_422(self):
        items = [{"id": i, "label": f"TEST_{i}"} for i in range(301)]
        assert requests.put(f"{API}/admin/tips", json={"items": items}, headers=H("admin"), timeout=15).status_code == 422

    def test_clear_all(self):
        r = requests.put(f"{API}/admin/tips", json={"items": []}, headers=H("admin"), timeout=15)
        assert r.status_code == 200 and r.json()["items"] == []
        assert requests.get(f"{API}/tips", headers=H("pro"), timeout=15).json()["items"] == []
