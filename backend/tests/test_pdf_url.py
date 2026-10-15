"""Tests for pdf_url host derivation (public_base) in email-log."""
import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
RECIPIENT = "delivered@resend.dev"
EXPECTED_HOST = "gemini-prototype.preview.emergentagent.com"


def _payload():
    return {
        "boat": {"vessel": "TEST_PdfLink", "skipper": "TEST_Skipper", "callsign": "ZMA999", "log_email": RECIPIENT},
        "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
        "data": {"shipsLog": [{"id": 1, "label": "Departed port", "checked": True}]},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# --- Live: pdf_url derived from request host matches external preview URL ---
def test_email_log_pdf_url_uses_external_host():
    did = f"test-pdflink-{uuid.uuid4().hex[:12]}"
    assert requests.put(f"{API}/boats/{did}", json=_payload()).status_code == 200
    r = requests.post(
        f"{API}/boats/{did}/email-log",
        json={"local_date": "Wednesday, 14 October 2026"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    pdf_url = r.json()["log_sent"]["pdf_url"]
    assert pdf_url.startswith(f"https://{EXPECTED_HOST}/api/ship-logs/"), pdf_url
    assert pdf_url.endswith(".pdf")

    # And the URL actually serves a valid PDF
    g = requests.get(pdf_url, timeout=30)
    assert g.status_code == 200
    assert g.headers["content-type"].startswith("application/pdf")
    assert g.content.startswith(b"%PDF")


# --- Spoofing: X-Forwarded-Host from client is NOT trusted end-to-end ---
# Note: the kubernetes ingress typically overwrites X-Forwarded-Host with the real external host.
# This test asserts that whatever the server does, the result is NOT evil.example.com.
def test_email_log_pdf_url_ignores_spoofed_forwarded_host():
    did = f"test-pdflink-{uuid.uuid4().hex[:12]}"
    assert requests.put(f"{API}/boats/{did}", json=_payload()).status_code == 200
    r = requests.post(
        f"{API}/boats/{did}/email-log",
        json={"local_date": "Wednesday, 14 October 2026"},
        headers={"X-Forwarded-Host": "evil.example.com"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    pdf_url = r.json()["log_sent"]["pdf_url"]
    assert "evil.example.com" not in pdf_url, pdf_url
    # It should still land on the external preview host
    assert pdf_url.startswith(f"https://{EXPECTED_HOST}/api/ship-logs/"), pdf_url


# --- Unit test public_base() directly ---
@pytest.fixture
def public_base_fn():
    from server import public_base, PUBLIC_APP_URL
    return public_base, PUBLIC_APP_URL


def _req(headers: dict):
    req = MagicMock()
    req.headers = headers
    return req


@pytest.mark.parametrize("host", [
    "evil.com:8080",   # port -> rejected
    "localhost",       # no TLD
    "127.0.0.1",       # IP
    "",                # empty
    "has space.com",   # whitespace
    "evil.com/path",   # slash
    "a.b",             # too short overall (<4)
])
def test_public_base_rejects_bad_hosts(public_base_fn, host):
    public_base, PUBLIC_APP_URL = public_base_fn
    assert public_base(_req({"host": host})) == PUBLIC_APP_URL
    assert public_base(_req({"x-forwarded-host": host})) == PUBLIC_APP_URL


@pytest.mark.parametrize("host", [
    "myboatprep.com",
    "gemini-prototype.emergent.host",
    "gemini-prototype.preview.emergentagent.com",
    "sub.domain.example.co",
])
def test_public_base_accepts_valid_hosts(public_base_fn, host):
    public_base, _ = public_base_fn
    assert public_base(_req({"host": host})) == f"https://{host}"
    # x-forwarded-host wins over host
    assert public_base(_req({"x-forwarded-host": host, "host": "other.com"})) == f"https://{host}"


def test_public_base_strips_comma_list(public_base_fn):
    public_base, _ = public_base_fn
    # X-Forwarded-Host may contain comma-separated hops; take the first
    assert public_base(_req({"x-forwarded-host": "myboatprep.com, proxy.internal"})) == "https://myboatprep.com"


def test_public_base_case_insensitive(public_base_fn):
    public_base, _ = public_base_fn
    assert public_base(_req({"host": "MyBoatPrep.COM"})) == "https://myboatprep.com"


def test_public_base_missing_headers(public_base_fn):
    public_base, PUBLIC_APP_URL = public_base_fn
    assert public_base(_req({})) == PUBLIC_APP_URL
