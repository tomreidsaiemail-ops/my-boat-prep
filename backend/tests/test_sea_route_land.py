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



class TestWaterRoute:
    """Routes drawn over OpenStreetMap water, checked against the same outlines: no inner part may cross land."""

    def _route(self, a, b):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"line": [a, b]}, headers=PRO, timeout=120)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        assert path, "a route round the land was expected"
        full = [a, *path, b]
        land = requests.post(f"{BASE_URL}/api/sea-check", json={"line": full}, headers=PRO, timeout=120).json()["land"]
        return path, land

    def test_mana_to_picton_stays_on_water(self):
        _, land = self._route(MANA, PICTON)
        assert not any(land[1:-1])

    def test_kenepuru_to_ship_cove_out_of_the_sounds(self):
        _, land = self._route([-41.18, 174.08], [-41.10, 174.24])
        assert not any(land)

    def test_cook_strait_into_wellington_harbour(self):
        _, land = self._route([-41.30, 174.60], [-41.25, 174.86])
        assert not any(land)

    def test_tawa_bay_into_mana_marina_basin(self):
        _, land = self._route([-41.1262, 174.1898], [-41.1014, 174.8673])
        assert not any(land)

    def test_tawa_bay_into_havelock_marina(self):
        _, land = self._route([-41.1262, 174.1898], [-41.2777, 173.7691])
        assert not any(land)

    def test_tawa_bay_into_portage_marina(self):
        _, land = self._route([-41.1262, 174.1898], [-41.2069, 174.1155])
        assert not any(land)
