# List categories (Admin - List Categories) + list_hidden boat field persistence/merge
import os
import copy
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
H = lambda who: {"Authorization": f"Bearer test_session_{who}_1"}


def now():
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def original():
    r = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20)
    assert r.status_code == 200
    doc = r.json()
    yield doc
    # restore list_hidden
    body = {k: doc[k] for k in ("boat", "registry", "data", "log_sent", "engine_log", "electrical_log", "deleted_lists",
                                "emergency_checked", "template_versions", "list_ts", "areas")}
    body["list_hidden"] = doc.get("list_hidden", [])
    body["updated_at"] = now()
    body["sec_ts"] = {**doc.get("sec_ts", {}), "list_hidden": now()}
    requests.put(f"{API}/me/boat", json=body, headers=H("pro"), timeout=20)


# GET /api/list-categories
class TestCategories:
    def test_requires_auth(self):
        assert requests.get(f"{API}/list-categories", timeout=20).status_code == 401

    @pytest.mark.parametrize("who", ["free", "pro", "admin"])
    def test_items(self, who):
        r = requests.get(f"{API}/list-categories", headers=H(who), timeout=20)
        assert r.status_code == 200
        labels = [i["label"] for i in r.json()["items"]]
        assert any("Provisioning and Inventory" in l for l in labels)
        assert "*Brown*" in labels and "Engine Service" in labels
        assert all(set(i.keys()) == {"label"} for i in r.json()["items"])


# list_hidden persistence on PUT/GET /api/me/boat
class TestListHidden:
    def _body(self, doc, hidden=None, stamp=True):
        body = {k: copy.deepcopy(doc[k]) for k in ("boat", "registry", "data", "log_sent", "engine_log", "electrical_log",
                                                    "deleted_lists", "emergency_checked", "template_versions", "list_ts", "areas")}
        body["updated_at"] = now()
        body["sec_ts"] = dict(doc.get("sec_ts", {}))
        if hidden is not None:
            body["list_hidden"] = hidden
            if stamp:
                body["sec_ts"]["list_hidden"] = now()
        return body

    def test_set_hidden(self, original):
        r = requests.put(f"{API}/me/boat", json=self._body(original, ["TEST_hidden_a", "safety"]), headers=H("pro"), timeout=20)
        assert r.status_code == 200
        assert r.json()["list_hidden"] == ["TEST_hidden_a", "safety"]
        g = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20).json()
        assert g["list_hidden"] == ["TEST_hidden_a", "safety"]

    def test_omitted_keeps(self, original):
        r = requests.put(f"{API}/me/boat", json=self._body(original), headers=H("pro"), timeout=20)
        assert r.status_code == 200
        assert "TEST_hidden_a" in r.json()["list_hidden"]

    def test_stale_stamp_loses(self, original):
        body = self._body(original, [], stamp=False)
        body["sec_ts"]["list_hidden"] = "2000-01-01T00:00:00+00:00"
        r = requests.put(f"{API}/me/boat", json=body, headers=H("pro"), timeout=20)
        assert r.status_code == 200
        assert "TEST_hidden_a" in r.json()["list_hidden"]

    def test_category_on_registry_persists(self, original):
        body = self._body(original, original.get("list_hidden", []))
        body["registry"] = body["registry"] + [{"id": "custom_TEST_cat", "name": "TEST cat list", "isSystem": False, "category": "Safety"}]
        body["data"]["custom_TEST_cat"] = []
        body["list_ts"] = {**body.get("list_ts", {})}
        body["sec_ts"]["registry"] = now()
        r = requests.put(f"{API}/me/boat", json=body, headers=H("pro"), timeout=20)
        assert r.status_code == 200
        reg = requests.get(f"{API}/me/boat", headers=H("pro"), timeout=20).json()["registry"]
        row = next((l for l in reg if l["id"] == "custom_TEST_cat"), None)
        assert row and row["category"] == "Safety"
        # cleanup
        body["registry"] = [l for l in body["registry"] if l["id"] != "custom_TEST_cat"]
        body["data"].pop("custom_TEST_cat")
        body["deleted_lists"] = body.get("deleted_lists", [])
        body["sec_ts"]["registry"] = now()
        body["updated_at"] = now()
        r = requests.put(f"{API}/me/boat", json=body, headers=H("pro"), timeout=20)
        assert all(l["id"] != "custom_TEST_cat" for l in r.json()["registry"])
