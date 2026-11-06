# Iteration 106: parties-email {crew_ids, party_id}, on-board crew diet/weights, AI diet param.
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
R = f"{BASE_URL}/api/crew-register"
TOM = "7ea5d57c-4d05-465a-8552-aeb5ef5c84c1"


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


PRO, FREE, BETA = hdr("test_session_pro_1"), hdr("test_session_free_1"), hdr("test_session_beta_1")


class TestPartiesEmail:
    ids = []

    @classmethod
    def teardown_class(cls):
        for i in cls.ids:
            requests.delete(f"{R}/{i}", headers=PRO)

    def _add(self, body):
        r = requests.post(R, json=body, headers=PRO)
        assert r.status_code == 200, r.text
        self.ids.append(r.json()["entry_id"])
        return r.json()

    def test_01_setup(self):
        TestPartiesEmail.p1 = self._add({"kind": "party", "name": "TEST RPNYC", "phone": "+64 21 111", "email": "test.rpnyc@example.com"})["entry_id"]
        TestPartiesEmail.p2 = self._add({"kind": "party", "name": "TEST Coastguard", "phone": "+64 21 222", "email": "test.cg@example.com"})["entry_id"]
        TestPartiesEmail.c1 = self._add({"kind": "crew", "name": "TEST Dick", "email": "test.dick@example.com"})["entry_id"]
        TestPartiesEmail.c2 = self._add({"kind": "crew", "name": "TEST Harry", "email": "test.harry@example.com"})["entry_id"]

    def test_02_empty_crew_422(self):
        assert requests.post(f"{R}/parties-email", json={"crew_ids": [], "party_id": self.p1}, headers=PRO).status_code == 422

    def test_03_missing_body_422(self):
        assert requests.post(f"{R}/parties-email", headers=PRO).status_code == 422

    def test_04_party_not_mine_400(self):
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [self.c1], "party_id": "00000000-0000-0000-0000-000000000000"}, headers=PRO)
        assert r.status_code == 400 and "interested party" in r.json()["detail"]

    def test_05_crew_id_as_party_400(self):
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [self.c1], "party_id": self.c2}, headers=PRO)
        assert r.status_code == 400

    def test_06_party_id_as_crew_400(self):
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [self.p2], "party_id": self.p1}, headers=PRO)
        assert r.status_code == 400 and "crew" in r.json()["detail"].lower()

    def test_07_other_user_party_400(self):
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [self.c1], "party_id": self.p1}, headers=BETA)
        assert r.status_code == 400

    def test_08_send_picked_crew_one_party(self):
        # only TEST Dick picked (Harry left out); unknown ids are ignored. Sends one real email (example.com).
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [self.c1, "00000000-0000-0000-0000-000000000009"], "party_id": self.p1}, headers=PRO)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent_to"] == "TEST RPNYC" and d["email"] == "test.rpnyc@example.com"
        assert d["crew"] == 1
        assert d["unregistered"] == ["TEST Dick"]


class TestOnBoard:
    def test_unauth(self):
        assert requests.get(f"{R}/on-board/main").status_code == 401

    def test_pro_main(self):
        r = requests.get(f"{R}/on-board/main", headers=PRO)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d) == {"people", "not_on_register", "rsvp_only"}
        tom = [p for p in d["people"] if p["name"] == "TEST Tom"]
        if not tom:
            pytest.skip("needs a pro register entry 'TEST Tom' for test.user.free@example.com (allergies peanuts, food vegetarian, 92 kg)")
        assert tom and tom[0]["allergies"] == "peanuts" and tom[0]["food"] == "vegetarian" and tom[0]["weight_kg"] == 92
        assert isinstance(d["rsvp_only"], bool)
        assert "_id" not in tom[0] and "email" not in tom[0]

    def test_not_owner_404(self):
        # boat ids are per-owner ('main' is everyone's default), so beta sees its own 'main' - never pro's register
        r = requests.get(f"{R}/on-board/main", headers=BETA)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert all(p["name"] != "TEST Tom" for p in r.json()["people"])

    def test_crew_member_cannot_read(self):
        # free crew does not own the pro boat; their own 'main' (if any) is unrelated to pro register
        r = requests.get(f"{R}/on-board/main", headers=FREE)
        if r.status_code == 200:
            assert all(p["name"] != "TEST Tom" for p in r.json()["people"])
        else:
            assert r.status_code == 404

    def test_bad_boat_id(self):
        assert requests.get(f"{R}/on-board/nonexistentboat123", headers=PRO).status_code in (404, 422)


class TestAiDiet:
    def test_diet_too_long_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-draft", json={"name": "TEST meals", "description": "", "diet": "x" * 3001}, headers=PRO)
        assert r.status_code == 422

    def test_topup_diet_too_long_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-topup", json={"name": "TEST", "description": "", "diet": "x" * 3001, "items": []}, headers=PRO)
        assert r.status_code == 422

    def test_list_draft_with_diet_live(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-draft", json={"name": "TEST weekend meal plan", "description": "2 day sail, 3 people",
                                                             "diet": "TEST Tom: allergic to peanuts; food preference vegetarian"}, headers=PRO, timeout=150)
        if r.status_code == 429:
            pytest.skip("AI quota reached")
        assert r.status_code == 200, r.text
        txt = str(r.json()).lower()
        print(r.json())
        assert "peanut" not in txt or "no peanut" in txt or "peanut-free" in txt or "avoid" in txt
