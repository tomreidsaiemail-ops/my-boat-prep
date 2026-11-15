# Sea route (A* over OSM water) + shore planned route map sharing (iteration 183)
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
SHORE = {"Authorization": "Bearer test_session_shore_1"}
MANA = {"lat": -41.0897, "lon": 174.8686}
PICTON = {"lat": -41.2906, "lon": 174.0057}
ROUTE = {
    "stops": [{"name": "TEST_Mana", "lat": -41.0897, "lon": 174.8686, "type": ""},
              {"name": "TEST_Picton", "lat": -41.2906, "lon": 174.0057, "type": "anchor"},
              {"name": "TEST_Ship Cove", "lat": -41.0955, "lon": 174.238, "type": "dock"}],
    "lines": [[[-41.0897, 174.8686], [-41.08608, 174.35783], [-41.2906, 174.0057]],
              [[-41.2906, 174.0057], [-41.0955, 174.238]]],
}


# Sea route endpoint
class TestSeaRoute:
    def test_mana_to_picton(self):
        t = time.time()
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": MANA, "b": PICTON}, headers=PRO, timeout=60)
        took = time.time() - t
        print(f"sea-route took {took:.2f}s")
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert isinstance(d["points"], list) and len(d["points"]) >= 2
        for p in d["points"]:
            assert len(p) == 2 and -42 < p[0] < -40 and 173 < p[1] < 176

    def test_picton_to_ship_cove(self):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": PICTON, "b": {"lat": -41.0955, "lon": 174.238}}, headers=PRO, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and len(d["points"]) >= 1

    def test_invalid_lat(self):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": {"lat": 95, "lon": 174}, "b": PICTON}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_unauth(self):
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": MANA, "b": PICTON}, timeout=30)
        assert r.status_code == 401

    def test_inland_both_land(self):
        # Middle of North Island land (Taupo-ish land area away from lake) -> ok false or graceful 200
        r = requests.post(f"{BASE_URL}/api/sea-route", json={"a": {"lat": -39.3, "lon": 175.6}, "b": {"lat": -39.5, "lon": 176.2}}, headers=PRO, timeout=60)
        assert r.status_code == 200
        assert "ok" in r.json()


# Shore route share + watched track
class TestShoreRoute:
    def test_put_route_and_shore_sees_it(self):
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=ROUTE, headers=PRO, timeout=30)
        assert r.status_code == 200 and r.json()["ok"] is True
        g = requests.get(f"{BASE_URL}/api/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}, headers=SHORE, timeout=30)
        assert g.status_code == 200
        plan = g.json()["plan"]
        assert plan and plan["route"]["stops"][1]["type"] == "anchor"
        assert plan["route"]["stops"][2]["name"] == "TEST_Ship Cove"
        assert len(plan["route"]["lines"]) == 2

    def test_null_entries_allowed(self):
        body = {"stops": [ROUTE["stops"][0], None, ROUTE["stops"][2]], "lines": [None, None]}
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=body, headers=PRO, timeout=30)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}, headers=SHORE, timeout=30)
        assert g.json()["plan"]["route"]["stops"][1] is None

    def test_share_plan_keeps_route(self):
        requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=ROUTE, headers=PRO, timeout=30)
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/plan", json={"text": "TEST_plan text"}, headers=PRO, timeout=30)
        print(r.status_code, r.text[:200])
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}, headers=SHORE, timeout=30)
        plan = g.json()["plan"]
        assert plan["text"] == "TEST_plan text"
        assert plan["route"]["stops"][2]["name"] == "TEST_Ship Cove"

    def test_route_unauth(self):
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=ROUTE, timeout=30)
        assert r.status_code == 401

    def test_route_bad_lat(self):
        body = {"stops": [{"name": "x", "lat": 200, "lon": 0, "type": ""}], "lines": []}
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=body, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_route_unknown_boat(self):
        r = requests.put(f"{BASE_URL}/api/boats/nosuchboat/shore/route", json=ROUTE, headers=PRO, timeout=30)
        assert r.status_code in (404, 422)

    def test_shore_contact_cannot_put_on_pro(self):
        # shore user PUTs to their own (nonexistent) main -> 404, never touches pro boat
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/route", json=ROUTE, headers=SHORE, timeout=30)
        assert r.status_code in (403, 404)
