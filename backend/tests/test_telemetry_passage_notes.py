# Iteration 74: What's New notes on master updates, vessel telemetry fields on BoatDetails, POST /api/ai/passage
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LIST = "head"  # system list; testing agent cleans db.list_templates / db.template_versions afterwards
BOAT_ID = "testtel74"


def s(token):
    x = requests.Session()
    x.cookies.set("session_token", token)
    return x


@pytest.fixture(scope="module")
def admin():
    return s("test_session_admin_1")


@pytest.fixture(scope="module")
def pro():
    return s("test_session_pro_1")


@pytest.fixture(scope="module")
def free():
    return s("test_session_free_1")


def items(labels, note=None):
    body = {"items": [{"id": i + 1, "label": l} for i, l in enumerate(labels)]}
    if note is not None:
        body["note"] = note
    return body


# What's New note on master publish + version notes
class TestNotes:
    def test_publish_with_notes_and_version_notes(self, admin, pro):
        r1 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_N1"], "TEST_note one"))
        assert r1.status_code == 200, r1.text
        assert r1.json()["note"] == "TEST_note one"
        a = r1.json()["updated_at"]
        time.sleep(0.05)
        r2 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_N1", "TEST_N2"], "  TEST_note two  "))
        assert r2.status_code == 200 and r2.json()["note"] == "TEST_note two"
        time.sleep(0.05)
        r3 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_N1", "TEST_N2", "TEST_N3"]))  # no note
        assert r3.status_code == 200
        time.sleep(0.05)
        r4 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_N1", "TEST_N3"], "TEST_note four"))
        assert r4.status_code == 200
        d = r4.json()["updated_at"]
        t = pro.get(f"{BASE_URL}/api/templates").json()["templates"][LIST]
        assert t["note"] == "TEST_note four"
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": a}).json()
        assert [i["label"] for i in v["items"]] == ["TEST_N1"]
        assert [n["note"] for n in v["notes"]] == ["TEST_note two", "TEST_note four"]
        assert all("at" in n for n in v["notes"])
        cur = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": d}).json()
        assert cur["notes"] == []

    def test_note_too_long(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_X"], "x" * 301))
        assert r.status_code == 422

    def test_non_admin_cannot_publish(self, pro):
        r = pro.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_X"], "n"))
        assert r.status_code in (401, 403)


# BoatDetails telemetry fields persistence
class TestTelemetry:
    def test_save_and_get(self, pro):
        boat = {"vessel": "TEST_Tel", "tank_units": "gal", "fuel_tank": "100", "fuel_jerry": "2", "fuel_jerry_size": "5",
                "water_tank": "80,5", "water_jerry": "1", "water_jerry_size": "5", "gas_bottles": "2", "gas_kg": "4.5", "gas_extra": "1",
                "cruise_kn": "7", "batteries": [{"id": "engine", "role": "engine", "make": "Varta", "volts": "12", "ah": "100", "chem": "agm", "notes": ""},
                                                 {"id": "house", "role": "house", "make": "", "volts": "24", "ah": "400", "chem": "lithium", "notes": "inverter"},
                                                 {"id": "p1", "role": "portable", "make": "Anker", "volts": "12", "ah": "50", "chem": "lithium", "notes": "USB-C"}],
                "depart": {"levels": {"fuel": "full"}, "ack": True}}
        body = {"boat": boat, "registry": [], "data": {}, "updated_at": "2026-01-10T00:00:00+00:00"}
        r = pro.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, json=body)
        assert r.status_code == 200, r.text
        g = pro.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}).json()["boat"]
        assert g["tank_units"] == "gal" and g["fuel_tank"] == "100" and g["water_tank"] == "80.5" and g["gas_kg"] == "4.5"
        assert g["cruise_kn"] == "7" and len(g["batteries"]) == 3 and g["batteries"][2]["make"] == "Anker"
        assert g["depart"]["levels"]["fuel"] == "full" and g["depart"]["ack"] is True

    def test_invalid_tank_value_cleared_and_default_cruise(self, pro):
        body = {"boat": {"vessel": "TEST_Tel", "fuel_tank": "abc"}, "registry": [], "data": {}, "updated_at": "2026-01-11T00:00:00+00:00"}
        r = pro.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, json=body)
        assert r.status_code == 200, r.text
        g = r.json()["boat"]
        assert g["fuel_tank"] == "" and g["cruise_kn"] == "6"

    def test_invalid_battery_volts_rejected(self, pro):
        body = {"boat": {"batteries": [{"id": "e", "role": "engine", "volts": "13"}]}, "registry": [], "data": {}, "updated_at": "2026-01-12T00:00:00+00:00"}
        r = pro.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, json=body)
        assert r.status_code == 422

    def test_cleanup(self, pro):
        r = pro.delete(f"{BASE_URL}/api/me/boats/{BOAT_ID}")
        assert r.status_code in (200, 204)


# Magic Mariner passage estimate
class TestPassage:
    def test_free_blocked(self, free):
        if free.get(f"{BASE_URL}/api/auth/me").json().get("launch_free"):
            pytest.skip("launch_free promo active: free users are premium")
        r = free.post(f"{BASE_URL}/api/ai/passage", json={"start": "Mana", "dest": "Picton"})
        assert r.status_code in (402, 403)

    def test_validation(self, pro):
        r = pro.post(f"{BASE_URL}/api/ai/passage", json={"start": "", "dest": "Picton"})
        assert r.status_code == 422
        r = pro.post(f"{BASE_URL}/api/ai/passage", json={"start": "Mana", "dest": "Picton", "cruise_kn": 0})
        assert r.status_code == 422

    def test_estimate(self, pro):
        r = pro.post(f"{BASE_URL}/api/ai/passage", json={"start": "Mana Marina, Wellington", "dest": "Picton", "engine_type": "Yanmar 3YM30 diesel",
                                                         "cruise_kn": 6, "tank_units": "L"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert 20 < d["distance_nm"] < 120 and 0 < d["fuel_rate"] < 30
        assert isinstance(d["notes"], str)
        print(d)
