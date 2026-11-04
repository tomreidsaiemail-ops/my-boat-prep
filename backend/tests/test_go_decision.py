# Crew Route Share / Decision to go: skipper send, owner status, crew get + answer, Ship's Log lines
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER, BOAT = "test-user-pro", "main"


def sess(token):
    s = requests.Session()
    s.cookies.set("session_token", token)
    return s


@pytest.fixture(scope="module")
def skipper():
    return sess("test_session_pro_1")


@pytest.fixture(scope="module")
def crew():
    return sess("test_session_free_1")


@pytest.fixture(scope="module")
def other():
    return sess("test_session_beta_1")


def log_labels(skipper):
    r = skipper.get(f"{BASE_URL}/api/boats/{BOAT}/go-plan")
    assert r.status_code == 200
    return r


class TestSend:
    def test_send_empty_400(self, skipper):
        r = skipper.post(f"{BASE_URL}/api/boats/{BOAT}/go-plan", json={"start": " ", "dest": "", "why": "", "photos": [], "when": "now"})
        assert r.status_code == 400

    def test_send_non_owner_404(self, other):
        r = other.post(f"{BASE_URL}/api/boats/zz_nope_boat/go-plan", json={"start": "A", "when": "now"})
        assert r.status_code == 404

    def test_send_bad_photo_id_422(self, skipper):
        r = skipper.post(f"{BASE_URL}/api/boats/{BOAT}/go-plan", json={"start": "A", "photos": [{"id": "xyz"}], "when": "now"})
        assert r.status_code == 422

    def test_send_and_owner_status(self, skipper):
        r = skipper.post(f"{BASE_URL}/api/boats/{BOAT}/go-plan",
                         json={"start": "TEST_Mana", "dest": "TEST_Picton", "why": "TEST_ SW easing", "photos": [], "when": "1 Jan 2026, 10:00"})
        assert r.status_code == 200, r.text
        plan = r.json()["plan"]
        assert len(plan["plan_id"]) == 12 and plan["start"] == "TEST_Mana"
        g = skipper.get(f"{BASE_URL}/api/boats/{BOAT}/go-plan").json()
        assert g["plan"]["plan_id"] == plan["plan_id"]
        c = [x for x in g["crew"] if x["user_id"] == "test-user-free"]
        assert c and c[0]["answer"] is None and c[0]["name"] == "TEST Free Crew"
        assert isinstance(g["pending"], list)


class TestCrew:
    def test_crew_get_and_answers(self, skipper, crew, other):
        plan = skipper.get(f"{BASE_URL}/api/boats/{BOAT}/go-plan").json()["plan"]
        pid = plan["plan_id"]
        r = crew.get(f"{BASE_URL}/api/crew/go-plan", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.status_code == 200 and r.json()["plan"]["plan_id"] == pid and r.json()["answer"] is None
        assert "go_answers" not in r.json()
        # non-crew
        assert other.get(f"{BASE_URL}/api/crew/go-plan", params={"owner_id": OWNER, "boat_id": BOAT}).status_code == 404
        assert other.post(f"{BASE_URL}/api/crew/go-plan/answer", json={"owner_id": OWNER, "boat_id": BOAT, "plan_id": pid, "agree": True, "when": "x"}).status_code == 404
        # empty reason
        body = {"owner_id": OWNER, "boat_id": BOAT, "plan_id": pid, "agree": False, "reason": "   ", "when": "1 Jan 2026, 10:05"}
        assert crew.post(f"{BASE_URL}/api/crew/go-plan/answer", json=body).status_code == 400
        # stale
        assert crew.post(f"{BASE_URL}/api/crew/go-plan/answer", json={**body, "plan_id": "aaaaaaaaaaaa", "reason": "x"}).status_code == 409
        # disagree
        r = crew.post(f"{BASE_URL}/api/crew/go-plan/answer", json={**body, "reason": "TEST_ swell  too\nbig"})
        assert r.status_code == 200 and r.json()["answer"]["agree"] is False and r.json()["answer"]["reason"] == "TEST_ swell too big"
        g = skipper.get(f"{BASE_URL}/api/boats/{BOAT}/go-plan").json()
        me = [x for x in g["crew"] if x["user_id"] == "test-user-free"][0]
        assert me["answer"]["agree"] is False
        # change to agree
        r = crew.post(f"{BASE_URL}/api/crew/go-plan/answer", json={**body, "agree": True, "reason": "ignored"})
        assert r.status_code == 200 and r.json()["answer"]["reason"] == ""
        r = crew.get(f"{BASE_URL}/api/crew/go-plan", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.json()["answer"]["agree"] is True and r.json()["answer"]["plan_id"] == pid

    def test_resend_resets_answers(self, skipper, crew):
        r = skipper.post(f"{BASE_URL}/api/boats/{BOAT}/go-plan", json={"start": "TEST_Mana", "dest": "TEST_Nelson", "why": "TEST_ v2", "when": "1 Jan 2026, 11:00"})
        assert r.status_code == 200
        r = crew.get(f"{BASE_URL}/api/crew/go-plan", params={"owner_id": OWNER, "boat_id": BOAT})
        assert r.json()["answer"] is None and r.json()["plan"]["dest"] == "TEST_Nelson"
