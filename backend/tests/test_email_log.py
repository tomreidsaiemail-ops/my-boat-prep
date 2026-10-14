"""Backend tests for email-log and ship-log PDF endpoints."""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
RECIPIENT = "delivered@resend.dev"


def _payload(vessel="TEST_Kia Ora", skipper="TEST_Skipper", callsign="ZMA123", email=RECIPIENT):
    return {
        "boat": {"vessel": vessel, "skipper": skipper, "callsign": callsign, "log_email": email},
        "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
        "data": {
            "shipsLog": [
                {"id": 1, "label": "Date: [DATE]", "checked": True, "dynamic": "logDate"},
                {"id": 2, "label": "Fuel topped up", "checked": False},
            ]
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# --- email-log: 404 when no boat ---
def test_email_log_no_boat_404():
    did = f"test-{uuid.uuid4().hex[:16]}"
    r = requests.post(f"{API}/boats/{did}/email-log", json={"local_date": "Wednesday, 14 October 2026"})
    assert r.status_code == 404


# --- email-log: 400 when vessel details missing ---
def test_email_log_missing_vessel_details_400():
    did = f"test-{uuid.uuid4().hex[:16]}"
    p = _payload(vessel="", skipper="", callsign="")
    assert requests.put(f"{API}/boats/{did}", json=p).status_code == 200
    r = requests.post(f"{API}/boats/{did}/email-log", json={"local_date": "Wednesday, 14 October 2026"})
    assert r.status_code == 400
    assert "vessel details" in r.json()["detail"].lower()


# --- email-log: 400 when email invalid ---
def test_email_log_invalid_email_400():
    did = f"test-{uuid.uuid4().hex[:16]}"
    p = _payload(email="not-an-email")
    assert requests.put(f"{API}/boats/{did}", json=p).status_code == 200
    r = requests.post(f"{API}/boats/{did}/email-log", json={"local_date": "Wednesday, 14 October 2026"})
    assert r.status_code == 400
    assert "valid email" in r.json()["detail"].lower()


# --- email-log success + GET PDF + boat round-trip of log_sent ---
@pytest.fixture(scope="module")
def sent_log():
    did = f"test-{uuid.uuid4().hex[:16]}"
    p = _payload()
    assert requests.put(f"{API}/boats/{did}", json=p).status_code == 200
    local_date = "Wednesday, 14 October 2026"
    r = requests.post(f"{API}/boats/{did}/email-log", json={"local_date": local_date}, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"device_id": did, "local_date": local_date, "payload": p, **body}


def test_email_log_success_response_shape(sent_log):
    ls = sent_log["log_sent"]
    assert ls["to"] == RECIPIENT
    assert ls["title"] == f"Ship's Log - TEST_Kia Ora (ZMA123) - Wednesday, 14 October 2026"
    assert ls["log_id"]
    assert ls["pdf_url"].endswith(f"/api/ship-logs/{ls['log_id']}.pdf")
    assert "at" in ls


def test_email_log_persists_on_boat(sent_log):
    g = requests.get(f"{API}/boats/{sent_log['device_id']}")
    assert g.status_code == 200
    ls = g.json()["log_sent"]
    assert ls and ls["log_id"] == sent_log["log_sent"]["log_id"]
    assert ls["to"] == RECIPIENT


def test_ship_log_pdf_ok(sent_log):
    log_id = sent_log["log_sent"]["log_id"]
    r = requests.get(f"{API}/ship-logs/{log_id}.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content.startswith(b"%PDF")


def test_ship_log_pdf_unknown_404():
    r = requests.get(f"{API}/ship-logs/{uuid.uuid4()}.pdf")
    assert r.status_code == 404


def test_ship_log_pdf_malformed_422():
    r = requests.get(f"{API}/ship-logs/not-a-uuid.pdf")
    assert r.status_code == 422


# --- PUT /boats round-trips log_email and log_sent ---
def test_boat_roundtrips_log_email_and_log_sent():
    did = f"test-{uuid.uuid4().hex[:16]}"
    p = _payload()
    p["log_sent"] = {"to": RECIPIENT, "at": datetime.now(timezone.utc).isoformat(),
                     "log_id": str(uuid.uuid4()), "pdf_url": "https://x/y.pdf", "title": "T"}
    r = requests.put(f"{API}/boats/{did}", json=p)
    assert r.status_code == 200
    g = requests.get(f"{API}/boats/{did}").json()
    assert g["boat"]["log_email"] == RECIPIENT
    assert g["log_sent"]["to"] == RECIPIENT
    assert g["log_sent"]["log_id"] == p["log_sent"]["log_id"]
