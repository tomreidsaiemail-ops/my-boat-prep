# Admin-created template lists: /api/admin/template-lists CRUD and their exposure via GET /api/templates
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = "test_session_admin_1"
FREE = "test_session_free_1"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def test_template_list_lifecycle():
    a = s(ADMIN)
    r = a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_Prep your trip", "items": ["Weather", " weather ", "Fuel", ""]})
    assert r.status_code == 200
    t = r.json()
    assert t["id"].startswith("tpl_") and [i["label"] for i in t["items"]] == ["Weather", "Fuel"]
    try:
        assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "test_prep YOUR trip", "items": ["x"]}).status_code == 400
        assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "Leaving Dock", "items": ["x"]}).status_code == 400
        assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_empty", "items": [" "]}).status_code == 400
        assert s(FREE).post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_x", "items": ["x"]}).status_code == 403

        u = a.put(f"{BASE_URL}/api/admin/template-lists/{t['id']}", json={"name": "TEST_Prep your trip", "items": ["Fuel", "Water", "Weather"]}).json()
        ids = {i["label"]: i["id"] for i in u["items"]}
        assert ids["Weather"] == 1 and ids["Fuel"] == 2 and ids["Water"] == 3 and u["updated_at"] > t["updated_at"]

        got = s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"][t["id"]]
        assert got["custom"] and got["name"] == "TEST_Prep your trip" and len(got["items"]) == 3
        assert a.put(f"{BASE_URL}/api/admin/templates/{t['id']}", json={"items": [{"id": 9, "label": "Only"}]}).status_code == 200
        assert "leavingDock" not in [k for k, v in s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"].items() if v.get("custom")]
    finally:
        assert a.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}").status_code == 200
    assert a.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}").status_code == 404
    assert t["id"] not in s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"]
