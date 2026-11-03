# Iteration 79: "1.Heading" grouping saved on admin template lists is pushed to every boat's copy
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
LINES = ["1.Trauma & Wound Management", "Severe Bleeding Control", "Wound Closure", "2.Orthopaedics", "Splints"]


@pytest.fixture
def tpl():
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST Indent Push Kit", "items": LINES}, headers=ADMIN)
    assert r.status_code == 200, r.text
    t = r.json()
    items = [{**i, "checked": n == 1, "notes": "kept"} for n, i in enumerate(t["items"])]
    db.user_boats.insert_one({"owner_id": "test-user-pro", "boat_id": "indentpush", "boat": {"name": "Indent Test"}, "registry": [{"id": t["id"], "name": t["name"]}],
                              "data": {t["id"]: items}, "updated_at": "2026-01-01T00:00:00+00:00", "template_versions": {t["id"]: t["updated_at"]},
                              "synced_at": "2026-01-01T00:00:00+00:00", "crew": []})
    yield t
    requests.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}", headers=ADMIN)
    db.user_boats.delete_one({"owner_id": "test-user-pro", "boat_id": "indentpush"})


def test_indent_pushed_to_boats(tpl):
    assert not any(i.get("indent") for i in tpl["items"])
    lines = [{"label": l, "indent": n not in (0, 3)} for n, l in enumerate(LINES)]
    r = requests.put(f"{BASE_URL}/api/admin/template-lists/{tpl['id']}", json={"name": tpl["name"], "items": lines}, headers=ADMIN)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert [bool(i.get("indent")) for i in saved["items"]] == [False, True, True, False, True]
    b = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "indentpush"}, headers=PRO)
    assert b.status_code == 200, b.text
    boat = b.json()
    got = boat["data"][tpl["id"]]
    assert [bool(i.get("indent")) for i in got] == [False, True, True, False, True]
    assert got[1]["checked"] is True and all(i["notes"] == "kept" for i in got)
    assert boat["template_versions"][tpl["id"]] == saved["updated_at"]


def test_listing_shows_indent_after_reopen(tpl):
    lines = [{"label": l, "indent": n not in (0, 3)} for n, l in enumerate(LINES)]
    requests.put(f"{BASE_URL}/api/admin/template-lists/{tpl['id']}", json={"name": tpl["name"], "items": lines}, headers=ADMIN)
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN)
    mine = next(t for t in r.json() if t["id"] == tpl["id"])
    assert any(i.get("indent") for i in mine["items"])
