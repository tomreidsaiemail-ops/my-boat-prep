# Crew Watch Rota: PUT/DELETE /api/boats/{id}/watch-rota, GET crew watch_rota, GET /crew/voyage rota
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, BETA = "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
PRO_ID, BETA_ID = "test-user-pro", "test-user-beta"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_rota"
T0 = "2026-01-01T00:00:00Z"


def s(tok=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    return ss


def state():
    data = {"safety": [{"id": 1, "label": "Lifejackets", "checked": False, "ts": T0}]}
    return {"boat": {"vessel": "TEST_RotaBoat", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "o@example.com"},
            "registry": [{"id": "safety", "name": "Safety Offshore", "isSystem": True}], "data": data, "updated_at": T0,
            "list_ts": {k: T0 for k in data}, "sec_ts": {"boat": T0, "registry": T0}}


def rota(**kw):
    r = {"start": "2026-02-01T14:30", "hours": 12, "per_watch": 1,
         "people": [{"id": PRO_ID, "name": "Pro Tester", "roles": ["Skipper"]}, {"id": BETA_ID, "name": "Beta Tester", "roles": ["Navigator"]}],
         "slots": [{"start": "2026-02-01T14:30", "end": "2026-02-01T16:00", "watch": "Afternoon", "people": [0]},
                   {"start": "2026-02-01T16:00", "end": "2026-02-01T18:00", "watch": "First Dog", "people": [1]}]}
    r.update(kw)
    return r


URL = f"{BASE_URL}/api/boats/{BOAT}/watch-rota"


@pytest.fixture(scope="module", autouse=True)
def setup():
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    assert s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT}, json=state()).status_code == 200
    DB.user_boats.update_one({"owner_id": PRO_ID, "boat_id": BOAT}, {"$addToSet": {"crew": BETA_ID}})
    yield
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


def test_save_and_get_crew_watch_rota():
    r = s(PRO).put(URL, json=rota())
    assert r.status_code == 200, r.text
    wr = r.json()["watch_rota"]
    assert wr["start"] == "2026-02-01T14:30" and wr["hours"] == 12 and wr["per_watch"] == 1
    assert isinstance(wr["updated_at"], str)
    g = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()
    assert g["watch_rota"]["slots"][1]["watch"] == "First Dog"
    assert g["watch_rota"]["people"][1]["roles"] == ["Navigator"]
    assert "_id" not in g["watch_rota"]


def test_crew_voyage_returns_rota():
    r = s(BETA).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT})
    assert r.status_code == 200
    assert r.json()["rota"]["slots"][0]["people"] == [0]
    assert r.json()["rota"]["people"][1]["id"] == BETA_ID


def test_overwrite_rota():
    r = s(PRO).put(URL, json=rota(per_watch=2, hours=24, slots=[{"start": "2026-02-01T14:30", "end": "2026-02-01T16:00", "watch": "Afternoon", "people": [0, 1]}]))
    assert r.status_code == 200
    g = s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["watch_rota"]
    assert g["per_watch"] == 2 and g["hours"] == 24 and len(g["slots"]) == 1 and g["slots"][0]["people"] == [0, 1]


@pytest.mark.parametrize("idx", [[2], [-1], [0, 5]])
def test_person_index_out_of_range_400(idx):
    bad = rota(slots=[{"start": "2026-02-01T14:30", "end": "2026-02-01T16:00", "watch": "Afternoon", "people": idx}])
    r = s(PRO).put(URL, json=bad)
    assert r.status_code == 400
    assert "isn't on it" in r.json()["detail"]


@pytest.mark.parametrize("patch", [
    {"start": "2026-02-01 14:30"}, {"start": "2026-02-01T14:30:00"}, {"start": "01/02/2026"},
    {"hours": 0}, {"hours": 337}, {"per_watch": 0}, {"per_watch": 3}, {"people": []}, {"slots": []},
    {"slots": [{"start": "2026-02-01T14:30", "end": "bad", "watch": "Afternoon", "people": [0]}]},
    {"slots": [{"start": "2026-02-01T14:30", "end": "2026-02-01T16:00", "watch": "Afternoon", "people": [0, 1, 0]}]},
])
def test_bad_formats_422(patch):
    assert s(PRO).put(URL, json=rota(**patch)).status_code == 422


def test_non_owner_and_unauth():
    assert s(BETA).put(URL, json=rota()).status_code == 404
    assert s(BETA).delete(URL).status_code == 404
    assert s().put(URL, json=rota()).status_code == 401
    assert s(BETA).get(f"{BASE_URL}/api/boats/{BOAT}/crew").status_code == 404


def test_delete_rota():
    assert s(PRO).put(URL, json=rota()).status_code == 200
    r = s(PRO).delete(URL)
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert s(PRO).get(f"{BASE_URL}/api/boats/{BOAT}/crew").json()["watch_rota"] is None
    v = s(BETA).get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": PRO_ID, "boat_id": BOAT}).json()
    assert v["rota"] is None and v["notes"] == ""


def test_unknown_boat_404():
    assert s(PRO).put(f"{BASE_URL}/api/boats/TEST_nope_xyz/watch-rota", json=rota()).status_code == 404
