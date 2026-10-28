# Magic Marine Doctor, MPA aisle sorting and admin template per-group dedupe
import os
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
FOOTER = "This is first-aid guidance only. In an emergency call Mayday on VHF channel 16 or the coastguard, and get medical help as soon as you can."
AISLES = ["Fresh produce", "Bakery", "Meat & fish", "Dairy & eggs", "Pantry & dry goods", "Tins & jars", "Herbs, spices & sauces", "Frozen", "Drinks", "Household & galley"]


def _db():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l and not l.startswith("#"))
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


def _count(kind):
    return _db().ai_drafts.count_documents({"user_id": "test-user-pro", "kind": kind})


# ---- Doctor ----
def test_doctor_pro_answer_and_separate_quota():
    before = {k: _count(k) for k in ("doctor", "engine", "mpa", "draft")}
    r = requests.post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "A crew member has a deep cut on their hand", "kit_name": "First Aid Kit - basic for cruising",
                                                          "kit": ["Plasters", "Sterile dressings", "Antiseptic wipes"], "adults": 2, "children": 1}, headers=PRO, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    print(d["answer"][-300:], d["asks_left"])
    assert d["answer"].strip().endswith(FOOTER)
    assert isinstance(d["asks_left"], int)
    after = {k: _count(k) for k in before}
    assert after["doctor"] == before["doctor"] + 1
    assert after["engine"] == before["engine"] and after["mpa"] == before["mpa"] and after["draft"] == before["draft"]


def test_doctor_quota_independent():
    # Fill doctor quota with 20 fake docs -> doctor 429 but engine still allowed (not 429)
    db = _db()
    now = datetime.now(timezone.utc).isoformat()
    db.ai_drafts.insert_many([{"draft_id": f"TEST_doc_{i}", "user_id": "test-user-pro", "kind": "doctor", "created_at": now} for i in range(20)])
    try:
        r = requests.post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "headache"}, headers=PRO, timeout=60)
        assert r.status_code == 429, r.text
        assert "Doctor" in r.json()["detail"]
        # Aisles validation still fine and lists quota unaffected: send invalid body to avoid an AI call -> 422 not 429
        r2 = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["  "], "aisles": AISLES}, headers=PRO, timeout=60)
        assert r2.status_code == 422
    finally:
        db.ai_drafts.delete_many({"draft_id": {"$regex": "^TEST_doc_"}})


def test_doctor_free_403():
    r = requests.post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": "cut"}, headers=FREE, timeout=30)
    assert r.status_code == 403


@pytest.mark.parametrize("q", ["", "   ", "x" * 1025])
def test_doctor_validation_422(q):
    r = requests.post(f"{BASE_URL}/api/ai/doctor-ask", json={"question": q}, headers=PRO, timeout=30)
    assert r.status_code == 422, r.text


# ---- Aisles ----
def test_aisles_pro():
    items = ["Pesto", "Sweetcorn", "Firelighters"]
    r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": items, "aisles": AISLES}, headers=PRO, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    print(d)
    assert set(d["aisles"]).issubset(set(items))
    assert all(v in AISLES for v in d["aisles"].values())
    assert isinstance(d["drafts_left"], int)


def test_aisles_free_403():
    r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json={"items": ["Pesto"], "aisles": AISLES}, headers=FREE, timeout=30)
    assert r.status_code == 403


@pytest.mark.parametrize("body", [{"items": [], "aisles": AISLES}, {"items": ["Pesto"], "aisles": []}, {"items": [" "], "aisles": AISLES}, {"items": ["Pesto"], "aisles": [" "]}])
def test_aisles_422(body):
    r = requests.post(f"{BASE_URL}/api/ai/mpa/aisles", json=body, headers=PRO, timeout=30)
    assert r.status_code == 422, r.text


# ---- Admin templates ----
def test_template_list_per_group_dedupe():
    items = [{"label": "1. Curry"}, {"label": "Salt", "indent": True}, {"label": "Salt", "indent": True}, {"label": "Rice", "indent": True},
             {"label": "2. Pasta"}, {"label": "Salt", "indent": True}, {"label": "1. Curry"}, {"label": "Pepper", "indent": True}]
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_Meals Dedupe", "items": items}, headers=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    try:
        labels = [(i["label"], bool(i.get("indent"))) for i in r.json()["items"]]
        print(labels)
        assert labels.count(("Salt", True)) == 2
        assert labels.count(("1. Curry", False)) == 1
        ids = [i["id"] for i in r.json()["items"]]
        assert len(ids) == len(set(ids))
        # PUT keeps it too, unique ids
        r2 = requests.put(f"{BASE_URL}/api/admin/template-lists/{lid}", json={"name": "TEST_Meals Dedupe", "items": items + [{"label": "3. Stew"}, {"label": "Salt", "indent": True}]}, headers=ADMIN, timeout=30)
        assert r2.status_code == 200, r2.text
        labels2 = [i["label"] for i in r2.json()["items"]]
        assert labels2.count("Salt") == 3
        ids2 = [i["id"] for i in r2.json()["items"]]
        assert len(ids2) == len(set(ids2))
    finally:
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{lid}", headers=ADMIN, timeout=30)


def test_meal_plan_template_slot():
    db = _db()
    prev = db.list_templates.find_one({"list_id": "mealPlan"}, {"_id": 0})
    r = requests.put(f"{BASE_URL}/api/admin/templates/mealPlan", json={"items": [{"id": 1, "label": "1. Curry"}, {"id": 2, "label": "(Cook it)", "indent": True}]}, headers=ADMIN, timeout=30)
    try:
        assert r.status_code == 200, r.text
        assert r.json()["list_id"] == "mealPlan"
        t = requests.get(f"{BASE_URL}/api/templates", headers=PRO, timeout=30).json()["templates"]
        assert "mealPlan" in t and t["mealPlan"]["items"][1]["indent"] is True
    finally:
        if prev:
            db.list_templates.replace_one({"list_id": "mealPlan"}, prev)
        else:
            db.list_templates.delete_one({"list_id": "mealPlan"})
    # Name 'Meal Plan' is reserved for custom template lists
    r3 = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "meal plan", "items": ["a"]}, headers=ADMIN, timeout=30)
    assert r3.status_code == 400
