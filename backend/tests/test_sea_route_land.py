# Sea check: per-straight-part land flags from OSM water colour; /api/sea-route removed (iteration 184)
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
MANA = [-41.0897, 174.8686]
PICTON = [-41.2906, 174.0057]


def _check(line):
    r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": line}, headers=PRO, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


# Sea check endpoint
class TestSeaCheck:
    def test_mana_picton_straight_crosses_land(self):
        assert _check([MANA, PICTON])["land"] == [True]

    def test_open_cook_strait_water(self):
        assert _check([[-41.18, 174.45], [-41.18, 174.62]])["land"] == [False]

    def test_open_water_shallow_boundary_crossing(self):
        # Known bug (iter 184): the dashed Marlborough/Wellington region boundary drawn over water at z13 is ~4 px wide,
        # a line running nearly parallel to it reads it as land
        assert _check([[-41.15, 174.6], [-41.2, 174.5]])["land"] == [False]

    def test_line_across_land(self):
        assert _check([MANA, [-41.12, 174.95]])["land"] == [True]

    def test_multi_part_flags_per_part(self):
        c = _check([[-41.18, 174.45], [-41.18, 174.62], [MANA[0], MANA[1]]])
        assert isinstance(c["land"], list) and len(c["land"]) == 2
        assert c["land"][0] is False

    def test_too_short(self):
        r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": [[-41.1, 174.8]]}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_too_long(self):
        line = [[-41.15 - i * 0.001, 174.6] for i in range(81)]
        r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": line}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_unauth_check(self):
        r = requests.post(f"{BASE_URL}/api/sea-check", json={"line": [MANA, PICTON]}, timeout=30)
        assert r.status_code == 401

    def test_sea_route_removed(self):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": {"lat": MANA[0], "lon": MANA[1]}, "b": {"lat": PICTON[0], "lon": PICTON[1]}}, headers=PRO, timeout=30)
        assert r.status_code in (404, 405), r.status_code
