# MAYDAY / PAN-PAN admin templates (ADMIN - MAYDAY TEMPLATE / ADMIN - PAN-PAN TEMPLATE) and backend fill_radio
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
sys.path.insert(0, "/app/backend")

MAYDAY = ["Tune VHF Radio to Channel 16", "Transmit: MAYDAY MAYDAY MAYDAY", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>", "Callsign <CALLSIGN>",
          "MAYDAY <BOAT NAME> <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of distress and what assistance is required",
          "Other information - there are <POB> persons on board (POB). The boat is a <BOAT COLOUR> <BOAT TYPE>. Length <LENGTH>. <Optional MMSI Number>", "OVER"]
PANPAN = ["Tune VHF Radio to Channel 16", "Transmit: PAN-PAN PAN-PAN PAN-PAN", "ALL STATIONS, ALL STATIONS, ALL STATIONS", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>",
          "Callsign <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of urgency and what assistance is required",
          "Other information - there are <POB> persons on board (POB). The boat is a <BOAT COLOUR> <BOAT TYPE>. Length <LENGTH>. <Optional MMSI Number>", "OVER"]


def s(tok):
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {tok}"})
    return x


@pytest.mark.parametrize("tok", ["test_session_beta_1", "test_session_free_1", "test_session_admin_1"])
@pytest.mark.parametrize("name,lines,last", [("ADMIN - MAYDAY TEMPLATE", MAYDAY, "repeat the distress call"), ("ADMIN - PAN-PAN TEMPLATE", PANPAN, "repeat the urgency call")])
def test_admin_lists(tok, name, lines, last):
    r = s(tok).get(f"{BASE_URL}/api/admin-lists", params={"prefix": name})
    assert r.status_code == 200, r.text
    ls = [l for l in r.json()["lists"] if l["name"].lower() == name.lower()]
    assert len(ls) == 1
    labels = [i["label"] for i in ls[0]["items"]]
    assert len(labels) == 10
    assert labels[:9] == lines
    assert last in labels[9]
    assert not any(l[:1].isdigit() for l in labels)


def test_panpan_no_mayday_line():
    r = s("test_session_beta_1").get(f"{BASE_URL}/api/admin-lists", params={"prefix": "ADMIN - PAN-PAN TEMPLATE"})
    labels = [i["label"] for i in r.json()["lists"][0]["items"]]
    assert not any(l.startswith("MAYDAY") for l in labels)
    assert "ready to activate your distress beacon" in labels[9]


def test_admin_lists_requires_auth():
    assert requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "ADMIN - MAYDAY TEMPLATE"}).status_code == 401


def test_admin_template_lists_shows_private():
    r = s("test_session_admin_1").get(f"{BASE_URL}/api/admin/template-lists")
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("lists") or data.get("templates") or []
    names = {(t.get("name") or "").strip(): t for t in items}
    for n in ("ADMIN - MAYDAY TEMPLATE", "ADMIN - PAN-PAN TEMPLATE"):
        assert n in names, list(names)[:50]
        assert names[n].get("private") is True


def test_non_admin_cannot_list_templates():
    assert s("test_session_beta_1").get(f"{BASE_URL}/api/admin/template-lists").status_code in (401, 403)


# backend fill_radio (ship log)
from radio_templates import fill_radio  # noqa: E402

C = {"vessel": "Bacchus", "callsign": "ZMA1234", "position": "36.8S 174.7E", "pob": 4, "boat_type": "Catamaran", "hull": "White", "deck": "white", "length": "12 m", "mmsi": ""}


def test_fill_full_same_colour_no_mmsi():
    assert fill_radio(MAYDAY[7], C) == "Other information - there are 4 persons on board (POB). The boat is a white Catamaran. Length 12 m."
    assert fill_radio(MAYDAY[2], C) == "This is Bacchus, Bacchus, Bacchus"
    assert fill_radio(MAYDAY[4], C) == "MAYDAY Bacchus ZMA1234 - Zulu Mike Alpha 1234"
    assert fill_radio(MAYDAY[5], C).endswith("at position 36.8S 174.7E")


def test_fill_mmsi_and_diff_colour():
    out = fill_radio(MAYDAY[7], {**C, "deck": "Blue", "mmsi": "512345678"})
    assert out == "Other information - there are 4 persons on board (POB). The boat is a Catamaran with a white hull and blue deck. Length 12 m. MMSI 512345678."


def test_fill_missing_keeps_tags():
    out = fill_radio(MAYDAY[7], {"pob": 0, "mmsi": None})
    assert "None" not in out and "<Optional MMSI Number>" not in out
    assert "<POB>" in out and "<LENGTH>" in out and "<BOAT COLOUR> <BOAT TYPE>" in out
    assert fill_radio(MAYDAY[3], {"callsign": ""}) == "Callsign <CALLSIGN>"
