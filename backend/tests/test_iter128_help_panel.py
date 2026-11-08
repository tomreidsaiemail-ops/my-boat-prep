# Iteration 128: 'How to take your boat inventory' help panel seeded in admin template lists
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
NAME = "Admin - Help Panel - How to take your boat inventory"


@pytest.fixture
def lists():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel -"}, cookies=PRO, timeout=20)
    assert r.status_code == 200
    return r.json()["lists"]


# Help panel list exists and is unique
def test_inventory_help_present_once(lists):
    hits = [l for l in lists if l["name"] == NAME]
    assert len(hits) == 1


# New wording: 4 paragraphs starting with 'Make sure and get the zone schematic for yacht'
def test_inventory_help_wording(lists):
    items = next(l for l in lists if l["name"] == NAME)["items"]
    assert len(items) == 4
    assert items[0]["label"].startswith("Make sure and get the zone schematic for yacht")
    assert "ZONE MAP OVERVIEWS" in items[1]["label"]
    assert "Magically Create Colours" in items[2]["label"]
    assert "Batch Magic Scan" in items[3]["label"]
    assert not any(i.get("indent") for i in items)


# Prefix validation and auth
def test_unknown_prefix_400():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel - How"}, cookies=PRO, timeout=20)
    assert r.status_code == 400


def test_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Help Panel -"}, timeout=20)
    assert r.status_code == 401
