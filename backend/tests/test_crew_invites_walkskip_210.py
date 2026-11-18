# Iteration 210: crew invites projection (walk_skip, prep progress) on test-user-pro / model_vessel.
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
BOAT = "model_vessel"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    s.cookies.set("session_token", "test_session_pro_1")
    return s


@pytest.fixture
def created_invites(client):
    ids = []
    yield ids
    for i in ids:
        client.delete(f"{BASE_URL}/api/boats/{BOAT}/invites/{i}")


def _invites(client):
    r = client.get(f"{BASE_URL}/api/boats/{BOAT}/crew", timeout=30)
    assert r.status_code == 200
    return r.json()["invites"]


# Invite with walk_skip -> crew GET returns walk_skip on that invite
def test_invite_walk_skip_projected(client, created_invites):
    r = client.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "test_210_walk@example.com", "name": "TEST_210 Walk", "roles": ["Helmsman"], "walk_skip": ["TEST_stop_a"]}, timeout=30)
    assert r.status_code in (200, 201), r.text
    inv = next(i for i in _invites(client) if i["email"] == "test_210_walk@example.com")
    created_invites.append(inv["invite_id"])
    assert inv["walk_skip"] == ["TEST_stop_a"]
    assert inv["name"] == "TEST_210 Walk"
    assert inv["roles"] == ["Helmsman"]


# Invite without walk_skip -> key absent, no _id leak
def test_invite_without_walk_skip(client, created_invites):
    r = client.post(f"{BASE_URL}/api/boats/{BOAT}/invites", json={"email": "test_210_nowalk@example.com", "name": "TEST_210 NoWalk", "roles": []}, timeout=30)
    assert r.status_code in (200, 201), r.text
    inv = next(i for i in _invites(client) if i["email"] == "test_210_nowalk@example.com")
    created_invites.append(inv["invite_id"])
    assert "walk_skip" not in inv
    assert "_id" not in inv


# Prep progress attaches to an invite whose 'Crew Prep - <name>' list exists (made by the UI in this iteration)
def test_invite_prep_progress_for_clone(client):
    inv = next((i for i in _invites(client) if i["name"] == "TEST_210 Alpha"), None)
    if not inv:
        pytest.skip("TEST_210 Alpha invite not present")
    assert inv["prep"]["list_name"] == "Crew Prep - TEST_210 Alpha"
    assert inv["prep"]["total"] > 0
    assert isinstance(inv["prep"]["ticked"], int)
