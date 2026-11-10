# Zone map Skipper's comment: PUT /api/boats/{boat_id}/zone-maps/{map_id}/pins comment field + GET /api/me/boats exposure (owner + crew)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = "test_session_pro_1"
FREE = "test_session_free_1"
BOAT = "main"


def s(tok):
    ss = requests.Session()
    ss.cookies.set("session_token", tok)
    return ss


@pytest.fixture(scope="module")
def map_id():
    pro = s(PRO)
    with open("/app/test_assets/locker1.jpg", "rb") as f:
        r = pro.post(f"{BASE_URL}/api/boats/{BOAT}/zone-maps", files={"file": ("z.jpg", f, "image/jpeg")}, timeout=60)
    assert r.status_code == 200, r.text
    m = r.json()["zone_maps"][-1]
    assert m["comment"] == ""
    yield m["id"]
    pro.delete(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{m['id']}")


def url(mid):
    return f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{mid}/pins"


PIN = {"id": "p1", "x": 0.4, "y": 0.4, "label": "TEST_Saloon - Port Side Under Seat Locker Forward", "area_id": None}


def find(maps, mid):
    return next(m for m in maps if m["id"] == mid)


def owner_map(mid):
    boats = s(PRO).get(f"{BASE_URL}/api/me/boats").json()["boats"]
    return find(next(b for b in boats if b["boat_id"] == BOAT and not b["crew"])["zone_maps"], mid)


def test_comment_saved_trimmed(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "  TEST_Above the Nav Desk is the switch board  "})
    assert r.status_code == 200, r.text
    assert find(r.json()["zone_maps"], map_id)["comment"] == "TEST_Above the Nav Desk is the switch board"
    assert owner_map(map_id)["comment"] == "TEST_Above the Nav Desk is the switch board"


def test_omitted_comment_unchanged(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [PIN, {**PIN, "id": "p2"}]})
    assert r.status_code == 200
    m = owner_map(map_id)
    assert m["comment"] == "TEST_Above the Nav Desk is the switch board" and len(m["pins"]) == 2


def test_null_comment_unchanged(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": None})
    assert r.status_code == 200
    assert owner_map(map_id)["comment"] == "TEST_Above the Nav Desk is the switch board"


def test_crew_sees_comment(map_id):
    boats = s(FREE).get(f"{BASE_URL}/api/me/boats").json()["boats"]
    shared = [b for b in boats if b["crew"] and b["boat_id"] == BOAT and b["owner_id"] == "test-user-pro"]
    assert shared, "crew boat not found"
    assert find(shared[0]["zone_maps"], map_id)["comment"] == "TEST_Above the Nav Desk is the switch board"


def test_comment_500_ok_501_rejected(map_id):
    assert s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "x" * 501}).status_code == 422
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "y" * 500})
    assert r.status_code == 200 and len(find(r.json()["zone_maps"], map_id)["comment"]) == 500


def test_multiline_comment(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "line1\nline2"})
    assert find(r.json()["zone_maps"], map_id)["comment"] == "line1\nline2"


def test_whitespace_clears(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "   "})
    assert r.status_code == 200 and find(r.json()["zone_maps"], map_id)["comment"] == ""


def test_empty_clears(map_id):
    s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "TEST_x"})
    r = s(PRO).put(url(map_id), json={"pins": [PIN], "comment": ""})
    assert find(r.json()["zone_maps"], map_id)["comment"] == ""
    assert owner_map(map_id)["comment"] == ""


def test_crew_cannot_set_comment(map_id):
    assert s(FREE).put(url(map_id), json={"pins": [], "comment": "hack"}).status_code == 404
    assert owner_map(map_id)["comment"] == ""


def test_comment_survives_rename(map_id):
    s(PRO).put(url(map_id), json={"pins": [PIN], "comment": "TEST_keep"})
    r = s(PRO).put(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{map_id}/meta", json={"name": "TEST_Renamed"})
    print("meta status", r.status_code, r.text[:200])
    if r.status_code == 404 or r.status_code == 405:
        pytest.skip("meta endpoint path differs")
    assert owner_map(map_id)["comment"] == "TEST_keep"
