# Boat Inventory API tests: shared info, zone map (admin only), suggested cupboards, areas persistence, email-log inventory lines
import os
import struct
import zlib

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN, PRO, FREE = "test_session_admin_1", "test_session_pro_1", "test_session_free_1"
PRO_ID = "test-user-pro"
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BOAT = "TEST_inv1"
T0, T1, T2 = "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z"


def s(tok=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    return ss


def png_bytes():
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b"")


def state(areas=None, ts=T0, **extra):
    st = {"boat": {"vessel": "TEST_Inv", "skipper": "TEST_Sk", "callsign": "TEST_CS", "log_email": "delivered@resend.dev"},
          "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
          "data": {"shipsLog": [{"id": 1, "label": "x", "checked": False}]},
          "updated_at": ts, "sec_ts": {"boat": ts, "registry": ts, **({"areas": ts} if areas is not None else {})}, **extra}
    if areas is not None:
        st["areas"] = areas
    return st


AREAS = [{"id": "aTEST1", "name": "TEST_Lazarette", "items": [{"id": "i1", "name": "Spare impeller", "qty": 2, "removed": True}]}]


@pytest.fixture(scope="module", autouse=True)
def snapshot():
    saved = {k: DB.app_settings.find_one({"key": k}, {"_id": 0}) for k in ("zone_map", "area_defaults")}
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})
    yield
    for k, doc in saved.items():
        DB.app_settings.delete_one({"key": k})
        if doc:
            DB.app_settings.insert_one(doc)
    DB.user_boats.delete_many({"owner_id": PRO_ID, "boat_id": BOAT})


# Shared info / auth
class TestShared:
    def test_shared_requires_auth(self):
        assert s().get(f"{BASE_URL}/api/inventory/shared").status_code == 401

    def test_shared_for_free_user(self):
        r = s(FREE).get(f"{BASE_URL}/api/inventory/shared")
        assert r.status_code == 200
        d = r.json()
        assert set(d) == {"zone_map_v", "area_defaults"}
        assert isinstance(d["area_defaults"], list)

    def test_zone_map_get_requires_auth(self):
        assert s().get(f"{BASE_URL}/api/inventory/zone-map").status_code == 401


# Zone map admin endpoints
class TestZoneMap:
    @pytest.mark.parametrize("tok", [PRO, FREE])
    def test_non_admin_upload_403(self, tok):
        r = s(tok).post(f"{BASE_URL}/api/admin/inventory/zone-map", files={"file": ("z.png", png_bytes(), "image/png")})
        assert r.status_code == 403

    @pytest.mark.parametrize("tok", [PRO, FREE])
    def test_non_admin_delete_403(self, tok):
        assert s(tok).delete(f"{BASE_URL}/api/admin/inventory/zone-map").status_code == 403

    def test_text_file_400(self):
        r = s(ADMIN).post(f"{BASE_URL}/api/admin/inventory/zone-map", files={"file": ("z.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_too_big_400(self):
        r = s(ADMIN).post(f"{BASE_URL}/api/admin/inventory/zone-map", files={"file": ("z.jpg", b"\xff" * (3 * 1024 * 1024 + 10), "image/jpeg")})
        assert r.status_code == 400
        assert "too big" in r.json()["detail"]

    def test_upload_get_remove(self):
        a = s(ADMIN)
        r = a.post(f"{BASE_URL}/api/admin/inventory/zone-map", files={"file": ("z.png", png_bytes(), "image/png")})
        assert r.status_code == 200, r.text
        v = r.json()["zone_map_v"]
        assert isinstance(v, str) and v
        assert s(PRO).get(f"{BASE_URL}/api/inventory/shared").json()["zone_map_v"] == v
        g = s(FREE).get(f"{BASE_URL}/api/inventory/zone-map")
        assert g.status_code == 200 and g.content == png_bytes() and g.headers["content-type"] == "image/png"
        d = a.delete(f"{BASE_URL}/api/admin/inventory/zone-map")
        assert d.status_code == 200 and d.json()["zone_map_v"] is None
        assert s(PRO).get(f"{BASE_URL}/api/inventory/shared").json()["zone_map_v"] is None
        assert s(PRO).get(f"{BASE_URL}/api/inventory/zone-map").status_code == 404


# Suggested cupboards
class TestAreaDefaults:
    def test_non_admin_403(self):
        assert s(PRO).put(f"{BASE_URL}/api/admin/inventory/area-defaults", json={"names": ["A"]}).status_code == 403

    def test_empty_400(self):
        assert s(ADMIN).put(f"{BASE_URL}/api/admin/inventory/area-defaults", json={"names": []}).status_code == 400
        assert s(ADMIN).put(f"{BASE_URL}/api/admin/inventory/area-defaults", json={"names": ["  ", ""]}).status_code == 400

    def test_dedupe_and_persist(self):
        r = s(ADMIN).put(f"{BASE_URL}/api/admin/inventory/area-defaults", json={"names": [" TEST_Bow locker ", "test_bow LOCKER", "TEST_Stern"]})
        assert r.status_code == 200
        assert r.json()["area_defaults"] == ["TEST_Bow locker", "TEST_Stern"]
        assert s(FREE).get(f"{BASE_URL}/api/inventory/shared").json()["area_defaults"] == ["TEST_Bow locker", "TEST_Stern"]


# Areas on a boat state
class TestBoatAreas:
    def test_save_and_keep_when_omitted(self):
        p = s(PRO)
        r = p.put(f"{BASE_URL}/api/me/boat?boat_id={BOAT}", json=state(AREAS))
        assert r.status_code == 200, r.text
        assert r.json()["areas"] == AREAS
        r2 = p.put(f"{BASE_URL}/api/me/boat?boat_id={BOAT}", json=state(None, ts=T1))
        assert r2.status_code == 200
        assert r2.json()["areas"] == AREAS
        g = p.get(f"{BASE_URL}/api/me/boat?boat_id={BOAT}").json()
        assert g["areas"] == AREAS

    def test_update_areas_newer(self):
        p = s(PRO)
        new = [{**AREAS[0], "items": []}, {"id": "aTEST2", "name": "TEST_Saloon", "items": []}]
        r = p.put(f"{BASE_URL}/api/me/boat?boat_id={BOAT}", json=state(new, ts=T2))
        assert r.status_code == 200
        assert p.get(f"{BASE_URL}/api/me/boat?boat_id={BOAT}").json()["areas"] == new

    def test_email_log_inventory_lines(self):
        p = s(PRO)
        p.put(f"{BASE_URL}/api/me/boat?boat_id={BOAT}", json=state(AREAS, ts="2026-01-05T00:00:00Z"))
        r = p.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "Monday 5 January 2026", "list_ids": ["boatInventory"], "boat_id": BOAT})
        assert r.status_code == 200, r.text
        log_id = r.json()["log_sent"]["log_id"]
        log = DB.ship_logs.find_one({"log_id": log_id}, {"_id": 0})
        assert log["lists"][0]["name"] == "Boat Inventory"
        assert log["lists"][0]["items"][0]["label"] == "TEST_Lazarette: Spare impeller x2 (removed for now)"
        assert log["lists"][0]["items"][0]["checked"] is True
        pdf = requests.get(f"{BASE_URL}/api/ship-logs/{log_id}.pdf")
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        DB.ship_logs.delete_one({"log_id": log_id})
