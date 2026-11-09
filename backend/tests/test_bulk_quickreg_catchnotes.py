# Bulk Quick Reg (crew register) + Offline Catch Notes (note/weight_kg on /api/ai/fish) backend tests
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
API = f"{BASE_URL}/api/crew-register"
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
CATCHES = []


def _rows():
    d = requests.get(API, cookies=PRO, timeout=30).json()
    return d["crew"] + d.get("parties", [])


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for e in _rows():
        if e["name"].startswith("TEST_"):
            requests.delete(f"{API}/{e['entry_id']}", cookies=PRO, timeout=30)
    for cid in CATCHES:
        mdb.fish_catches.delete_one({"catch_id": cid, "user_id": "test-user-pro"})
        mdb.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"},
                                  {"$pull": {"data.shipsLog": {"catch_id": cid}, "pushed_items": {"item.catch_id": cid}}})


# Bulk Quick Reg (ordered)
class TestBulkQuickReg:
    def test_bulk_adds_and_skips(self):
        people = [{"name": "TEST_Bulk One", "email": "test_bulk1@example.com"},
                  {"name": "TEST_Bulk Two", "email": "TEST_BULK2@example.com"},
                  {"name": "TEST_Bulk Dup", "email": "Test_Bulk1@Example.com"},
                  {"name": "TEST_Bad", "email": "not-an-email"},
                  {"name": "", "email": "test_bulk3@example.com"}]
        r = requests.post(f"{API}/quick-bulk", json={"people": people}, cookies=PRO, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        print(d)
        assert "TEST_Bulk One" in d["added"] and "TEST_Bulk Two" in d["added"]
        skipped = {s["name"]: s["reason"] for s in d["skipped"]}
        assert "TEST_Bulk Dup" in skipped and "TEST_Bad" in skipped
        assert all(isinstance(v, str) and v for v in skipped.values())

    def test_rows_registered_quick(self):
        rows = {e["name"]: e for e in _rows()}
        for n in ("TEST_Bulk One", "TEST_Bulk Two"):
            assert rows[n]["status"] == "registered", rows[n]
            assert rows[n].get("quick_reg") is True, rows[n]
            assert "_id" not in rows[n]

    def test_rerun_all_duplicates(self):
        r = requests.post(f"{API}/quick-bulk", json={"people": [{"name": "TEST_Bulk One", "email": "test_bulk1@EXAMPLE.com"}]}, cookies=PRO, timeout=30)
        assert r.status_code == 200
        assert r.json()["added"] == [] and len(r.json()["skipped"]) == 1

    def test_limits(self):
        assert requests.post(f"{API}/quick-bulk", json={"people": []}, cookies=PRO, timeout=30).status_code == 422
        many = [{"name": f"TEST_x{i}", "email": f"x{i}@example.com"} for i in range(51)]
        assert requests.post(f"{API}/quick-bulk", json={"people": many}, cookies=PRO, timeout=30).status_code == 422
        assert requests.post(f"{API}/quick-bulk", json={"people": [{"name": "a", "email": "a@b.co"}]}, timeout=30).status_code == 401


# Offline Catch Notes: note + skipper weight (real AI call)
class TestCatchNotes:
    def test_validation(self):
        with open("/tmp/trout.jpg", "rb") as f:
            img = f.read()
        for bad in ({"weight_kg": "0"}, {"weight_kg": "1501"}, {"note": "x" * 301}):
            r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("t.jpg", img, "image/jpeg")}, data=bad, cookies=PRO, timeout=60)
            assert r.status_code == 422, (bad, r.status_code, r.text[:200])

    def test_note_and_weight(self):
        with open("/tmp/trout.jpg", "rb") as f:
            r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("t.jpg", f.read(), "image/jpeg")},
                              data={"lat": "-36.84", "lon": "174.76", "position": "TEST_pos", "when": "Mon 1 Jan", "boat_id": "main",
                                    "note": "TEST_note caught on a soft bait", "weight_kg": "2.35"}, cookies=PRO, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert not d.get("not_fish"), d
        c = d["catch"]
        CATCHES.append(c["catch_id"])
        assert c["report"]["size"]["weight_kg"] == 2.35
        assert c["report"]["size"]["weighed"] is True
        assert c["note"] == "TEST_note caught on a soft bait"
        lst = requests.get(f"{BASE_URL}/api/me/catches", cookies=PRO, timeout=30).json()["catches"]
        mine = next(x for x in lst if x["catch_id"] == c["catch_id"])
        assert mine["note"] == "TEST_note caught on a soft bait"
        assert mine["report"]["size"]["weight_kg"] == 2.35
        label = (d.get("log_item") or {}).get("label") or (d.get("log_item") or {}).get("text") or str(d.get("log_item"))
        print("LOG ITEM", d.get("log_item"))
        assert "weighed 2.35 kg" in label
        assert label.rstrip().endswith("Note: TEST_note caught on a soft bait") or "Note: TEST_note caught on a soft bait" in label
