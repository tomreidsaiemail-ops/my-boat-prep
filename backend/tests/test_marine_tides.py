# Live tides (WorldTides) + MET Norway weather: /api/marine/tides, navigator-ask live data, admin api_calls analytics
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
# NZ local day 2026-11-20 (inside the cached 8-day Mana window, so no new WorldTides credits)
DAY = {"start": "2026-11-19T11:00:00.000Z", "end": "2026-11-20T11:00:00.000Z"}


def _stats():
    r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=ADMIN, params={"since": "2026-11-19T11:00:00.000Z", "yesterday": "2026-11-18T11:00:00.000Z"}, timeout=60)
    assert r.status_code == 200
    return {x["code"]: x for x in r.json()["api_calls"]}


class TestMarineTides:
    def test_mana_marina_tides(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", **DAY}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["station"]["name"]
        assert 2 <= len(d["extremes"]) <= 6
        for x in d["extremes"]:
            assert x["type"] in ("high", "low")
            assert isinstance(x["height"], (int, float))
            assert DAY["start"][:10] <= x["time"][:10] <= DAY["end"][:10]
        types = [x["type"] for x in d["extremes"]]
        assert all(a != b for a, b in zip(types, types[1:])), "high/low should alternate"

    def test_lat_lon_direct(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"lat": -41.1, "lon": 174.87, **DAY}, timeout=60)
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_unknown_place(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Qwxyz Nowhere Land", **DAY}, timeout=60)
        assert r.status_code == 200
        assert r.json() == {"ok": False, "reason": "place"}

    def test_range_too_long(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", "start": DAY["start"], "end": "2026-11-23T11:00:00.000Z"}, timeout=30)
        assert r.status_code == 422

    def test_end_before_start(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", "start": DAY["end"], "end": DAY["start"]}, timeout=30)
        assert r.status_code == 422

    def test_bad_date(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", "start": "notadate", "end": DAY["end"]}, timeout=30)
        assert r.status_code == 422

    def test_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", params={"place": "Mana Marina", **DAY}, timeout=30)
        assert r.status_code == 401

    def test_free_user_allowed(self):
        r = requests.get(f"{BASE_URL}/api/marine/tides", headers=FREE, params={"place": "Mana Marina", **DAY}, timeout=60)
        assert r.status_code == 200


class TestApiCallAnalytics:
    def test_api_calls_shape(self):
        s = _stats()
        assert set(s) == {"worldtides", "met-norway"}
        for row in s.values():
            for k in ("total", "yesterday", "today", "fails_total", "fails_yesterday", "fails_today"):
                assert isinstance(row[k], int)
            assert row["today"] <= row["total"] and row["fails_total"] <= row["total"]
        assert "credits_today" in s["worldtides"]

    def test_non_admin_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=PRO, timeout=30)
        assert r.status_code in (401, 403)

    def test_cached_lookup_does_not_count(self):
        before = _stats()["worldtides"]["total"]
        requests.get(f"{BASE_URL}/api/marine/tides", headers=PRO, params={"place": "Mana Marina", **DAY}, timeout=60)
        assert _stats()["worldtides"]["total"] == before


@pytest.mark.skipif(os.environ.get("RUN_NAV_ASK") != "1", reason="uses AI credits; set RUN_NAV_ASK=1")
class TestNavigatorLive:
    def test_navigator_live_tides(self):
        before = _stats()
        body = {"question": "What are the high and low tide times at Mana Marina on the departure day?",
                "start": "Mana Marina", "destination": "Ship Cove", "depart_at": "2026-11-20T09:00", "tz": "Pacific/Auckland",
                "boat": {"boat_type": "Yacht - Sloop", "pob": 2}}
        r = requests.post(f"{BASE_URL}/api/ai/navigator-ask", headers=PRO, json=body, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        print(d["answer"])
        assert d["tides_missing"] == []
        assert "Live tides at Mana Marina (WorldTides" in d["answer"]
        assert "Live tides at Ship Cove (WorldTides" in d["answer"]
        assert "Live wind forecast" in d["answer"] and "MET Norway" in d["answer"]
        live_start = d["answer"].index("Live tides at Mana Marina")
        live_times = set(re.findall(r"\b\d{2}:\d{2}\b", d["answer"][live_start:]))
        ai_times = set(re.findall(r"\b\d{1,2}:\d{2}\b", d["answer"][:live_start]))
        print("AI times:", ai_times, "live:", live_times)
        assert ai_times <= live_times or not ai_times, f"AI invented times {ai_times - live_times}"
        after = _stats()
        print("before", before, "after", after)
