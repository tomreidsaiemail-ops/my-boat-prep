# Multiple boats API tests: GET/PUT /api/me/boat?boat_id, GET /api/me/boats, DELETE /api/me/boats/{id}, email-log boat_id
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = "test_session_pro_1"
BETA = "test_session_beta_1"
FREE = "test_session_free_1"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def state(vessel, callsign="TEST_CS", **extra):
    return {"boat": {"vessel": vessel, "skipper": "TEST_Sk", "callsign": callsign, "log_email": "test@example.com"},
            "registry": [{"id": "safety", "name": "Safety Offshore", "isSystem": True}, {"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
            "data": {"safety": [{"id": 1, "label": "Lifejackets", "checked": True}], "shipsLog": [{"id": 87, "label": "x", "checked": False}]},
            "updated_at": "2026-01-01T00:00:00Z", **extra}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    DB.user_boats.delete_many({"owner_id": {"$in": ["test-user-pro", "test-user-beta", "test-user-free"]}, "boat_id": {"$regex": "^TEST"}})


# Boat id validation and default main
class TestBoatId:
    def test_bad_boat_id_get_422(self):
        assert s(PRO).get(f"{BASE_URL}/api/me/boat", params={"boat_id": "bad id!"}).status_code == 422

    def test_bad_boat_id_put_422(self):
        assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": "x" * 41}, json=state("A")).status_code == 422

    def test_bad_boat_id_delete_422(self):
        assert s(PRO).delete(f"{BASE_URL}/api/me/boats/bad.id").status_code == 422

    def test_default_main(self):
        r = s(PRO).get(f"{BASE_URL}/api/me/boat")
        assert r.status_code == 200
        assert r.json()["boat_id"] == "main"
        assert "_id" not in r.json()

    def test_unknown_boat_404(self):
        assert s(PRO).get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_nope"}).status_code == 404

    def test_unauth_401(self):
        assert requests.get(f"{BASE_URL}/api/me/boats").status_code == 401


# Pro: create, list, keep-if-omitted, delete
class TestProBoats:
    def test_create_second_boat_and_list(self):
        c = s(PRO)
        r = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}, json=state("TEST_Bacchus", template_versions={"safety": "2026-01-01"}, emergency_checked={"mayDay": True}))
        assert r.status_code == 200, r.text
        assert r.json()["boat_id"] == "TEST_b2"
        g = c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}).json()
        assert g["boat"]["vessel"] == "TEST_Bacchus"
        assert g["registry"][0]["name"] == "Safety Offshore"
        main = c.get(f"{BASE_URL}/api/me/boat").json()
        assert main["boat"]["vessel"] != "TEST_Bacchus"
        boats = c.get(f"{BASE_URL}/api/me/boats").json()["boats"]
        assert boats[0]["boat_id"] == "main"
        assert {"boat_id": "TEST_b2", "vessel": "TEST_Bacchus"} in [{"boat_id": b["boat_id"], "vessel": b["vessel"]} for b in boats]

    def test_list_order_by_created(self):
        c = s(PRO)
        c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b3"}, json=state("TEST_Third"))
        ids = [b["boat_id"] for b in c.get(f"{BASE_URL}/api/me/boats").json()["boats"]]
        assert ids[0] == "main"
        assert ids.index("TEST_b2") < ids.index("TEST_b3")

    def test_keep_when_omitted(self):
        c = s(PRO)
        r = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}, json=state("TEST_Bacchus"))
        assert r.status_code == 200
        g = c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}).json()
        assert g["template_versions"] == {"safety": "2026-01-01"}
        assert g["emergency_checked"] == {"mayDay": True}

    def test_saved_when_present(self):
        c = s(PRO)
        c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}, json=state("TEST_Bacchus", template_versions={}, emergency_checked={"panPan": False}))
        g = c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b2"}).json()
        assert g["template_versions"] == {}
        assert g["emergency_checked"] == {"panPan": False}

    def test_email_log_uses_boat_details(self):
        c = s(PRO)
        c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b3"}, json=state("TEST_Third", callsign=""))
        r = c.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "Monday 1 Jan", "boat_id": "TEST_b3"})
        assert r.status_code == 400
        assert "vessel details" in r.json()["detail"]
        r = c.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "Monday 1 Jan", "boat_id": "TEST_missing"})
        assert r.status_code == 404
        r = c.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "Monday 1 Jan", "boat_id": "bad id"})
        assert r.status_code == 422

    def test_delete_unknown_404(self):
        assert s(PRO).delete(f"{BASE_URL}/api/me/boats/TEST_unknown").status_code == 404

    def test_delete_boat(self):
        c = s(PRO)
        r = c.delete(f"{BASE_URL}/api/me/boats/TEST_b3")
        assert r.status_code == 200 and r.json()["ok"] is True
        assert c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_b3"}).status_code == 404
        r = c.delete(f"{BASE_URL}/api/me/boats/TEST_b2")
        assert r.status_code == 200
        ids = [b["boat_id"] for b in c.get(f"{BASE_URL}/api/me/boats").json()["boats"]]
        assert ids == ["main"]

    def test_delete_last_boat_400(self):
        r = s(PRO).delete(f"{BASE_URL}/api/me/boats/main")
        assert r.status_code == 400
        assert s(PRO).get(f"{BASE_URL}/api/me/boat").status_code == 200


# Free tier: one boat only
class TestFree:
    def test_free_second_boat_403(self):
        c = s(FREE)
        r = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_free2"}, json=state("TEST_FreeBoat"))
        assert r.status_code == 403
        assert DB.user_boats.count_documents({"owner_id": "test-user-free", "boat_id": "TEST_free2"}) == 0

    def test_free_existing_main_ok(self):
        c = s(FREE)
        cur = c.get(f"{BASE_URL}/api/me/boat").json()
        cur.pop("owner_id"); cur.pop("boat_id"); cur.pop("synced_at")
        assert c.put(f"{BASE_URL}/api/me/boat", json=cur).status_code == 200

    def test_free_boats_list(self):
        boats = s(FREE).get(f"{BASE_URL}/api/me/boats").json()["boats"]
        assert [b["boat_id"] for b in boats] == ["main"]
