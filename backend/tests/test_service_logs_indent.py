# Electrical Service template publish, electrical_log/engine_log sync via PUT /api/me/boat, and indented items in PDF rendering
import os
import sys
import requests
import pytest
from datetime import datetime, timezone
from pymongo import MongoClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ship_log import render_items, build_pdf  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = "test_session_admin_1"
PRO = "test_session_pro_1"
FREE = "test_session_free_1"


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


@pytest.fixture
def db():
    from dotenv import dotenv_values
    env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


# Admin publishes electricalService master template (with indent) and others see it
def test_publish_electrical_template(db):
    a = s(ADMIN)
    assert db.list_templates.find_one({"list_id": "electricalService"}) is None
    try:
        items = [{"id": 300, "label": "TEST_Battery", "indent": True}, {"id": 301, "label": "TEST_Fuses"}, {"id": 302, "label": "TEST_Sub", "indent": True}]
        r = a.put(f"{BASE_URL}/api/admin/templates/electricalService", json={"items": items})
        assert r.status_code == 200, r.text
        out = r.json()["items"]
        assert "indent" not in out[0]  # first item can't be indented
        assert out[2]["indent"] is True and "indent" not in out[1]
        got = s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"]
        assert "electricalService" in got
        assert [i["label"] for i in got["electricalService"]["items"]] == ["TEST_Battery", "TEST_Fuses", "TEST_Sub"]
        assert s(FREE).put(f"{BASE_URL}/api/admin/templates/electricalService", json={"items": items}).status_code == 403
    finally:
        db.list_templates.delete_one({"list_id": "electricalService"})
    assert "electricalService" not in s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"]


# electrical_log + engine_log + indent item field round-trip through PUT/GET /api/me/boat
def test_electrical_log_sync():
    p = s(PRO)
    st = p.get(f"{BASE_URL}/api/me/boat").json()
    orig_el, orig_en = st.get("electrical_log", []), st.get("engine_log", [])
    orig_data = st["data"]
    try:
        entry = {"id": 1, "electrician": "TEST_Sam", "date": "2026-01-10", "notes": "n", "items": ["Fuses and breakers"]}
        eng = {"id": 2, "hours": 1250, "date": "2026-01-10", "notes": "", "items": ["Oil change", "Oil filter"]}
        rig = list(orig_data.get("riggingChecks", []))
        assert len(rig) > 2
        rig2 = [dict(i) for i in rig]
        rig2[2]["indent"] = True
        rig2[2]["ts"] = now()
        body = {k: v for k, v in st.items() if k not in ("boat_id", "owner_id", "synced_at", "role", "sec_ts", "list_ts")}
        body.update(electrical_log=[entry], engine_log=[eng], data={**orig_data, "riggingChecks": rig2},
                    updated_at=now())
        r = p.put(f"{BASE_URL}/api/me/boat", json=body)
        assert r.status_code == 200, r.text
        g = p.get(f"{BASE_URL}/api/me/boat").json()
        assert g["electrical_log"][0]["electrician"] == "TEST_Sam"
        assert g["engine_log"][0]["items"] == ["Oil change", "Oil filter"]
        assert g["data"]["riggingChecks"][2].get("indent") is True
        # omitting electrical_log keeps it
        body2 = {k: v for k, v in body.items() if k != "electrical_log"}
        body2["updated_at"] = now()
        assert p.put(f"{BASE_URL}/api/me/boat", json=body2).status_code == 200
        assert p.get(f"{BASE_URL}/api/me/boat").json()["electrical_log"][0]["electrician"] == "TEST_Sam"
    finally:
        g = p.get(f"{BASE_URL}/api/me/boat").json()
        body = {k: v for k, v in g.items() if k not in ("boat_id", "owner_id", "synced_at", "role", "sec_ts", "list_ts")}
        restore = {**orig_data, "riggingChecks": [{**{k: v for k, v in i.items() if k != "indent"}, "ts": now()} for i in orig_data.get("riggingChecks", [])]}
        body.update(electrical_log=orig_el, engine_log=orig_en, data=restore, updated_at=now())
        p.put(f"{BASE_URL}/api/me/boat", json=body)
    g = p.get(f"{BASE_URL}/api/me/boat").json()
    assert g["electrical_log"] == orig_el and g["engine_log"] == orig_en
    assert not any(i.get("indent") for i in g["data"].get("riggingChecks", []))


# render_items keeps indent (never on first item) and build_pdf builds
def test_render_and_pdf_indent():
    items = [{"label": "A", "indent": True}, {"label": "B"}, {"label": "C", "indent": True, "checked": True}, {"label": "D", "indent": True, "flagged": True}]
    out = render_items(items, {"vessel": "V", "callsign": "C", "position": "", "local_date": ""})
    assert [i["indent"] for i in out] == [False, False, True, True]
    pdf = build_pdf({"vessel": "V", "skipper": "S", "callsign": "C", "local_date": "x", "created_at": "2026-01-01T00:00:00+00:00",
                     "lists": [{"name": "Rigging", "items": out}]})
    assert pdf[:4] == b"%PDF" and len(pdf) > 1000
