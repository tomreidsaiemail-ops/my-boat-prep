# Iteration 109: parties email subject/body with boat details (skipper, vessel, phone, event) + skipper_phone on boat.
import os
import sys
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")
from crew_register import summary_html, summary_subject, when_text  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
R = f"{BASE_URL}/api/crew-register"
PRO = {"Authorization": "Bearer test_session_pro_1", "Content-Type": "application/json"}

BOAT = {"vessel": "TEST_Kia Ora", "skipper_phone": "+64 21 555 1234", "boat_type": "Yacht - Sloop", "make": "Beneteau",
        "model": "Oceanis 38", "year_built": "2015", "hull_colour": "White", "weather": {"event_name": "TEST Winter Race 3", "event_at": "2026-12-05T09:30"}}
CREW = [{"name": "TEST Dick", "phone": "021", "email": "d@example.com", "status": "registered", "allergies": "Peanuts"}]


# Unit: summary_subject
class TestSubject:
    def test_event_and_vessel(self):
        assert summary_subject("Tom", BOAT) == "TEST Winter Race 3 5 Dec 2026 09:30 - Crew registration details from Tom (TEST_Kia Ora)"

    def test_no_event(self):
        b = {**BOAT, "weather": {}}
        assert summary_subject("Tom", b) == "Crew registration details from Tom (TEST_Kia Ora)"

    def test_event_name_only(self):
        b = {**BOAT, "weather": {"event_name": "TEST Race"}}
        assert summary_subject("Tom", b) == "TEST Race - Crew registration details from Tom (TEST_Kia Ora)"

    def test_event_date_only(self):
        b = {**BOAT, "weather": {"event_at": "2026-01-02T18:05"}}
        assert summary_subject("Tom", b) == "2 Jan 2026 18:05 - Crew registration details from Tom (TEST_Kia Ora)"

    def test_no_boat(self):
        assert summary_subject("Tom", None) == "Crew registration details from Tom"

    def test_blank_vessel(self):
        assert summary_subject("Tom", {"vessel": "  "}) == "Crew registration details from Tom"

    def test_bad_date(self):
        assert when_text("not a date") == "" and when_text(None) == ""

    def test_null_weather_values(self):
        assert summary_subject("Tom", {"vessel": "V", "weather": {"event_name": None, "event_at": None}}) == "Crew registration details from Tom (V)"


# Unit: summary_html
class TestBody:
    def test_with_boat(self):
        h = summary_html("Tom", CREW, False, BOAT, "tom@example.com")
        assert "Tom is the skipper of TEST_Kia Ora" in h
        assert "<b>Email:</b> tom@example.com" in h and "<b>Phone:</b> +64 21 555 1234" in h
        for k, v in (("Boat type", "Yacht - Sloop"), ("Make", "Beneteau"), ("Model", "Oceanis 38"), ("Year of manufacture", "2015"), ("Hull colour", "White")):
            assert f"<b>{k}</b>" in h and v in h
        assert "Allergies" not in h

    def test_only_filled_facts(self):
        b = {"vessel": "V", "make": "Beneteau", "year_built": "", "hull_colour": ""}
        h = summary_html("Tom", CREW, False, b, "tom@example.com")
        assert "<b>Make</b>" in h and "Hull colour" not in h and "Year of manufacture" not in h and "Phone:" not in h

    def test_no_boat_old_body(self):
        h = summary_html("Tom", CREW, True)
        assert "Tom has shared the crew list with you as an interested party." in h and "skipper of" not in h
        assert "Allergies" in h and "Peanuts" in h

    def test_escape(self):
        h = summary_html("<b>x</b>", CREW, False, {"vessel": "<script>"}, "")
        assert "<script>" not in h and "&lt;script&gt;" in h

    def test_none_values_safe(self):
        # Older boat docs could hold null values
        b = {"vessel": "V", "skipper_phone": None, "make": None}
        try:
            h = summary_html("Tom", CREW, False, b, "e@example.com")
        except AttributeError as e:
            pytest.fail(f"summary_html crashes on null skipper_phone: {e}")
        assert "None" not in h


# API: one real send with boat_id, plus validation
class TestApi:
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

    def test_01_bad_boat_id_422(self):
        r = requests.post(f"{R}/parties-email", json={"crew_ids": ["00000000-0000-0000-0000-000000000000"], "party_id": "00000000-0000-0000-0000-000000000000", "boat_id": "bad id!"}, headers=PRO)
        assert r.status_code == 422

    def test_02_send_with_boat(self):
        p = self._add({"kind": "party", "name": "TEST Party109", "phone": "+64 21 111", "email": "delivered@resend.dev"})
        c = self._add({"kind": "crew", "name": "TEST Crew109", "email": "test.crew109@example.com"})
        r = requests.post(f"{R}/parties-email", json={"crew_ids": [c], "party_id": p, "boat_id": "main"}, headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent_to"] == "TEST Party109" and d["crew"] == 1 and d["unregistered"] == ["TEST Crew109"]

    def test_03_skipper_phone_roundtrip(self):
        g = requests.get(f"{BASE_URL}/api/me/boat?boat_id=main", headers=PRO)
        assert g.status_code == 200
        assert "skipper_phone" in g.json()["boat"]
