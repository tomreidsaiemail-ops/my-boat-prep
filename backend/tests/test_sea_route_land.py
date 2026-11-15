# Sea route: pins on land snapped to water, land flags per part; /sea-check land detection (iteration 184)
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
PAREMATA_LAND = {"lat": -41.1060, "lon": 174.8790}
MANA = {"lat": -41.0897, "lon": 174.8686}
PICTON = {"lat": -41.2906, "lon": 174.0057}
_cache = {}


def _route(a, b):
    key = (a["lat"], a["lon"], b["lat"], b["lon"])
    if key not in _cache:
        t = time.time()
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": a, "b": b}, headers=PRO, timeout=120)
        print(f"sea-route {key} took {time.time() - t:.1f}s status {r.status_code}")
        assert r.status_code == 200, r.text
        _cache[key] = r.json()
    return _cache[key]


def _check(line):
    r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": line}, headers=PRO, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


# Sea route with a pin on land
class TestSeaRouteLand:
    def test_paremata_land_to_picton(self):
        d = _route(PAREMATA_LAND, PICTON)
        print({k: d[k] for k in ("a_water", "b_water", "a_moved", "b_moved", "land")}, len(d["points"]))
        assert d["ok"] is True
        assert d["a_moved"] is True
        assert isinstance(d["a_water"], list) and len(d["a_water"]) == 2
        assert d["a_water"] != [PAREMATA_LAND["lat"], PAREMATA_LAND["lon"]]
        assert len(d["land"]) == len(d["points"]) + 1
        assert not any(d["land"]), f"land parts: {d['land']}"

    def test_a_water_is_on_water(self):
        d = _route(PAREMATA_LAND, PICTON)
        # Re-route from the snapped point: it must not move again
        a = {"lat": d["a_water"][0], "lon": d["a_water"][1]}
        d2 = _route(a, PICTON)
        assert d2["ok"] is True and d2["a_moved"] is False

    def test_mana_to_picton_no_land(self):
        d = _route(MANA, PICTON)
        print(d["land"], d["a_moved"], d["b_moved"])
        assert d["ok"] is True
        assert not any(d["land"]), f"land parts: {d['land']}"

    def test_sea_check_water_line_all_false(self):
        d = _route(MANA, PICTON)
        line = [d["a_water"], *d["points"], d["b_water"]]
        c = _check(line[:80])
        assert len(c["land"]) == min(len(line), 80) - 1
        assert not any(c["land"]), c["land"]


# Sea check endpoint
class TestSeaCheck:
    def test_line_across_land(self):
        c = _check([[-41.0897, 174.8686], [-41.12, 174.95]])
        assert c["land"] == [True]

    def test_mixed_line(self):
        d = _route(MANA, PICTON)
        line = [d["a_water"], *d["points"], d["b_water"]]
        line = [[-41.12, 174.95], *line[:20]]
        c = _check(line)
        assert c["land"][0] is True

    def test_too_short(self):
        r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": [[-41.1, 174.8]]}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_unauth_check(self):
        r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": [[-41.0897, 174.8686], [-41.12, 174.95]]}, timeout=30)
        assert r.status_code == 401

    def test_unauth_route(self):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": MANA, "b": PICTON}, timeout=30)
        assert r.status_code == 401
