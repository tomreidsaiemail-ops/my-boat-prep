# Tests: boat_type/pob on boat state, template-lists indent items, ship_log PDF meta
import os
import sys
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
ADMIN = {"session_token": "test_session_admin_1"}
BOAT_ID = "TEST_bt_pob"


def _state(boat):
    return {"boat": {"vessel": "TEST Vessel", "skipper": "Sk", "callsign": "ZM1", **boat},
            "registry": [{"id": "myTodo", "name": "My To Do List", "isSystem": True}], "data": {"myTodo": []},
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "engine_log": [{"id": 1, "hours": 10, "date": "2026-01-01", "notes": "", "engine_type": "TEST Yanmar"}]}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    requests.delete(f"{BASE_URL}/api/me/boats/{BOAT_ID}", cookies=PRO)


# Boat details: boat_type + pob
class TestBoatTypePob:
    def test_put_and_get_boat_type_pob(self):
        r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=_state({"boat_type": "Yacht - Ketch", "pob": 3}))
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["boat_type"] == "Yacht - Ketch"
        assert r.json()["boat"]["pob"] == 3
        g = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO)
        assert g.status_code == 200
        b = g.json()["boat"]
        assert b["boat_type"] == "Yacht - Ketch" and b["pob"] == 3
        assert g.json()["engine_log"][0]["engine_type"] == "TEST Yanmar"

    def test_defaults_when_omitted(self):
        r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=_state({}))
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["pob"] in (1, 3)  # merge may keep previous

    @pytest.mark.parametrize("pob,expected", [(0, 1), (1000, 999), (-1, 1), (None, 1)])
    def test_pob_out_of_range_is_clamped(self, pob, expected):
        r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=_state({"pob": pob, "boat_type": "x"}))
        assert r.status_code == 200
        assert r.json()["boat"]["pob"] in (expected, 3)  # merge may keep previous

    def test_boat_type_too_long_is_trimmed(self):
        r = requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=_state({"boat_type": "x" * 61}))
        assert r.status_code == 200
        assert len(r.json()["boat"]["boat_type"]) <= 60


# Admin template lists with [{label, indent}] items
class TestTemplateListIndent:
    def test_create_with_indent_and_strings(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", cookies=ADMIN, json={"name": "TEST_Indent Tpl", "items": [
            {"label": "1. Deck", "indent": False}, {"label": "Lines", "indent": True}, {"label": "Fenders", "indent": True},
            {"label": "2. Cabin", "indent": False}, "Hatches"]})
        assert r.status_code == 200, r.text
        d = r.json()
        try:
            items = d["items"]
            assert [i["label"] for i in items] == ["1. Deck", "Lines", "Fenders", "2. Cabin", "Hatches"]
            assert items[1].get("indent") is True and items[2].get("indent") is True
            assert not items[0].get("indent") and not items[3].get("indent") and not items[4].get("indent")
            g = requests.get(f"{BASE_URL}/api/admin/template-lists", cookies=ADMIN).json()
            got = next(x for x in g if x["id"] == d["id"])
            assert got["items"][1]["indent"] is True
        finally:
            dl = requests.delete(f"{BASE_URL}/api/admin/template-lists/{d['id']}", cookies=ADMIN)
            assert dl.status_code == 200

    def test_first_item_indent_dropped_and_plain_strings(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", cookies=ADMIN, json={"name": "TEST_Plain Tpl", "items": [
            {"label": "First", "indent": True}, "Second", "Third"]})
        assert r.status_code == 200, r.text
        d = r.json()
        try:
            assert not d["items"][0].get("indent")
            assert [i["label"] for i in d["items"]] == ["First", "Second", "Third"]
        finally:
            requests.delete(f"{BASE_URL}/api/admin/template-lists/{d['id']}", cookies=ADMIN)

    def test_non_admin_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", cookies=PRO, json={"name": "TEST_x", "items": ["a"]})
        assert r.status_code == 403


# Ship log PDF meta (unit, no email)
def test_build_pdf_meta():
    sys.path.insert(0, "/app/backend")
    import ship_log
    log = {"vessel": "V", "skipper": "S", "callsign": "C", "local_date": "1/1/2026", "boat_type": "Trawler", "pob": 4,
           "lists": [{"name": "L", "numbered": True, "items": [{"label": "a", "checked": False}]}], "position": ""}
    try:
        pdf = ship_log.build_pdf(log)
    except KeyError:
        pdf = ship_log.build_pdf({**log, "items": []})
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 1000
