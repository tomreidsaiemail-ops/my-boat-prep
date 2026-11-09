# Charter feature ROUND 1 + 2 (register, overlap, hand over, frozen owner boat, charter copy, claim on login, terms)
import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
PRO, BETA, FREE = "test_session_pro_1", "test_session_beta_1", "test_session_free_1"
RESP_ID = "custom_TEST_charter_resp"
NEW_EMAIL = f"test.charter.{uuid.uuid4().hex[:8]}@example.com"
NEW_UID, NEW_TOKEN = f"test-charter-{uuid.uuid4().hex[:8]}", f"test_session_charter_{uuid.uuid4().hex[:8]}"


def s(tok):
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return x


def cleanup():
    mdb.charters.delete_many({"owner_id": "test-user-pro"})
    mdb.user_boats.delete_many({"charter.owner_id": "test-user-pro"})
    mdb.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"},
                              {"$unset": {"charter_lock": "", f"data.{RESP_ID}": ""},
                               "$pull": {"registry": {"id": RESP_ID}, "data.shipsLog": {"charter": {"$regex": "^TEST_"}},
                                         "data.myTodo": {"charter": {"$regex": "^TEST_"}}, "pushed_items": {"item.charter": {"$regex": "^TEST_"}}}})
    mdb.users.delete_one({"user_id": NEW_UID})
    mdb.user_sessions.delete_one({"session_token": NEW_TOKEN})


@pytest.fixture(scope="module", autouse=True)
def setup_module_data():
    cleanup()
    feat = {"custom": True, "name": "Admin - disabled features"}
    rows = (mdb.list_templates.find_one(feat, {"items": 1}) or {}).get("items")
    if rows is not None:
        mdb.list_templates.update_one(feat, {"$set": {"items": [r for r in rows if "charter" not in r.get("label", "").lower()]}})
    mdb.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"}, {
        "$push": {"registry": {"id": RESP_ID, "name": "Charter - charter skipper responsibilities"}},
        "$set": {f"data.{RESP_ID}": [{"id": 9001, "label": "TEST_Check the bilge daily", "checked": True},
                                     {"id": 9002, "label": "TEST_No night sailing", "checked": False}]}})
    yield
    if rows is not None:
        mdb.list_templates.update_one(feat, {"$set": {"items": rows}})
    cleanup()


class TestCharterSwitchedOff:
    def test_register_blocked_when_disabled(self):
        feat = {"custom": True, "name": "Admin - disabled features"}
        rows = (mdb.list_templates.find_one(feat, {"items": 1}) or {}).get("items") or []
        mdb.list_templates.update_one(feat, {"$set": {"items": rows + [{"id": 999, "label": "Charter Registrations Feature; enabled for nobody"}]}})
        try:
            r = s(PRO).post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_Off", "email": "off@example.com", "start": "2031-01-01", "end": "2031-01-02"})
            assert r.status_code == 403 and "switched off" in r.text
            assert "charter" in s(PRO).get(f"{BASE_URL}/api/me/features").json()["disabled"]
        finally:
            mdb.list_templates.update_one(feat, {"$set": {"items": rows}})


ST = {}


# One class: the steps share state and must run in order on one xdist worker.
class TestCharterFlow:
    def test_register_and_list(self):
        r = s(PRO).post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_Claim Skipper", "email": NEW_EMAIL, "start": "2027-01-01", "end": "2027-01-07"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "registered" and d["start"] == "2027-01-01" and d["vessel"] == "TEST_Kia Ora"
        ST["claim"] = d["charter_id"]
        g = s(PRO).get(f"{BASE_URL}/api/charters", params={"boat_id": "main"}).json()
        assert any(c["charter_id"] == d["charter_id"] for c in g["charters"])
        hl = g["handover_lists"]
        assert "My To Do List" in hl and "Ship's Log" in hl and "Charter - charter skipper responsibilities" in hl
        assert "Deck Hardware" not in hl and "Engine Service" not in hl and "TEST_My YT" not in hl
        print("handover_lists:", hl)

    def test_overlap_409(self):
        r = s(PRO).post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_X", "email": "x@example.com", "start": "2027-01-07", "end": "2027-01-10"})
        assert r.status_code == 409, r.text
        assert "overlaps" in r.json()["detail"]

    def test_end_before_start_400(self):
        r = s(PRO).post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_X", "email": "x@example.com", "start": "2027-03-05", "end": "2027-03-01"})
        assert r.status_code == 400

    def test_bad_date_422(self):
        r = s(PRO).post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_X", "email": "x@example.com", "start": "01/01/2027", "end": "2027-03-01"})
        assert r.status_code == 422

    def test_not_owner_boat(self):
        r = s(BETA).post(f"{BASE_URL}/api/charters", json={"boat_id": "main_nope", "name": "TEST_X", "email": "x@example.com", "start": "2027-05-01", "end": "2027-05-02"})
        assert r.status_code in (403, 404)

    def test_same_skipper_non_overlapping_and_delete(self):
        p = s(PRO)
        r = p.post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_Claim Skipper", "email": NEW_EMAIL, "start": "2027-01-08", "end": "2027-01-09"})
        assert r.status_code == 200, r.text
        cid = r.json()["charter_id"]
        assert p.delete(f"{BASE_URL}/api/charters/{cid}").status_code == 200
        assert not any(c["charter_id"] == cid for c in p.get(f"{BASE_URL}/api/charters", params={"boat_id": "main"}).json()["charters"])

    def test_handover_before_user_exists_then_claim(self):
        p = s(PRO)
        r = p.post(f"{BASE_URL}/api/charters/{ST['claim']}/handover")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "handed_over" and d["copy_boat_id"] == f"ch{ST['claim'][:12]}" and d["claimed_at"] is None
        assert mdb.charters.find_one({"charter_id": ST["claim"]}).get("copy_state")
        assert p.delete(f"{BASE_URL}/api/charters/{ST['claim']}").status_code == 400
        from datetime import datetime, timedelta, timezone
        mdb.users.insert_one({"user_id": NEW_UID, "email": NEW_EMAIL.upper(), "name": "TEST Charter", "role": "free", "created_at": datetime.now(timezone.utc).isoformat()})
        mdb.user_sessions.insert_one({"user_id": NEW_UID, "session_token": NEW_TOKEN, "expires_at": datetime.now(timezone.utc) + timedelta(days=1), "created_at": datetime.now(timezone.utc)})
        n = s(NEW_TOKEN)
        for _ in range(3):
            b = n.get(f"{BASE_URL}/api/me/boats")
            assert b.status_code == 200, b.text
        copies = [x for x in b.json()["boats"] if x.get("charter")]
        assert len(copies) == 1 and copies[0]["boat_id"] == d["copy_boat_id"]
        assert mdb.user_boats.count_documents({"owner_id": NEW_UID}) == 1
        c = mdb.charters.find_one({"charter_id": ST["claim"]})
        assert c["copy_owner"] == NEW_UID and c.get("claimed_at") and "copy_state" not in c

    def test_end_claim_charter(self):
        p = s(PRO)
        assert s(NEW_TOKEN).post(f"{BASE_URL}/api/charters/{ST['claim']}/return").status_code == 404
        r = p.post(f"{BASE_URL}/api/charters/{ST['claim']}/return")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "returned" and r.json()["log_entries"] == 0
        assert not mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}).get("charter_lock")
        assert p.post(f"{BASE_URL}/api/charters/{ST['claim']}/return").status_code == 400

    def test_register_and_handover_beta(self):
        p = s(PRO)
        r = p.post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_Beta Skipper", "email": "Test.User.Beta@example.com", "start": "2027-02-01", "end": "2027-02-07"})
        assert r.status_code == 200, r.text
        ST["beta"] = r.json()["charter_id"]
        r2 = p.post(f"{BASE_URL}/api/charters", json={"boat_id": "main", "name": "TEST_Later", "email": "later@example.com", "start": "2027-04-01", "end": "2027-04-03"})
        assert r2.status_code == 200
        ST["later"] = r2.json()["charter_id"]
        ST["before"] = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
        h = p.post(f"{BASE_URL}/api/charters/{ST['beta']}/handover")
        assert h.status_code == 200, h.text
        d = h.json()
        assert d["status"] == "handed_over" and d["claimed_at"]
        ST["copy"] = d["copy_boat_id"]

    def test_owner_locked(self):
        doc = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
        assert doc["charter_lock"]["charter_id"] == ST["beta"]
        boats = s(PRO).get(f"{BASE_URL}/api/me/boats").json()["boats"]
        m = next(b for b in boats if b["boat_id"] == "main" and not b["crew"])
        assert m["charter_lock"]["name"] == "TEST_Beta Skipper"
        assert not any(b.get("charter") for b in boats)

    def test_second_handover_409(self):
        r = s(PRO).post(f"{BASE_URL}/api/charters/{ST['later']}/handover")
        assert r.status_code == 409, r.text
        assert s(PRO).post(f"{BASE_URL}/api/charters/{ST['beta']}/handover").status_code == 400

    def test_copy_contents(self):
        cp = mdb.user_boats.find_one({"owner_id": "test-user-beta", "boat_id": ST["copy"]})
        assert cp and cp["charter"]["charter_id"] == ST["beta"] and cp["charter"]["owner_id"] == "test-user-pro"
        names = [l["name"] for l in cp["registry"]]
        print("copy lists:", names)
        assert "Charter - charter skipper responsibilities" in names and "My To Do List" in names and "Ship's Log" in names
        assert not any(l.get("kind") == "maint" for l in cp["registry"])
        assert "Engine Service" not in names and "TEST_My YT" not in names
        assert cp["data"]["shipsLog"] == [] and cp["data"]["myTodo"] == []
        assert all(not i.get("checked") for v in cp["data"].values() for i in v)
        assert len(cp["areas"]) == len(ST["before"]["areas"]) and all(a["items"] == [] for a in cp["areas"])
        assert cp["boat"]["route_start"] == "" and cp["boat"]["route_dest"] == "" and cp["boat"]["skipper"] == "TEST_Beta Skipper"
        assert cp["crew"] == [] and cp["boat"]["vessel"] == "TEST_Kia Ora"
        assert mdb.crew_invites.count_documents({"owner_id": "test-user-beta", "boat_id": ST["copy"]}) == 0
        boats = s(BETA).get(f"{BASE_URL}/api/me/boats").json()["boats"]
        assert sum(1 for b in boats if b["boat_id"] == ST["copy"]) == 1
        b = next(b for b in boats if b["boat_id"] == ST["copy"])
        assert b["charter"]["vessel"] == "TEST_Kia Ora" and b["vessel"] == "TEST_Kia Ora"

    def test_put_locked_boat_ignored(self):
        p = s(PRO)
        st = p.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()
        st["boat"]["vessel"] = "TEST_HACKED"
        r = p.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=st)
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["vessel"] == "TEST_Kia Ora"
        after = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
        assert after["boat"]["vessel"] == "TEST_Kia Ora" and after.get("updated_at") == ST["before"].get("updated_at")

    def test_crew_put_locked_boat_ignored(self):
        f = s(FREE)
        g = f.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main", "owner": "test-user-pro"})
        if g.status_code != 200:
            pytest.skip("free not crew on pro main")
        st = g.json()
        if st["data"].get("provisions"):
            st["data"]["provisions"][0]["checked"] = not st["data"]["provisions"][0].get("checked")
        f.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main", "owner": "test-user-pro"}, json=st)
        after = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
        assert after["data"].get("provisions") == ST["before"]["data"].get("provisions")

    def test_terms_and_accept(self):
        b = s(BETA)
        t = b.get(f"{BASE_URL}/api/charter-terms", params={"boat_id": ST["copy"]})
        assert t.status_code == 200, t.text
        d = t.json()
        assert len(d["terms"]) == 5 and d["terms"][0].startswith("I hold the qualifications")
        assert [r["label"] for r in d["responsibilities"]] == ["TEST_Check the bilge daily", "TEST_No night sailing"]
        assert d["accepted_at"] is None
        ids = [r["id"] for r in d["responsibilities"]]
        bad = b.post(f"{BASE_URL}/api/charter-terms", params={"boat_id": ST["copy"]}, json={"ticked": ids[:1]})
        assert bad.status_code == 400
        assert s(PRO).get(f"{BASE_URL}/api/charter-terms", params={"boat_id": "main"}).status_code == 404
        ok = b.post(f"{BASE_URL}/api/charter-terms", params={"boat_id": ST["copy"]}, json={"ticked": ids})
        assert ok.status_code == 200 and ok.json()["accepted_at"]
        assert b.get(f"{BASE_URL}/api/charter-terms", params={"boat_id": ST["copy"]}).json()["accepted_at"]
        rows = s(PRO).get(f"{BASE_URL}/api/charters", params={"boat_id": "main"}).json()["charters"]
        assert next(c for c in rows if c["charter_id"] == ST["beta"])["terms_accepted_at"]

    def test_beta_can_edit_copy(self):
        b = s(BETA)
        st = b.get(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}).json()
        st["data"]["myTodo"] = [{"id": 1, "label": "TEST_fix winch", "checked": False}]
        r = b.put(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}, json=st)
        assert r.status_code == 200, r.text
        assert mdb.user_boats.find_one({"owner_id": "test-user-beta", "boat_id": ST["copy"]})["data"]["myTodo"][0]["label"] == "TEST_fix winch"

    def test_end_beta_charter_brings_logs_back(self):
        b = s(BETA)
        st = b.get(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}).json()
        own = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
        clash = (own["data"].get("shipsLog") or [{"id": 777}])[0]["id"]
        st["data"]["shipsLog"] = [{"id": clash, "label": "TEST_Left the marina", "checked": False, "ts": "2027-02-01T09:00:00+00:00"}]
        assert b.put(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}, json=st).status_code == 200
        n_log, n_todo = len(own["data"].get("shipsLog") or []), len(own["data"].get("myTodo") or [])
        r = s(PRO).post(f"{BASE_URL}/api/charters/{ST['beta']}/return")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "returned" and d["returned_at"] and d["delete_at"] and d["log_entries"] == 1 and d["todo_entries"] == 1
        print("emailed:", d["emailed"])
        after = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
        assert not after.get("charter_lock") and after["updated_at"] > own["updated_at"]
        log, todo = after["data"]["shipsLog"], after["data"]["myTodo"]
        assert len(log) == n_log + 1 and len(todo) == n_todo + 1
        assert log[-1]["label"] == "Charter skipper TEST_Beta Skipper: TEST_Left the marina" and log[-1]["charter"] == "TEST_Beta Skipper"
        assert len({i["id"] for i in log}) == len(log)
        assert todo[-1]["label"] == "Charter skipper TEST_Beta Skipper: TEST_fix winch"
        assert {p["item"]["id"] for p in after.get("pushed_items") or []} >= {log[-1]["id"], todo[-1]["id"]}

    def test_owner_boat_editable_again_and_keeps_charter_entries(self):
        p = s(PRO)
        st = p.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()
        assert any(i["label"].startswith("Charter skipper TEST_Beta Skipper") for i in st["data"]["shipsLog"])
        assert s(PRO).get(f"{BASE_URL}/api/charters", params={"boat_id": "main"}).status_code == 200
        boats = p.get(f"{BASE_URL}/api/me/boats").json()["boats"]
        assert not next(b for b in boats if b["boat_id"] == "main" and not b["crew"]).get("charter_lock")

    def test_copy_read_only_for_charter_skipper(self):
        b = s(BETA)
        boats = b.get(f"{BASE_URL}/api/me/boats").json()["boats"]
        cb = next(x for x in boats if x["boat_id"] == ST["copy"])
        assert cb["charter"]["returned_at"] and cb["charter"]["delete_at"]
        st = b.get(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}).json()
        st["data"]["myTodo"] = []
        b.put(f"{BASE_URL}/api/me/boat", params={"boat_id": ST["copy"]}, json=st)
        cp = mdb.user_boats.find_one({"owner_id": "test-user-beta", "boat_id": ST["copy"]})
        assert cp["data"]["myTodo"][0]["label"] == "TEST_fix winch" and cp.get("charter_expires_at")

    def test_copy_deleted_after_keep_days(self):
        mdb.charters.update_one({"charter_id": ST["beta"]}, {"$set": {"delete_at": "2000-01-01T00:00:00+00:00"}})
        rows = s(PRO).get(f"{BASE_URL}/api/charters", params={"boat_id": "main"}).json()["charters"]
        c = next(c for c in rows if c["charter_id"] == ST["beta"])
        assert c["status"] == "deleted" and c["deleted_at"]
        assert not mdb.user_boats.find_one({"owner_id": "test-user-beta", "boat_id": ST["copy"]})
