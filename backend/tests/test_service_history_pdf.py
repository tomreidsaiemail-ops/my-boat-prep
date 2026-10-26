# Service History PDF export (POST /api/service-history/pdf): tiers, validation, PDF content
import io
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/service-history/pdf"
PRO, ADMIN, FREE, BETA = "test_session_pro_1", "test_session_admin_1", "test_session_free_1", "test_session_beta_1"

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


def text_of(content):
    if PdfReader is None:
        pytest.skip("pypdf not installed")
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(content)).pages)


ENGINE = {"kind": "engine", "vessel": "TEST_Kia Ora", "skipper": "Tom", "callsign": "ZM1234", "local_date": "26/10/2026",
          "entries": [{"date": "2026-01-05", "hours": 1200, "notes": "old one", "items": ["Oil"]},
                      {"date": "2026-09-14", "hours": 1450.5, "notes": "250hr service", "items": ["Impeller", "Fuel filter"]}]}


# Premium tiers get a PDF attachment with the right filename
@pytest.mark.parametrize("tok", [PRO, ADMIN, BETA])
def test_premium_gets_pdf(tok):
    r = s(tok).post(URL, json=ENGINE)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    assert 'filename="Engine Service History - TEST_Kia Ora.pdf"' in r.headers["content-disposition"]
    assert r.headers["content-disposition"].startswith("attachment")


# Free and anonymous are blocked
def test_free_forbidden():
    r = s(FREE).post(URL, json=ENGINE)
    assert r.status_code == 403
    assert "Upgrade" in r.json()["detail"]


def test_anon_unauthorized():
    assert requests.post(URL, json=ENGINE).status_code == 401


# Validation: bad kind, bad date
def test_bad_kind_422():
    assert s(PRO).post(URL, json={**ENGINE, "kind": "hull"}).status_code == 422


def test_bad_date_422():
    bad = {**ENGINE, "entries": [{"date": "14/09/2026", "notes": "", "items": []}]}
    assert s(PRO).post(URL, json=bad).status_code == 422


# Engine content: title, meta, summary w/ hours, newest-first ordering, bullets
def test_engine_pdf_content():
    t = text_of(s(PRO).post(URL, json=ENGINE).content)
    assert "ENGINE SERVICE HISTORY" in t
    assert "TEST_Kia Ora" in t and "Tom" in t and "ZM1234" in t and "26/10/2026" in t
    assert "2 services logged" in t
    assert "last service 14/09/2026 (1450.5 hrs)" in t
    assert "Engine hours" in t and "Work done" in t and "Notes" in t
    assert t.index("14/09/2026", t.index("Work done")) < t.index("05/01/2026")
    assert "Impeller" in t and "Fuel filter" in t and "250hr service" in t  # bullet glyph extracts as \x7f in pypdf


# Electrical content with electrician name
def test_electrical_pdf_content():
    body = {**ENGINE, "kind": "electrical", "entries": [{"date": "2026-08-01", "electrician": "Sam Watts", "notes": "", "items": []}]}
    r = s(PRO).post(URL, json=body)
    assert 'filename="Electrical Service History - TEST_Kia Ora.pdf"' in r.headers["content-disposition"]
    t = text_of(r.content)
    assert "ELECTRICAL SERVICE HISTORY" in t
    assert "1 service logged" in t and "last service 01/08/2026 (by Sam Watts)" in t
    assert "Electrician" in t


# Empty history
def test_empty_history():
    t = text_of(s(PRO).post(URL, json={**ENGINE, "entries": []}).content)
    assert "0 services logged" in t
    assert "No services logged yet." in t


# Empty vessel falls back to My Boat filename
def test_empty_vessel_filename():
    r = s(PRO).post(URL, json={**ENGINE, "vessel": ""})
    assert 'filename="Engine Service History - My Boat.pdf"' in r.headers["content-disposition"]


# Non-latin vessel names (e.g. Maori macrons) must not crash the Content-Disposition header
def test_unicode_vessel_name():
    r = s(PRO).post(URL, json={**ENGINE, "vessel": "Kia Ōra"})
    assert r.status_code == 200, r.status_code
    assert r.content[:4] == b"%PDF"
