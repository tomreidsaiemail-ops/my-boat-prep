# Iteration 157: My settings privacy ignore_300, land filter bypass, help panel list, old exclusion list removed, crew-register phone validation
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
LAND = (-39.60, 175.60)
WATER = (-36.60, 175.00)


def _privacy(on):
    r = requests.put(f"{BASE_URL}/api/me/privacy", headers=PRO, json={"ignore_300": on}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _ping(trip_id, lat, lon):
    return requests.post(f"{BASE_URL}/api/track/points", headers=PRO, timeout=60, json={
        "boat_id": "main", "trip_id": trip_id, "points": [{"lat": lat, "lon": lon, "at": int(time.time() * 1000), "kind": "ping"}]})


@pytest.fixture(scope="module")
def trip_id():
    r = requests.get(f"{BASE_URL}/api/boats/main/shore", headers=PRO, timeout=30)
    assert r.status_code == 200
    t = r.json().get("tracking") or {}
    if not t.get("on"):
        pytest.skip(f"tracking not on for main: {t}")
    yield t["trip_id"]
    _privacy(False)


# PUT /api/me/privacy + GET /api/auth/me persistence
class TestPrivacy:
    def test_toggle_persists(self):
        d = _privacy(True)
        assert d["ignore_300"] is True
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=PRO, timeout=30).json()
        assert me["ignore_300"] is True
        d = _privacy(False)
        assert d["ignore_300"] is False
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=PRO, timeout=30).json()
        assert me["ignore_300"] is False

    def test_invalid_body(self):
        r = requests.put(f"{BASE_URL}/api/me/privacy", headers=PRO, json={}, timeout=30)
        assert r.status_code == 422

    def test_unauth(self):
        r = requests.put(f"{BASE_URL}/api/me/privacy", json={"ignore_300": True}, timeout=30)
        assert r.status_code == 401


# Land filter bypass via ignore_300
class TestLandFilter:
    def test_land_point_with_ignore_on(self, trip_id):
        _privacy(True)
        r = _ping(trip_id, *LAND)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["saved"] == 1 and d["ashore"] is False, d
        assert d["tracking"]["ashore_since"] is None
        assert d["tracking"]["relayed"] is True

    def test_land_point_with_ignore_off(self, trip_id):
        _privacy(False)
        time.sleep(0.01)
        r = _ping(trip_id, *LAND)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["saved"] == 0 and d["ashore"] is True, d
        assert d["tracking"]["ashore_since"]

    def test_water_point_clears_ashore(self, trip_id):
        r = _ping(trip_id, *WATER)
        d = r.json()
        assert d["saved"] == 1 and d["ashore"] is False, d
        assert d["tracking"]["ashore_since"] is None and d["tracking"]["relayed"] is True
        boats = requests.get(f"{BASE_URL}/api/me/boats", headers=PRO, timeout=30).json()
        lst = boats if isinstance(boats, list) else boats.get("boats", [])
        main = next(b for b in lst if b.get("boat_id") == "main")
        assert main["tracking"]["on"] is True and main["tracking"]["ashore_since"] is None and main["tracking"]["relayed"] is True


# Admin lists: help panel seeded, old exclusion list gone
class TestAdminLists:
    def test_help_panel(self):
        r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel - "}, headers=PRO, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        lists = data if isinstance(data, list) else data.get("lists", data.get("items", []))
        p = next((x for x in lists if x["name"].strip().lower() == "admin - help panel - ignore 300 metre warning"), None)
        assert p, [x["name"] for x in lists]
        items = p["items"]
        assert len(items) == 6, items
        assert items[3]["label"].strip() == "Notes"
        assert [bool(i.get("indent")) for i in items] == [False, False, False, False, True, True]

    def test_old_exclusion_gone(self):
        r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers={"Authorization": "Bearer test_session_admin_1"}, timeout=30)
        assert r.status_code == 200, r.text
        names = [x["name"].lower() for x in r.json()]
        assert not any("gps broadcast exclusion" in n for n in names), names
        assert any("ignore 300 metre warning" in n for n in names)


# Crew registration phone validation
class TestCrewRegisterPhone:
    def _post(self, phone, nok=""):
        return requests.post(f"{BASE_URL}/api/crew-register", headers=PRO, timeout=30, json={
            "kind": "crew", "name": "TEST_Phone", "email": f"test_{uuid.uuid4().hex[:6]}@example.com", "phone": phone, "nok_phone": nok})

    def test_local_phone_rejected(self):
        r = self._post("021 555 1234")
        print(r.status_code, r.text[:300])
        assert r.status_code in (400, 422)
        if r.status_code == 400:
            assert "Start the phone number with + and the country code" in r.json()["detail"]

    def test_local_nok_rejected(self):
        r = self._post("+64 21 555 1234", "021 555 1234")
        print(r.status_code, r.text[:300])
        assert r.status_code in (400, 422)

    def test_intl_phone_accepted_then_deleted(self):
        r = self._post("+64 21 555 1234", "+44 20 7946 0958")
        assert r.status_code == 200, r.text
        eid = r.json()["entry_id"]
        assert r.json()["phone"] == "+64 21 555 1234"
        d = requests.delete(f"{BASE_URL}/api/crew-register/{eid}", headers=PRO, timeout=30)
        assert d.status_code in (200, 204)

    def test_update_local_phone_rejected(self):
        r = self._post("+64 21 555 1234")
        eid = r.json()["entry_id"]
        try:
            u = requests.put(f"{BASE_URL}/api/crew-register/{eid}", headers=PRO, timeout=30, json={"kind": "crew", "name": "TEST_Phone", "email": r.json()["email"], "phone": "0215551234"})
            assert u.status_code == 400, u.text
        finally:
            requests.delete(f"{BASE_URL}/api/crew-register/{eid}", headers=PRO, timeout=30)
