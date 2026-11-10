# Distress (Mayday / Pan-Pan) email endpoint + boat coastguard_email field
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
PRO = {"Authorization": "Bearer test_session_pro_1"}
SAFE = "delivered@resend.dev"


def payload(**kw):
    p = {"kind": "mayDay", "to": SAFE, "target": "coastguard", "vessel": "Alouette", "callsign": "abc123",
         "position": "UNKNOWN", "lines": ["MAYDAY · VHF Channel 16", "TEST_ line"]}
    p.update(kw)
    return p


class TestDistressEmail:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload())
        assert r.status_code == 401

    def test_invalid_email_400(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(to="not-an-email"), headers=PRO)
        assert r.status_code == 400
        assert "valid email" in r.json()["detail"]

    def test_invalid_kind_422(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(kind="sos"), headers=PRO)
        assert r.status_code == 422

    def test_invalid_target_422(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(target="police"), headers=PRO)
        assert r.status_code == 422

    def test_mayday_send_ok(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(position="Lat 36° 50.00' S / Long 174° 45.00' E"), headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["subject"] == "MAYDAY VESSEL NAME ALOUETTE, CALLSIGN: ABC123, POSITION Lat 36° 50.00' S / Long 174° 45.00' E"

    def test_panpan_send_ok_unknowns(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(kind="panPan", target="shore", vessel="", callsign="", position=""), headers=PRO, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["subject"] == "PAN-PAN VESSEL NAME UNKNOWN, CALLSIGN: UNKNOWN, POSITION UNKNOWN"

    def test_line_too_long_422(self):
        r = requests.post(f"{BASE_URL}/api/distress-email", json=payload(lines=["x" * 601]), headers=PRO)
        assert r.status_code == 422
