# Master templates API tests: GET /api/templates, PUT /api/admin/templates/{list_id}
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = "test_session_admin_1"
PRO = "test_session_pro_1"
FREE = "test_session_free_1"

MAYDAY_OK = [
    {"id": "v", "label": "This is vessel", "dynamic": "maydayVessel"},
    {"id": "c", "label": "Callsign", "dynamic": "maydayCallsign"},
    {"id": "vc", "label": "Vessel callsign", "dynamic": "maydayVesselCallsign"},
    {"id": "g", "label": "GPS", "dynamic": "maydayGps"},
    {"id": "x", "label": "Over"},
]


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def put(tok, lid, items):
    return s(tok).put(f"{BASE_URL}/api/admin/templates/{lid}", json={"items": items})


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    from pymongo import MongoClient
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    MongoClient(env["MONGO_URL"])[env["DB_NAME"]].list_templates.delete_many({})


# GET templates
class TestGet:
    def test_get_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/templates").status_code == 401

    @pytest.mark.parametrize("tok", [ADMIN, PRO, FREE])
    def test_get_any_user(self, tok):
        r = s(tok).get(f"{BASE_URL}/api/templates")
        assert r.status_code == 200
        assert isinstance(r.json()["templates"], dict)


# PUT admin templates
class TestPublish:
    def test_non_admin_forbidden(self):
        for tok in (PRO, FREE):
            assert put(tok, "safety", [{"id": 1, "label": "a"}]).status_code == 403

    @pytest.mark.parametrize("lid", ["myTodo", "shipsLog", "nope"])
    def test_404_lists(self, lid):
        assert put(ADMIN, lid, [{"id": 1, "label": "a"}]).status_code == 404

    def test_empty_items(self):
        assert put(ADMIN, "safety", []).status_code == 400
        assert put(ADMIN, "safety", [{"id": 1, "label": "   "}]).status_code == 400

    def test_mayday_missing_dynamic(self):
        r = put(ADMIN, "mayDay", MAYDAY_OK[1:])
        assert r.status_code == 400
        assert "must keep its vessel, callsign and GPS" in r.json()["detail"]

    def test_panpan_missing_gps(self):
        assert put(ADMIN, "panPan", [{"id": 1, "label": "Pan pan"}]).status_code == 400

    def test_dynamic_on_non_emergency(self):
        assert put(ADMIN, "safety", [{"id": 1, "label": "a", "dynamic": "maydayGps"}]).status_code == 400

    def test_mayday_dynamic_on_panpan(self):
        r = put(ADMIN, "panPan", [{"id": 1, "label": "g", "dynamic": "panPanGps"}, {"id": 2, "label": "v", "dynamic": "maydayVessel"}])
        assert r.status_code == 400

    def test_unknown_dynamic_422(self):
        assert put(ADMIN, "safety", [{"id": 1, "label": "a", "dynamic": "bogus"}]).status_code == 422

    def test_mayday_ok(self):
        r = put(ADMIN, "mayDay", MAYDAY_OK)
        assert r.status_code == 200
        assert len(r.json()["items"]) == 5

    def test_panpan_ok(self):
        r = put(ADMIN, "panPan", [{"id": 1, "label": "GPS", "dynamic": "panPanGps"}])
        assert r.status_code == 200

    def test_strip_and_dedupe_then_get(self):
        items = [{"id": 1, "label": "  TEST A  "}, {"id": 2, "label": ""}, {"id": 1, "label": "dup"}, {"id": "s3", "label": "TEST B"}]
        r = put(ADMIN, "safety", items)
        assert r.status_code == 200
        d = r.json()
        assert [i["label"] for i in d["items"]] == ["TEST A", "TEST B"]
        assert "updated_at" in d
        g = s(PRO).get(f"{BASE_URL}/api/templates").json()["templates"]
        assert g["safety"]["items"] == d["items"]
        assert "updated_by" not in g["safety"]
        # overwrite (upsert)
        r2 = put(ADMIN, "safety", [{"id": 9, "label": "TEST C"}])
        assert r2.status_code == 200
        g = s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"]
        assert [i["label"] for i in g["safety"]["items"]] == ["TEST C"]
