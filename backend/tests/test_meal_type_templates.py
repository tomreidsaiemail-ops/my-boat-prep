# Admin master template for mealPlan keeps meal_type on items; invalid meal_type is rejected
import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _restore(db, prev):
    if prev:
        db.list_templates.replace_one({"list_id": "mealPlan"}, prev)
    else:
        db.list_templates.delete_one({"list_id": "mealPlan"})


def test_meal_type_kept_on_master_template():
    db = _db()
    prev = db.list_templates.find_one({"list_id": "mealPlan"}, {"_id": 0})
    items = [
        {"id": 1, "label": "1. Curry", "meal_type": "dinner"},
        {"id": 2, "label": "[Cook it]", "indent": True},
        {"id": 3, "label": "100g rice", "indent": True},
        {"id": 4, "label": "2. Brownie", "meal_type": "dessert"},
        {"id": 5, "label": "[Warm it]", "indent": True},
        {"id": 6, "label": "3. Pasta"},
        {"id": 7, "label": "[Boil]", "indent": True},
    ]
    try:
        r = requests.put(f"{BASE_URL}/api/admin/templates/mealPlan", json={"items": items}, headers=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        stored = db.list_templates.find_one({"list_id": "mealPlan"}, {"_id": 0})
        by_id = {i["id"]: i for i in stored["items"]}
        assert by_id[1]["meal_type"] == "dinner"
        assert by_id[4]["meal_type"] == "dessert"
        assert "meal_type" not in by_id[6]
        assert "meal_type" not in by_id[2]
        t = requests.get(f"{BASE_URL}/api/templates", headers=PRO, timeout=30)
        if t.status_code == 200 and "mealPlan" in t.json():
            got = {i["id"]: i for i in t.json()["mealPlan"]["items"]}
            assert got[1].get("meal_type") == "dinner"
    finally:
        _restore(db, prev)


def test_invalid_meal_type_rejected():
    db = _db()
    prev = db.list_templates.find_one({"list_id": "mealPlan"}, {"_id": 0})
    try:
        r = requests.put(f"{BASE_URL}/api/admin/templates/mealPlan", json={"items": [{"id": 1, "label": "1. Curry", "meal_type": "brunch"}, {"id": 2, "label": "[x]", "indent": True}]}, headers=ADMIN, timeout=30)
        assert r.status_code == 422
    finally:
        _restore(db, prev)


def test_meal_type_requires_admin():
    r = requests.put(f"{BASE_URL}/api/admin/templates/mealPlan", json={"items": [{"id": 1, "label": "1. Curry", "meal_type": "dinner"}]}, headers=PRO, timeout=30)
    assert r.status_code in (401, 403)
