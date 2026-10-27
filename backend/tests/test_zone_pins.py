# Zone map pins API: PUT /api/boats/{boat_id}/zone-maps/{map_id}/pins validation, persistence, ownership
import os
import uuid
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
    mid = r.json()["zone_maps"][-1]["id"]
    assert r.json()["zone_maps"][-1]["pins"] == []
    yield mid
    pro.delete(f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{mid}")


def url(mid):
    return f"{BASE_URL}/api/boats/{BOAT}/zone-maps/{mid}/pins"


def pin(**kw):
    return {"id": "p1", "x": 0.5, "y": 0.5, "label": "TEST_Port Locker", "area_id": None, **kw}


def test_save_and_persist(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [pin(label="  TEST_Galley  ", area_id="a1"), pin(id="p2", x=0, y=1)]})
    assert r.status_code == 200, r.text
    m = next(m for m in r.json()["zone_maps"] if m["id"] == map_id)
    assert len(m["pins"]) == 2 and m["pins"][0]["label"] == "TEST_Galley" and m["pins"][0]["area_id"] == "a1"
    boats = s(PRO).get(f"{BASE_URL}/api/me/boats").json()["boats"]
    gm = next(m for b in boats if b["boat_id"] == BOAT for m in b["zone_maps"] if m["id"] == map_id)
    assert gm["pins"][1]["x"] == 0 and gm["pins"][1]["y"] == 1


@pytest.mark.parametrize("bad", [pin(x=1.2), pin(y=-0.1), pin(label=""), pin(label="x" * 61), pin(id="bad id!")])
def test_invalid_pin_422(map_id, bad):
    assert s(PRO).put(url(map_id), json={"pins": [bad]}).status_code == 422


def test_too_many_pins_422(map_id):
    assert s(PRO).put(url(map_id), json={"pins": [pin(id=f"p{i}") for i in range(61)]}).status_code == 422
    assert s(PRO).put(url(map_id), json={"pins": [pin(id=f"p{i}") for i in range(60)]}).status_code == 200


def test_whitespace_label(map_id):
    r = s(PRO).put(url(map_id), json={"pins": [pin(label="   ")]})
    print("whitespace-only label status", r.status_code, r.text[:200])
    assert r.status_code == 422, "whitespace-only label saved as empty string"


def test_unknown_map_404(map_id):
    assert s(PRO).put(url(str(uuid.uuid4())), json={"pins": []}).status_code == 404


def test_other_user_404(map_id):
    assert s(FREE).put(url(map_id), json={"pins": [pin()]}).status_code == 404


def test_unauth_401(map_id):
    assert requests.put(url(map_id), json={"pins": []}).status_code == 401


def test_clear_pins(map_id):
    r = s(PRO).put(url(map_id), json={"pins": []})
    assert r.status_code == 200
    assert next(m for m in r.json()["zone_maps"] if m["id"] == map_id)["pins"] == []
