# Training magic: first tutorial finish on Pro credits 10 magic once; /wizards/mine; admin analytics training_magic
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
KEY = f"test_tutorial_{uuid.uuid4().hex[:8]}"
FKEY = f"test_tutorial_free_{uuid.uuid4().hex[:8]}"
OKEY = f"test_tutorial_open_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(os.environ.get("MONGO_URL"))
    d = c[os.environ.get("DB_NAME")]
    q = {u: (d.magic_quota.find_one({"user_id": u}) or {}) for u in ("test-user-pro", "test-user-free")}
    yield d
    credited = {u: sum(x.get("credited", 0) for x in d.wizard_progress.find({"user_id": u, "wizard": {"$in": [KEY, FKEY, OKEY]}})) for u in q}
    d.wizard_progress.delete_many({"user_id": {"$in": list(q)}, "wizard": {"$in": [KEY, FKEY, OKEY]}})
    for u, doc in q.items():
        if credited[u]:
            if doc:
                d.magic_quota.update_one({"user_id": u}, {"$inc": {"purchased_allowance": -credited[u]}})
            else:
                d.magic_quota.delete_one({"user_id": u})


def allowance(mdb, uid):
    return (mdb.magic_quota.find_one({"user_id": uid}) or {}).get("purchased_allowance", 0)


class TestTrainingMagic:
    def test_pro_first_finish_credits_once(self, mdb):
        a0 = allowance(mdb, "test-user-pro")
        r = requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": KEY, "event": "finish"}, headers=PRO)
        assert r.status_code == 200 and r.json() == {"ok": True, "credited": 10}
        assert allowance(mdb, "test-user-pro") == a0 + 10
        r2 = requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": KEY, "event": "finish"}, headers=PRO)
        assert r2.json()["credited"] == 0
        r3 = requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": KEY.upper(), "event": "finish"}, headers=PRO)
        assert r3.json()["credited"] == 0
        assert allowance(mdb, "test-user-pro") == a0 + 10

    def test_open_then_finish_credits(self, mdb):
        a0 = allowance(mdb, "test-user-pro")
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": OKEY, "event": "open"}, headers=PRO).json()["credited"] == 0
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": OKEY, "event": "finish"}, headers=PRO).json()["credited"] == 10
        assert allowance(mdb, "test-user-pro") == a0 + 10

    def test_free_user_credit_matches_premium(self, mdb):
        # test-user-free is launch-free (FIRST200) so premium=True -> credited; a non-premium user would get 0
        prem = requests.get(f"{BASE_URL}/api/auth/me", headers=FREE).json()["premium"]
        a0 = allowance(mdb, "test-user-free")
        r = requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": FKEY, "event": "finish"}, headers=FREE)
        assert r.status_code == 200 and r.json()["credited"] == (10 if prem else 0)
        assert allowance(mdb, "test-user-free") == a0 + (10 if prem else 0)

    def test_mine(self, mdb):
        d = requests.get(f"{BASE_URL}/api/wizards/mine", headers=PRO).json()
        assert KEY in d["finished"] and d["credited"][KEY] == 10
        assert isinstance(d["finished_at"][KEY], str)
        assert d["total_credited"] == sum(d["credited"].values()) and d["total_credited"] >= 20

    def test_bad_payloads(self):
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": KEY, "event": "done"}, headers=PRO).status_code == 422
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": "", "event": "finish"}, headers=PRO).status_code == 422
        assert requests.post(f"{BASE_URL}/api/wizards/event", json={"wizard": KEY, "event": "finish"}).status_code == 401

    def test_admin_analytics(self, mdb):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=ADMIN)
        assert r.status_code == 200
        t = r.json()["training_magic"]
        assert t["magic"] >= 20 and t["credits"] >= 2
        assert t["latest"]["wizard"] in (OKEY, FKEY) and t["latest"]["magic"] == 10 and t["latest"]["at"] and t["latest"]["email"]
        assert requests.get(f"{BASE_URL}/api/admin/analytics", headers=PRO).status_code in (401, 403)
