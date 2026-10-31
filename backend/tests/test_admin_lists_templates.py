# Iteration 64: admin-lists prefix endpoint, 4000-char description limits, owner list_hidden regression
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}


# GET /api/admin-lists
class TestAdminLists:
    @pytest.mark.parametrize("prefix", ["Admin - List Template - ", "Admin - List Template -", "admin  -  list template -"])
    def test_templates_prefix_variants(self, prefix):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": prefix}, headers=PRO)
        assert r.status_code == 200, r.text
        names = [l["name"] for l in r.json()["lists"]]
        assert "Admin - List Template - Meal Plan Template" in names
        assert "Admin - List Template - Night Passage" in names
        assert all(n.lower().startswith("admin - list template -") for n in names)
        meal = next(l for l in r.json()["lists"] if l["name"].endswith("Meal Plan Template"))
        assert any("<Your Favorite TV Celebrities>" in i["label"] for i in meal["items"])

    def test_help_panel(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel - "}, headers=FREE)
        assert r.status_code == 200
        lists = r.json()["lists"]
        help_ = next(l for l in lists if l["name"] == "Admin - Help Panel - Batch Magic Scan button")
        assert len(help_["items"]) >= 5
        assert isinstance(help_["items"][0]["label"], str)

    def test_unknown_prefix(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Food"}, headers=PRO)
        assert r.status_code == 400

    def test_missing_prefix(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", headers=PRO)
        assert r.status_code == 422

    def test_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel - "})
        assert r.status_code == 401


# POST /api/ai/list-draft validation (no real LLM calls: only invalid payloads)
class TestDraftLimits:
    def test_over_4000_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-draft", json={"name": "X", "description": "a" * 4001}, headers=PRO)
        assert r.status_code == 422

    def test_topup_over_4000_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-topup", json={"name": "X", "description": "a" * 4001, "items": []}, headers=PRO)
        assert r.status_code in (404, 422)


# Admin template list description 4000
class TestTemplateListDescription:
    def test_create_4000_and_reject_4001(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_it64 desc", "description": "d" * 4001, "items": ["a"], "private": True}, headers=ADMIN)
        assert r.status_code == 422
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_it64 desc", "description": "d" * 4000, "items": ["a"], "private": True}, headers=ADMIN)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
        mine = next(l for l in lists if l.get("id") == lid)
        assert len(mine["description"]) == 4000
        d = requests.delete(f"{BASE_URL}/api/admin/template-lists/{lid}", headers=ADMIN)
        assert d.status_code in (200, 204)


# Owner list_hidden + 4000-char registry description persist in boat state
class TestOwnerBoat:
    def test_registry_description_4000_and_hidden(self):
        boat = requests.get(f"{BASE_URL}/api/me/boat", headers=PRO)
        assert boat.status_code == 200
        state = boat.json()
        orig = {k: state.get(k) for k in ("registry", "list_hidden")}
        reg = list(state["registry"]) + [{"id": "custom_it64test", "name": "TEST_it64", "isSystem": False, "description": "z" * 4000}]
        body = {**state, "registry": reg, "list_hidden": ["custom_it64test"]}
        body.pop("synced_at", None)
        r = requests.put(f"{BASE_URL}/api/me/boat", json=body, headers=PRO)
        assert r.status_code == 200, r.text[:300]
        got = requests.get(f"{BASE_URL}/api/me/boat", headers=PRO).json()
        row = next(l for l in got["registry"] if l["id"] == "custom_it64test")
        assert len(row["description"]) == 4000
        assert got["list_hidden"] == ["custom_it64test"]
        # restore
        body2 = {**got, **orig}
        body2.pop("synced_at", None)
        r = requests.put(f"{BASE_URL}/api/me/boat", json=body2, headers=PRO)
        assert r.status_code == 200
        fin = requests.get(f"{BASE_URL}/api/me/boat", headers=PRO).json()
        assert not any(l["id"] == "custom_it64test" for l in fin["registry"])
        assert fin.get("list_hidden") == orig["list_hidden"]
