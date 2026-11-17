# Model Vessel conditional wizard panels: ??Q / ??? / ## lines saved, Edit Step indexing, Edit Final with ???IF lines
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
NAME = "Admin - Model Vessel - Question Demo"
ITEMS = [
    "Intro panel", "??Q1 Do you want to know about some cool stuff?", "???Q1 Yes,No", "???IF Q1 No then goto ##aftercool",
    "Some cool stuff", "##aftercool", "??Q2 What would you like to know about first?", "???provisioning and inventory, trip planning, safety",
    "???IF Q2 provisioning and inventory then goto ##provisioning and inventory", "???IF Q2 trip planning then goto ##trip planning",
    "???IF Q2 safety then goto ##safety", "##provisioning and inventory", "Prov panel 1", "Prov panel 2", "???goto ##finish",
    "##trip planning", "Trip panel 1", "???goto ##finish", "##safety", "Safety panel 1", "--- Finished the demo", "???IF Q1 Yes",
    "--- You learnt some cool stuff",
]
FIN = ["--- Finished the demo", "???IF Q1 Yes", "--- You learnt some cool stuff"]
STATE = {}


@pytest.fixture(scope="module", autouse=True)
def demo():
    lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
    if any(x["name"].lower() == NAME.lower() for x in lists):
        pytest.skip("Question Demo list already exists")
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, json={"name": NAME, "private": True, "items": ITEMS})
    assert r.status_code == 200, r.text
    STATE["id"] = r.json()["id"]
    STATE["create"] = r.json()
    yield
    d = requests.delete(f"{BASE_URL}/api/admin/template-lists/{STATE['id']}", headers=ADMIN)
    assert d.status_code in (200, 204)


def _labels():
    lists = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
    return [i["label"] for i in next(x for x in lists if x["id"] == STATE["id"])["items"]]


class TestQuestionWizard:
    def test_saved_keeps_duplicate_goto(self):
        labels = _labels()
        assert labels == ITEMS
        assert labels.count("???goto ##finish") == 2
        ids = [i["id"] for i in STATE["create"]["items"]]
        assert len(ids) == len(set(ids))

    def test_step_index_counts_panels(self):
        # wrong expect -> 409
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 2, "expect": "##aftercool", "text": "x"})
        assert r.status_code == 409
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 2, "expect": "Some cool stuff", "text": "Some cool stuff edited"})
        assert r.status_code == 200, r.text
        assert r.json()["lines"][4] == "Some cool stuff edited"
        # step 3 is the Q2 question line
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 3, "expect": ITEMS[6], "text": ITEMS[6]})
        assert r.status_code == 200, r.text
        # step 7 Safety panel 1, step 8 out of range
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 7, "expect": "Safety panel 1", "text": "Safety panel 1"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 8, "expect": "--- Finished the demo", "text": "x"})
        assert r.status_code == 409
        # restore
        r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=ADMIN, json={"wizard": "Question Demo", "step": 2, "expect": "Some cool stuff edited", "text": "Some cool stuff"})
        assert r.status_code == 200
        assert _labels() == ITEMS

    def test_finish_rejects_random(self):
        r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=ADMIN, json={"wizard": "Question Demo", "expect": FIN, "lines": ["--- ok", "random"]})
        assert r.status_code == 400
        assert "line 2" in r.json()["detail"]
        r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=ADMIN, json={"wizard": "Question Demo", "expect": FIN, "lines": ["???IF Q1 Yes then goto ##x"]})
        assert r.status_code == 400

    def test_finish_wrong_expect_409(self):
        r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=ADMIN, json={"wizard": "Question Demo", "expect": FIN[:1], "lines": FIN})
        assert r.status_code == 409

    def test_finish_accepts_if_and_keeps_body(self):
        new = ["--- Finished the demo", "???IF Q1 Yes", "--- You learnt some cool stuff", "$$ An idea"]
        r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=ADMIN, json={"wizard": "Question Demo", "expect": FIN, "lines": new})
        assert r.status_code == 200, r.text
        assert r.json()["lines"] == ITEMS[:20] + new
        labels = _labels()
        assert labels == ITEMS[:20] + new
        assert labels.count("???goto ##finish") == 2
        r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=ADMIN, json={"wizard": "Question Demo", "expect": new, "lines": FIN})
        assert r.status_code == 200, r.text
        assert _labels() == ITEMS
