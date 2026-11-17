# Quick Trip Plan Draft backend: POST /api/sea-route auto-routing round land, GET /api/place-name
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
H = {"Authorization": "Bearer test_session_admin_1"}


# sea-route: Picton -> Ship Cove crosses land, so waypoints are returned
def test_sea_route_around_land():
    r = requests.post(f"{BASE_URL}/api/sea-route", json={"line": [[-41.29, 174.005], [-41.0985, 174.2386]]}, headers=H, timeout=120)
    assert r.status_code == 200, r.text
    path = r.json()["path"]
    assert isinstance(path, list) and len(path) >= 2, path
    for p in path:
        assert len(p) == 2 and -42 < p[0] < -40.5 and 173.5 < p[1] < 174.8
    # each sub-segment of the routed line should be on water
    full = [[-41.29, 174.005]] + path + [[-41.0985, 174.2386]]
    c = requests.post(f"{BASE_URL}/api/sea-check", json={"line": full}, headers=H, timeout=120)
    assert c.status_code == 200
    print("land flags on routed line:", c.json()["land"])


# sea-route: clear water line needs no waypoints
def test_sea_route_clear_water():
    r = requests.post(f"{BASE_URL}/api/sea-route", json={"line": [[-41.25, 174.6], [-41.3, 174.55]]}, headers=H, timeout=120)
    assert r.status_code == 200, r.text
    assert r.json()["path"] == []


# sea-route requires auth
def test_sea_route_requires_auth():
    r = requests.post(f"{BASE_URL}/api/sea-route", json={"line": [[-41.25, 174.6], [-41.3, 174.55]]}, timeout=30)
    assert r.status_code == 401


# sea-route validation
@pytest.mark.parametrize("body", [{"line": [[-41.25, 174.6]]}, {}, {"line": "x"}])
def test_sea_route_validation(body):
    r = requests.post(f"{BASE_URL}/api/sea-route", json=body, headers=H, timeout=30)
    assert r.status_code == 422


# place-name returns a name for a coastal point
def test_place_name():
    r = requests.get(f"{BASE_URL}/api/place-name", params={"lat": -41.0937, "lon": 174.8686}, headers=H, timeout=30)
    assert r.status_code == 200, r.text
    name = r.json()["name"]
    assert isinstance(name, str) and name.strip(), r.json()
    print("place name:", name)


def test_place_name_requires_auth():
    r = requests.get(f"{BASE_URL}/api/place-name", params={"lat": -41.0937, "lon": 174.8686}, timeout=30)
    assert r.status_code == 401


def test_place_name_bad_params():
    r = requests.get(f"{BASE_URL}/api/place-name", params={"lat": "abc", "lon": 174.8}, headers=H, timeout=30)
    assert r.status_code == 422
