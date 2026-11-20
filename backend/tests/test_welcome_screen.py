# Welcome screen API: questions, visits, Global Config force line, answers -> /auth/me welcome_no
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
H = {"Authorization": "Bearer test_session_admin_1"}
KEYS = ["find", "crew", "trip", "racer", "sell", "lend", "fish", "provision"]
CFG = {"custom": True, "name": {"$regex": r"^\s*admin - global config\s*$", "$options": "i"}}


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    d = c[os.environ.get("DB_NAME", "test_database")]
    d.users.update_one({"user_id": "test-admin-1"}, {"$unset": {"welcome": ""}})
    yield d
    d.users.update_one({"user_id": "test-admin-1"}, {"$unset": {"welcome": ""}})
    d.list_templates.update_one({**CFG, "items.label": {"$regex": "^Force Welcome"}}, {"$set": {"items.$.label": "Force Welcome screen visit, 1"}})


def test_auth_required():
    assert requests.get(f"{BASE_URL}/api/welcome").status_code == 401


def test_get_welcome_fresh(mdb):
    r = requests.get(f"{BASE_URL}/api/welcome", headers=H)
    assert r.status_code == 200
    d = r.json()
    assert [q["key"] for q in d["questions"]] == KEYS
    assert all(q["bullets"] for q in d["questions"])
    trip = next(q for q in d["questions"] if q["key"] == "trip")
    assert len(trip["notes"]) == 1
    assert sum(len(q["notes"]) for q in d["questions"]) == 1
    assert d["force"] == 1 and d["due"] is True and d["first"] is True
    assert d["answers"] == {} and d["mv_ack"] is False


def test_visited_then_not_due(mdb):
    r = requests.post(f"{BASE_URL}/api/welcome/visited", headers=H)
    assert r.status_code == 200 and r.json()["visit"] == 1
    d = requests.get(f"{BASE_URL}/api/welcome", headers=H).json()
    assert d["due"] is False and d["first"] is False


def test_save_answers_and_me(mdb):
    r = requests.put(f"{BASE_URL}/api/welcome", headers=H, json={"answers": {"fish": "no", "find": "yes"}, "mv_ack": True})
    assert r.status_code == 200
    d = requests.get(f"{BASE_URL}/api/welcome", headers=H).json()
    assert d["answers"] == {"fish": "no", "find": "yes"} and d["mv_ack"] is True
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H).json()
    assert me["welcome_no"] == ["fish"]
    # flip fish to yes -> no longer hidden
    requests.put(f"{BASE_URL}/api/welcome", headers=H, json={"answers": {"fish": "yes"}})
    assert requests.get(f"{BASE_URL}/api/auth/me", headers=H).json()["welcome_no"] == []


def test_invalid_answer_value(mdb):
    r = requests.put(f"{BASE_URL}/api/welcome", headers=H, json={"answers": {"fish": "maybe"}})
    assert r.status_code == 422


def test_bad_key_ignored(mdb):
    r = requests.put(f"{BASE_URL}/api/welcome", headers=H, json={"answers": {"$where": "no", "a.b": "no"}})
    assert r.status_code == 200
    d = requests.get(f"{BASE_URL}/api/welcome", headers=H).json()
    assert "$where" not in d["answers"] and "a.b" not in d["answers"] and "a" not in d["answers"]


def test_force_raise_makes_due(mdb):
    res = mdb.list_templates.update_one({**CFG, "items.label": {"$regex": "^Force Welcome"}}, {"$set": {"items.$.label": "Force Welcome screen visit, 2"}})
    assert res.matched_count == 1
    d = requests.get(f"{BASE_URL}/api/welcome", headers=H).json()
    assert d["force"] == 2 and d["due"] is True and d["first"] is False
    requests.post(f"{BASE_URL}/api/welcome/visited", headers=H)
    assert requests.get(f"{BASE_URL}/api/welcome", headers=H).json()["due"] is False
    mdb.list_templates.update_one({**CFG, "items.label": {"$regex": "^Force Welcome"}}, {"$set": {"items.$.label": "Force Welcome screen visit, 1"}})
    d = requests.get(f"{BASE_URL}/api/welcome", headers=H).json()
    assert d["force"] == 1 and d["due"] is False
