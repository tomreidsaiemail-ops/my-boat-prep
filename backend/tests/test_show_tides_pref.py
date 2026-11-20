# User Preference "Show high and low tides": /auth/me fields, PUT /me/preferences, /marine/tides off gate, Navigator with/without tides
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
DAY = {"start": "2026-11-19T11:00:00.000Z", "end": "2026-11-20T11:00:00.000Z"}
NAV = {"start": "Mana Marina", "destination": "Porirua Harbour", "depart_at": "2026-11-21T09:00", "tz": "Pacific/Auckland",
       "boat": {"boat_type": "Yacht", "loa": "10", "pob": 2}, "items": ["Tide times check"], "question": "Keep it short."}


def put(body):
    return requests.put(f"{BASE_URL}/api/me/preferences", headers=PRO, json=body, timeout=30)


@pytest.fixture(scope="module", autouse=True)
def reset_prefs():
    put({"show_tides": False, "tide_datum": "CD"})
    yield
    put({"show_tides": False, "tide_datum": "CD", "tide_ack_date": "2000-01-01"})
    # tide_ack_date back to '' (API only accepts dates)
    os.system("""mongosh test_database --quiet --eval 'db.users.updateOne({user_id:"test-user-pro"},{$set:{"prefs.tide_ack_date":""}})' >/dev/null""")


class TestPrefs:
    def test_me_defaults(self):
        d = requests.get(f"{BASE_URL}/api/auth/me", headers=PRO, timeout=30).json()
        assert d["show_tides"] is False
        assert isinstance(d["tide_ack_date"], str)
        assert d["tide_datum"] == "CD"

    def test_partial_update(self):
        d = put({"tide_ack_date": "2026-11-19"}).json()
        assert d["tide_ack_date"] == "2026-11-19" and d["show_tides"] is False and d["tide_datum"] == "CD"
        d = put({"tide_datum": "MSL"}).json()
        assert d["tide_datum"] == "MSL" and d["tide_ack_date"] == "2026-11-19"
        d = put({"show_tides": True}).json()
        assert d["show_tides"] is True and d["tide_datum"] == "MSL"
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=PRO, timeout=30).json()
        assert me["show_tides"] is True and me["tide_datum"] == "MSL" and me["tide_ack_date"] == "2026-11-19"
        put({"show_tides": False, "tide_datum": "CD"})

    @pytest.mark.parametrize("bad", ["2026/11/19", "yesterday", "26-11-19", ""])
    def test_bad_date(self, bad):
        assert put({"tide_ack_date": bad}).status_code == 422

    def test_bad_datum(self):
        assert put({"tide_datum": "LAT"}).status_code == 422

    def test_empty_body_noop(self):
        r = put({})
        assert r.status_code == 200 and r.json()["show_tides"] is False


class TestTidesGate:
    def test_off(self):
        put({"show_tides": False})
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", **DAY}, timeout=60)
        assert r.status_code == 200 and r.json() == {"ok": False, "reason": "off"}

    def test_on(self):
        put({"show_tides": True, "tide_datum": "CD"})
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", **DAY}, timeout=60)
        d = r.json()
        assert d["ok"] is True and len(d["extremes"]) >= 2
        put({"show_tides": False})

    def test_off_still_validates_dates(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", "start": "x", "end": DAY["end"]}, timeout=30)
        assert r.status_code == 422


class TestNavigator:
    def test_off_no_tides(self):
        put({"show_tides": False})
        r = requests.post(f"{BASE_URL}/api/ai/navigator-ask", headers=PRO, json=NAV, timeout=180)
        if r.status_code == 429:
            pytest.skip("quota")
        assert r.status_code == 200, r.text
        d = r.json()
        print("OFF ANSWER:\n", d["answer"][-1500:])
        assert d["tides_missing"] == []
        assert "Live tides" not in d["answer"]
        assert "above CD" not in d["answer"]

    def test_on_has_tides(self):
        put({"show_tides": True, "tide_datum": "CD"})
        r = requests.post(f"{BASE_URL}/api/ai/navigator-ask", headers=PRO, json=NAV, timeout=180)
        put({"show_tides": False})
        if r.status_code == 429:
            pytest.skip("quota")
        assert r.status_code == 200, r.text
        d = r.json()
        print("ON ANSWER:\n", d["answer"][-1500:])
        assert "Live tides at" in d["answer"]
        assert "m above CD" in d["answer"] or "m below CD" in d["answer"]
