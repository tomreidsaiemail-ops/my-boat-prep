# Crew Registration (iteration 105): register CRUD, requests, crew-side /mine + submit, parties email.
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
R = f"{BASE_URL}/api/crew-register"


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


PRO, FREE, BETA = hdr("test_session_pro_1"), hdr("test_session_free_1"), hdr("test_session_beta_1")
FULL = {"name": "TEST Free Crew", "phone": "+64 21 555 1234", "email": "test.user.free@example.com", "dob": "1990-05-01",
        "height_cm": 180, "weight_kg": 80, "allergies": "None", "food": "None", "nok_name": "TEST Nok",
        "nok_email": "nok@example.com", "nok_phone": "+64 21 555 9999", "comments": "None"}


class TestCrewRegister:
    ids = []

    @classmethod
    def teardown_class(cls):
        for i in cls.ids:
            requests.delete(f"{R}/{i}", headers=PRO)
        requests.delete(f"{R}/{cls.ids and cls.ids[0] or 'x'}", headers=PRO)

    def _add(self, body, h=PRO):
        r = requests.post(R, json=body, headers=h)
        if r.status_code == 200:
            self.ids.append(r.json()["entry_id"]) if h is PRO else None
        return r

    def test_01_unauth(self):
        assert requests.get(R).status_code == 401

    def test_02_add_crew_and_list(self):
        r = self._add({"kind": "crew", "name": "TEST Free Crew", "email": "Test.User.Free@example.com", "phone": "+64 21 1234567"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "unregistered" and d["kind"] == "crew" and d["email"] == "test.user.free@example.com"
        assert "owner_id" not in d and "_id" not in d and "email_key" not in d
        TestCrewRegister.crew_id = d["entry_id"]
        lst = requests.get(R, headers=PRO).json()
        assert any(c["entry_id"] == d["entry_id"] for c in lst["crew"])

    def test_03_validation(self):
        assert self._add({"kind": "crew", "name": "TEST X"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST dup", "email": "test.user.free@example.com"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST bad", "email": "notanemail"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST bad", "email": "a1@example.com", "nok_email": "bad"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST bad", "email": "a2@example.com", "dob": "2999-01-01"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST bad", "email": "a3@example.com", "dob": "01/02/1990"}).status_code == 400
        assert self._add({"kind": "crew", "name": "TEST bad", "email": "a4@example.com", "height_cm": 10}).status_code == 422
        assert self._add({"kind": "party", "name": "TEST P", "email": "p0@example.com"}).status_code == 400

    def test_04_party_registered(self):
        r = self._add({"kind": "party", "name": "TEST Party", "phone": "+64 21 7654321", "email": "test.party@example.com"})
        assert r.status_code == 200 and r.json()["status"] == "registered"
        TestCrewRegister.party_id = r.json()["entry_id"]
        # same email allowed as crew (different kind)
        r2 = self._add({"kind": "crew", "name": "TEST Second", "email": "test.party@example.com"})
        assert r2.status_code == 200
        TestCrewRegister.crew2_id = r2.json()["entry_id"]

    def test_05_edit(self):
        r = requests.put(f"{R}/{self.crew2_id}", json={"name": "TEST Second Edited", "email": "test.second@example.com", "height_cm": 175}, headers=PRO)
        assert r.status_code == 200 and r.json()["name"] == "TEST Second Edited"
        got = [c for c in requests.get(R, headers=PRO).json()["crew"] if c["entry_id"] == self.crew2_id][0]
        assert got["email"] == "test.second@example.com" and got["height_cm"] == 175
        # duplicate on edit
        assert requests.put(f"{R}/{self.crew2_id}", json={"name": "x", "email": "test.user.free@example.com"}, headers=PRO).status_code == 400

    def test_06_other_user_isolated(self):
        assert all(c["entry_id"] not in self.ids for c in requests.get(R, headers=BETA).json()["crew"])
        assert requests.put(f"{R}/{self.crew2_id}", json={"name": "hack", "email": "h@example.com"}, headers=BETA).status_code == 404
        requests.delete(f"{R}/{self.crew2_id}", headers=BETA)
        assert any(c["entry_id"] == self.crew2_id for c in requests.get(R, headers=PRO).json()["crew"])

    def test_07_requests_free_forbidden(self):
        if requests.get(f"{BASE_URL}/api/auth/me", headers=FREE).json().get("premium"):
            pytest.skip("launch_free promo makes free users premium")
        assert requests.post(f"{R}/requests", json={"send_email": False}, headers=FREE).status_code == 403

    def test_08_mine_unregistered_visible_as_boat_crew(self):
        r = requests.get(f"{R}/mine", headers=FREE)
        assert r.status_code == 200
        reqs = [x for x in r.json()["requests"] if x["entry_id"] == self.crew_id]
        assert reqs and reqs[0]["status"] == "unregistered" and reqs[0]["skipper"]
        assert reqs[0]["phone"] == "+64 21 1234567"

    def test_09_requests_sets_pending(self):
        r = requests.post(f"{R}/requests", json={"entry_ids": [self.crew_id], "send_email": False}, headers=PRO)
        assert r.status_code == 200 and r.json()["sent"] == ["TEST Free Crew"]
        got = {c["entry_id"]: c for c in requests.get(R, headers=PRO).json()["crew"]}
        assert got[self.crew_id]["status"] == "pending" and got[self.crew2_id]["status"] == "unregistered"

    def test_10_mine_wrong_user_404(self):
        assert requests.put(f"{R}/mine/{self.crew_id}", json=FULL, headers=BETA).status_code == 404
        assert all(x["entry_id"] != self.crew_id for x in requests.get(f"{R}/mine", headers=BETA).json()["requests"])

    def test_11_mine_missing_field(self):
        body = {**FULL, "allergies": ""}
        r = requests.put(f"{R}/mine/{self.crew_id}", json=body, headers=FREE)
        assert r.status_code == 400 and r.json()["detail"] == "Please fill in every field"
        assert requests.put(f"{R}/mine/{self.crew_id}", json={k: v for k, v in FULL.items() if k != "height_cm"}, headers=FREE).status_code == 422

    def test_12_mine_submit(self):
        r = requests.put(f"{R}/mine/{self.crew_id}", json=FULL, headers=FREE)
        assert r.status_code == 200 and r.json()["status"] == "registered"
        got = {c["entry_id"]: c for c in requests.get(R, headers=PRO).json()["crew"]}
        assert got[self.crew_id]["status"] == "registered" and got[self.crew_id]["nok_name"] == "TEST Nok"
        assert all(x["entry_id"] != self.crew_id for x in requests.get(f"{R}/mine", headers=FREE).json()["requests"])

    def test_13_requests_all_skips_registered(self):
        r = requests.post(f"{R}/requests", json={"entry_ids": None, "send_email": False}, headers=PRO)
        d = r.json()
        assert r.status_code == 200 and "TEST Free Crew" in d["skipped"] and "TEST Second Edited" in d["sent"]

    def test_14_parties_email(self):
        r = requests.post(f"{R}/parties-email", headers=PRO)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "test.party@example.com" in d["sent_to"] and d["crew"] >= 2 and "TEST Second Edited" in d["unregistered"]

    def test_15_delete(self):
        assert requests.delete(f"{R}/{self.crew2_id}", headers=PRO).status_code == 200
        assert all(c["entry_id"] != self.crew2_id for c in requests.get(R, headers=PRO).json()["crew"])
        assert requests.put(f"{R}/{self.crew2_id}", json={"name": "x", "email": "x@example.com"}, headers=PRO).status_code == 404


class TestPartiesEmailEmpty:
    def test_no_parties_400(self):
        lst = requests.get(R, headers=BETA).json()
        if lst["parties"]:
            pytest.skip("beta has parties")
        r = requests.post(f"{R}/parties-email", headers=BETA)
        assert r.status_code == 400 and "interested party" in r.json()["detail"]

    def test_no_crew_400(self):
        lst = requests.get(R, headers=BETA).json()
        if lst["crew"] or lst["parties"]:
            pytest.skip("beta has entries")
        p = requests.post(R, json={"kind": "party", "name": "TEST P", "phone": "+6421", "email": "tp@example.com"}, headers=BETA).json()
        try:
            r = requests.post(f"{R}/parties-email", headers=BETA)
            assert r.status_code == 400 and "crew" in r.json()["detail"].lower()
        finally:
            requests.delete(f"{R}/{p['entry_id']}", headers=BETA)
