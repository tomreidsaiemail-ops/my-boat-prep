# Quick Reg (crew register) + Magic Fish Whisperer offline queue (caught_at) backend tests
import os
from datetime import datetime, timedelta, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
BETA = {"session_token": "test_session_beta_1"}
BETA_EMAIL = "test.user.beta@example.com"
API = f"{BASE_URL}/api/crew-register"
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
CREATED = []
CATCHES = []


def _add(body, cookies=PRO):
    r = requests.post(API, json=body, cookies=cookies, timeout=30)
    if r.status_code == 200:
        CREATED.append(r.json()["entry_id"])
    return r


def _row(eid):
    data = requests.get(API, cookies=PRO, timeout=30).json()
    return next((e for e in data["crew"] + data["parties"] if e["entry_id"] == eid), None)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for eid in CREATED:
        requests.delete(f"{API}/{eid}", cookies=PRO, timeout=30)
    for cid in CATCHES:
        mdb.fish_catches.delete_one({"catch_id": cid, "user_id": "test-user-pro"})
        mdb.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"},
                                  {"$pull": {"data.shipsLog": {"catch_id": cid}, "pushed_items": {"item.catch_id": cid}}})


# Quick Reg add/request/crew completes (ordered)
class TestQuickReg:
    def test_quick_add_registered(self):
        r = _add({"kind": "crew", "name": "TEST_Quick Beta", "email": BETA_EMAIL, "quick": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "registered" and d["quick_reg"] is True and d["registered_at"]
        assert "owner_id" not in d and "email_key" not in d and "_id" not in d
        row = _row(d["entry_id"])
        assert row["status"] == "registered" and row["quick_reg"] is True

    def test_quick_requires_name_email(self):
        r = requests.post(API, json={"kind": "crew", "name": "TEST_NoEmail", "email": "", "quick": True}, cookies=PRO, timeout=30)
        assert r.status_code == 400

    def test_not_quick_unregistered(self):
        r = _add({"kind": "crew", "name": "TEST_Normal", "email": "test_normal_qr@example.com"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "unregistered" and not d.get("quick_reg")

    def test_party_ignores_quick(self):
        r = _add({"kind": "party", "name": "TEST_Party", "phone": "021555666", "email": "test_party_qr@example.com", "quick": True})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "registered" and "quick_reg" not in d

    def test_mine_hidden_before_request(self):
        qid = CREATED[0]
        r = requests.get(f"{API}/mine", cookies=BETA, timeout=30)
        assert r.status_code == 200
        assert qid not in [x["entry_id"] for x in r.json()["requests"]]
        # submit before asked -> 404
        form = {"name": "x", "phone": "1", "email": BETA_EMAIL, "dob": "1990-01-01", "height_cm": 180, "weight_kg": 80, "allergies": "None",
                "food": "None", "nok_name": "N", "nok_email": "nok@example.com", "nok_phone": "123", "comments": "None"}
        r = requests.put(f"{API}/mine/{qid}", json=form, cookies=BETA, timeout=30)
        assert r.status_code == 404

    def test_bulk_skips_quick(self):
        r = requests.post(f"{API}/requests", json={"send_email": False}, cookies=PRO, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "TEST_Quick Beta" in d["skipped"] and "TEST_Quick Beta" not in d["sent"]
        assert "TEST_Normal" in d["sent"]
        assert not _row(CREATED[0]).get("requested_at")
        assert _row(CREATED[1])["status"] == "pending"

    def test_request_quick_by_id(self):
        qid = CREATED[0]
        r = requests.post(f"{API}/requests", json={"entry_ids": [qid], "send_email": False, "boat_id": "main"}, cookies=PRO, timeout=30)
        assert r.status_code == 200
        assert r.json()["sent"] == ["TEST_Quick Beta"]
        row = _row(qid)
        assert row["status"] == "registered" and row["quick_reg"] is True and row["requested_at"]

    def test_parties_email_shows_quick(self):
        from crew_register import summary_html
        html = summary_html("Skip", [{"name": "A", "status": "registered", "quick_reg": True}, {"name": "B", "status": "registered"}])
        assert "Registered (Quick Reg)" in html and html.count("Registered") == 2

    def test_mine_lists_after_request(self):
        r = requests.get(f"{API}/mine", cookies=BETA, timeout=30)
        ids = [x["entry_id"] for x in r.json()["requests"]]
        assert CREATED[0] in ids

    def test_submit_mine_replaces_quick(self):
        qid = CREATED[0]
        form = {"name": "TEST_Quick Beta Full", "phone": "021111222", "email": BETA_EMAIL, "dob": "1990-01-01", "height_cm": 180, "weight_kg": 80,
                "allergies": "None", "food": "Fish", "nok_name": "TEST_Nok", "nok_email": "nok@example.com", "nok_phone": "021333444", "comments": "None"}
        r = requests.put(f"{API}/mine/{qid}", json=form, cookies=BETA, timeout=30)
        assert r.status_code == 200, r.text
        row = _row(qid)
        assert row["status"] == "registered" and row["quick_reg"] is False and row["crew_added_at"]
        assert row["name"] == "TEST_Quick Beta Full" and row["food"] == "Fish"
        mine = requests.get(f"{API}/mine", cookies=BETA, timeout=30).json()["requests"]
        assert qid not in [x["entry_id"] for x in mine]

    def test_requests_after_crew_added_skips(self):
        r = requests.post(f"{API}/requests", json={"entry_ids": [CREATED[0]], "send_email": False}, cookies=PRO, timeout=30)
        assert r.status_code == 200
        assert r.json()["sent"] == []


# Fish Whisperer caught_at (real AI calls)
class TestFishCaughtAt:
    def _post(self, caught_at):
        with open("/tmp/trout.jpg", "rb") as f:
            r = requests.post(f"{BASE_URL}/api/ai/fish", files={"file": ("t.jpg", f.read(), "image/jpeg")},
                              data={"lat": "-36.84", "lon": "174.76", "position": "TEST_pos", "when": "Mon 1 Jan", "caught_at": caught_at, "boat_id": "main"},
                              cookies=PRO, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert not d.get("not_fish"), d
        CATCHES.append(d["catch"]["catch_id"])
        return d

    def test_caught_at_kept(self):
        taken = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(microsecond=0)
        d = self._post(taken.isoformat().replace("+00:00", "Z"))
        assert datetime.fromisoformat(d["catch"]["created_at"]) == taken
        assert d["log_item"] and d["log_item"]["catch_id"] == d["catch"]["catch_id"]
        doc = mdb.fish_catches.find_one({"catch_id": d["catch"]["catch_id"]})
        assert doc.get("identified_at")
        lst = requests.get(f"{BASE_URL}/api/me/catches", cookies=PRO, timeout=30).json()["catches"]
        assert any(c["catch_id"] == d["catch"]["catch_id"] for c in lst)

    def test_caught_at_too_old_ignored(self):
        old = (datetime.now(timezone.utc) - timedelta(days=100)).isoformat()
        d = self._post(old)
        created = datetime.fromisoformat(d["catch"]["created_at"])
        assert abs((datetime.now(timezone.utc) - created).total_seconds()) < 600
