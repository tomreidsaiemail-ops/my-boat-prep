# Iteration 107: parties-email include_allergies -> 'Allergies' column in summary_html (unit) + 1 real send.
import os
import sys
import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
from crew_register import summary_html, PartiesIn  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
R = f"{BASE_URL}/api/crew-register"
PRO = {"Authorization": "Bearer test_session_pro_1", "Content-Type": "application/json"}
CREW = [
    {"name": "TEST <Ann>", "phone": "1", "email": "a@example.com", "dob": "1990-01-01", "height_cm": 170.0, "allergies": "Peanuts <severe> & bees", "status": "registered"},
    {"name": "TEST Bob", "phone": "2", "email": "b@example.com", "allergies": "", "status": "pending"},
    {"name": "TEST Cy", "phone": "3", "email": "c@example.com", "status": "unregistered"},
]


class TestSummaryHtmlUnit:
    def test_default_has_no_allergies(self):
        h = summary_html("Skip", CREW)
        assert "Allergies" not in h and "Peanuts" not in h and "Not given" not in h
        for col in ("Name", "Phone", "Email", "Age", "Height", "Next of kin", "Status"):
            assert f">{col}</th>" in h

    def test_false_same_as_default(self):
        assert summary_html("Skip", CREW, False) == summary_html("Skip", CREW)

    def test_true_adds_column_between_nok_and_status(self):
        h = summary_html("Skip", CREW, True)
        assert h.index(">Next of kin</th>") < h.index(">Allergies</th>") < h.index(">Status</th>")
        assert h.count("<th ") == 8

    def test_true_escapes_values(self):
        h = summary_html("Skip", CREW, True)
        assert "Peanuts &lt;severe&gt; &amp; bees" in h and "<severe>" not in h
        assert "TEST &lt;Ann&gt;" in h

    def test_blank_and_missing_not_given(self):
        h = summary_html("Skip", CREW, True)
        assert h.count("Not given") == 2

    def test_each_row_has_8_cells(self):
        h = summary_html("Skip", CREW, True)
        rows = h.split("</tr>")[1:-1]
        assert len(rows) == 3 and all(r.count("<td ") == 8 for r in rows)

    def test_model_default_false(self):
        m = PartiesIn(crew_ids=["00000000-0000-0000-0000-000000000001"], party_id="00000000-0000-0000-0000-000000000002")
        assert m.include_allergies is False


class TestPartiesEmailApi:
    ids = []

    @classmethod
    def teardown_class(cls):
        for i in cls.ids:
            requests.delete(f"{R}/{i}", headers=PRO)

    def _add(self, body):
        r = requests.post(R, json=body, headers=PRO)
        assert r.status_code == 200, r.text
        self.ids.append(r.json()["entry_id"])
        return r.json()["entry_id"]

    def test_01_send_with_allergies(self):
        p = self._add({"kind": "party", "name": "TEST RC107", "phone": "+64 21 1", "email": "test.rc107@example.com"})
        c = self._add({"kind": "crew", "name": "TEST Allergy107", "email": "test.allergy107@example.com", "allergies": "Shellfish"})
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [c], "party_id": p, "include_allergies": True}, headers=PRO, timeout=40)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent_to"] == "TEST RC107" and d["crew"] == 1 and d["email"] == "test.rc107@example.com"

    def test_02_bad_type_422(self):
        p, c = self.ids[0], self.ids[1]
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [c], "party_id": p, "include_allergies": "maybe"}, headers=PRO)
        assert r.status_code == 422
