# MAYDAY setup (Welcome): BoatDetails shore_name / no_shore / no_mmsi persistence and crew stripping
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = "test_session_pro_1"
CREW = "test_session_free_1"


def client(tok):
    s = requests.Session()
    s.cookies.set("session_token", tok)
    return s


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@pytest.fixture(scope="module")
def original():
    s = client(PRO)
    r = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"})
    assert r.status_code == 200
    data = r.json()
    yield data
    # restore the changed boat fields
    b = data["boat"]
    t = now()
    restore = {k: b.get(k) for k in ("shore_name", "no_shore", "no_mmsi", "mmsi")}
    cur = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()
    cur["boat"].update({"shore_name": restore["shore_name"] or "", "no_shore": bool(restore["no_shore"]), "no_mmsi": bool(restore["no_mmsi"]), "mmsi": restore["mmsi"] or ""})
    cur["boat_ts"] = {**(cur.get("boat_ts") or {}), **{k: t for k in ("shore_name", "no_shore", "no_mmsi", "mmsi")}}
    cur.pop("role", None)
    s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=cur)


# Defaults present in owner GET
def test_fields_present(original):
    b = original["boat"]
    assert "shore_name" in b and "no_shore" in b and "no_mmsi" in b
    assert isinstance(b["no_shore"], bool) and isinstance(b["no_mmsi"], bool)


# Owner saves shore_name/no_shore/no_mmsi -> persisted
def test_owner_save_and_get(original):
    s = client(PRO)
    cur = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()
    t = now()
    cur["boat"].update({"shore_name": "TEST_Shore Person", "no_shore": True, "no_mmsi": True})
    cur["boat_ts"] = {**(cur.get("boat_ts") or {}), "shore_name": t, "no_shore": t, "no_mmsi": t}
    cur.pop("role", None)
    r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=cur)
    assert r.status_code == 200, r.text
    g = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()["boat"]
    assert g["shore_name"] == "TEST_Shore Person"
    assert g["no_shore"] is True and g["no_mmsi"] is True


# shore_name > 60 chars rejected
def test_shore_name_max_len(original):
    s = client(PRO)
    cur = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()
    cur["boat"]["shore_name"] = "x" * 61
    cur.pop("role", None)
    r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=cur)
    assert r.status_code == 422


# Crew GET of owner boat: shore_name stripped, crew PUT doesn't wipe it
def test_crew_stripped(original):
    c = client(CREW)
    r = c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main", "owner": "test-user-pro"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "crew"
    assert d["boat"]["shore_name"] == "" and d["boat"]["shore_email"] == ""
    d.pop("role", None)
    p = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main", "owner": "test-user-pro"}, json=d)
    assert p.status_code == 200, p.text
    g = client(PRO).get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}).json()["boat"]
    assert g["shore_name"] == "TEST_Shore Person"
