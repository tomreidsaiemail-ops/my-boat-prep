# Model Vessel wizards (admin-lists) and Model Vessel crew register separation (iteration 190)
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
FREE_EMAIL = "test.user.free@example.com"


def _email(tag):
    return f"test_{tag.lower()}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="module")
def created():
    ids = []
    yield ids
    for i in ids:
        requests.delete(f"{BASE_URL}/api/crew-register/{i}", headers=PRO, timeout=20)


def _list(boat_id=None):
    params = {"boat_id": boat_id} if boat_id else {}
    r = requests.get(f"{BASE_URL}/api/crew-register", headers=PRO, params=params, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _ids_by_email(data):
    return {c["email"]: c["entry_id"] for c in data["crew"]}


# Wizards: both "Admin - Model Vessel - *" lists come back from admin-lists
class TestWizardLists:
    def test_admin_lists_model_vessel(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", headers=PRO, params={"prefix": "Admin - Model Vessel"}, timeout=30)
        assert r.status_code == 200, r.text
        lists = {l["name"]: l["items"] for l in r.json()["lists"]}
        basic = lists.get("Admin - Model Vessel - Basic Introduction Walkthrough")
        crew = lists.get("Admin - Model Vessel - Crew Registration and Invites")
        assert basic is not None and len(basic) == 12
        assert crew is not None and len(crew) == 20
        labels = [i["label"] for i in crew]
        assert all(l.startswith("--") for l in labels[-6:])
        assert labels[-6].startswith("--") and not labels[-6].startswith("---")
        assert all(l.startswith("---") for l in labels[-5:])
        assert not any(l.startswith("--") for l in labels[:14])


# Crew register: Model Vessel register and live register are kept apart
class TestRegisterSeparation:
    def test_quick_bulk_model_and_separation(self, created):
        e1, e2 = _email("mvbulk1"), _email("mvbulk2")
        r = requests.post(f"{BASE_URL}/api/crew-register/quick-bulk", headers=PRO, params={"boat_id": "model_vessel"},
                          json={"people": [{"name": "TEST_MV Bulk One", "email": e1}, {"name": "TEST_MV Bulk Two", "email": e2}]}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["added"] == ["TEST_MV Bulk One", "TEST_MV Bulk Two"]
        model = _ids_by_email(_list("model_vessel"))
        created.extend([model[e1], model[e2]])
        assert e1 in model and e2 in model
        main = _ids_by_email(_list("main"))
        none = _ids_by_email(_list())
        assert e1 not in main and e2 not in main and e1 not in none
        # live entries never appear on model
        assert FREE_EMAIL in main and FREE_EMAIL in none
        assert FREE_EMAIL not in model or model[FREE_EMAIL] != main[FREE_EMAIL]

    def test_same_email_both_registers(self, created):
        e = _email("mvboth")
        r1 = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV Both", "email": e, "quick": True}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("model") is True
        created.append(r1.json()["entry_id"])
        r2 = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "main"}, json={"name": "TEST_Live Both", "email": e, "quick": True}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert not r2.json().get("model")
        created.append(r2.json()["entry_id"])
        # duplicate in same register refused
        r3 = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV Dup", "email": e}, timeout=30)
        assert r3.status_code == 400
        r4 = requests.post(f"{BASE_URL}/api/crew-register/quick-bulk", headers=PRO, params={"boat_id": "model_vessel"}, json={"people": [{"name": "TEST_MV Dup", "email": e}]}, timeout=30)
        assert r4.status_code == 200 and r4.json()["added"] == [] and len(r4.json()["skipped"]) == 1
        assert _ids_by_email(_list("model_vessel"))[e] == r1.json()["entry_id"]
        assert _ids_by_email(_list("main"))[e] == r2.json()["entry_id"]

    def test_edit_model_entry_duplicate_scope(self, created):
        a, b, live = _email("mvedA"), _email("mvedB"), _email("mvedLive")
        ra = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV A", "email": a}, timeout=30).json()
        rb = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV B", "email": b}, timeout=30).json()
        rl = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, json={"name": "TEST_Live L", "email": live}, timeout=30).json()
        created.extend([ra["entry_id"], rb["entry_id"], rl["entry_id"]])
        # model A -> live email: allowed (different register)
        r = requests.put(f"{BASE_URL}/api/crew-register/{ra['entry_id']}", headers=PRO, json={"name": "TEST_MV A", "email": live}, timeout=30)
        assert r.status_code == 200, r.text
        # model A -> model B email: refused
        r = requests.put(f"{BASE_URL}/api/crew-register/{ra['entry_id']}", headers=PRO, json={"name": "TEST_MV A", "email": b}, timeout=30)
        assert r.status_code == 400
        m = _ids_by_email(_list("model_vessel"))
        assert live in m and m[live] == ra["entry_id"]
        # still model after edit
        assert ra["entry_id"] not in _ids_by_email(_list("main")).values()

    def test_mine_never_returns_model(self, created):
        # pro registers the free user's email on the model register; free user's /mine must not see it
        before = requests.get(f"{BASE_URL}/api/crew-register/mine", headers=FREE, timeout=30)
        assert before.status_code == 200
        r = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV FreeUser", "email": FREE_EMAIL}, timeout=30)
        if r.status_code == 400:
            pytest.skip("free user already on model register")
        assert r.status_code == 200, r.text
        eid = r.json()["entry_id"]
        created.append(eid)
        # request on model -> pending, no email
        rq = requests.post(f"{BASE_URL}/api/crew-register/requests", headers=PRO, json={"entry_ids": [eid], "boat_id": "model_vessel"}, timeout=30)
        assert rq.status_code == 200, rq.text
        assert rq.json()["sent"] == ["TEST_MV FreeUser"]
        after = requests.get(f"{BASE_URL}/api/crew-register/mine", headers=FREE, timeout=30).json()
        assert eid not in [x["entry_id"] for x in after["requests"]]
        mphone = requests.get(f"{BASE_URL}/api/crew-register/my-phone", headers=FREE, timeout=30)
        assert mphone.status_code == 200

    def test_requests_model_only_touches_model(self, created):
        e = _email("mvreq")
        live = _email("livereq")
        rm = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, params={"boat_id": "model_vessel"}, json={"name": "TEST_MV Req", "email": e}, timeout=30).json()
        rl = requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, json={"name": "TEST_Live Req", "email": live}, timeout=30).json()
        created.extend([rm["entry_id"], rl["entry_id"]])
        # ask for both ids, with model boat: only model one touched
        rq = requests.post(f"{BASE_URL}/api/crew-register/requests", headers=PRO,
                           json={"entry_ids": [rm["entry_id"], rl["entry_id"]], "boat_id": "model_vessel"}, timeout=30)
        assert rq.status_code == 200, rq.text
        assert "TEST_MV Req" in rq.json()["sent"]
        assert "TEST_Live Req" not in rq.json()["sent"]
        live_row = [c for c in _list("main")["crew"] if c["entry_id"] == rl["entry_id"]][0]
        assert live_row["status"] == "unregistered" and not live_row.get("requested_at")
        model_row = [c for c in _list("model_vessel")["crew"] if c["entry_id"] == rm["entry_id"]][0]
        assert model_row["status"] == "pending"
