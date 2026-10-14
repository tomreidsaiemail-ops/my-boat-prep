"""Backend tests for My Boat Prep API."""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gemini-prototype.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def device_id():
    return f"test-{uuid.uuid4().hex[:16]}"


@pytest.fixture
def sample_payload():
    return {
        "boat": {"vessel": "TEST_Vessel", "skipper": "TEST_Skipper", "callsign": "ZMX123"},
        "registry": [{"id": "leavingDock", "name": "Leaving Dock", "isSystem": True}],
        "data": {"leavingDock": [{"id": 1, "label": "Tidy lines", "checked": True}]},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# --- Root endpoint ---
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert "My Boat Prep" in r.json().get("message", "")


# --- GET on unknown device returns 404 ---
def test_get_unknown_404():
    r = requests.get(f"{API}/boats/nonexistent-{uuid.uuid4().hex[:12]}")
    assert r.status_code == 404


# --- PUT upserts and GET returns it ---
def test_put_then_get(device_id, sample_payload):
    put = requests.put(f"{API}/boats/{device_id}", json=sample_payload)
    assert put.status_code == 200, put.text
    data = put.json()
    assert data["device_id"] == device_id
    assert data["boat"]["vessel"] == "TEST_Vessel"
    assert "synced_at" in data
    assert "_id" not in data

    get = requests.get(f"{API}/boats/{device_id}")
    assert get.status_code == 200
    g = get.json()
    assert g["boat"]["skipper"] == "TEST_Skipper"
    assert g["data"]["leavingDock"][0]["checked"] is True
    assert "_id" not in g


# --- PUT upsert (second call updates) ---
def test_put_upsert(device_id, sample_payload):
    requests.put(f"{API}/boats/{device_id}", json=sample_payload)
    sample_payload["boat"]["vessel"] = "TEST_Updated"
    sample_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = requests.put(f"{API}/boats/{device_id}", json=sample_payload)
    assert r.status_code == 200
    assert r.json()["boat"]["vessel"] == "TEST_Updated"
    g = requests.get(f"{API}/boats/{device_id}").json()
    assert g["boat"]["vessel"] == "TEST_Updated"


# --- device_id validation ---
@pytest.mark.parametrize("bad_id", ["short", "has space1", "has$special!", "a" * 65, "dropit; drop"])
def test_invalid_device_id_rejected(bad_id, sample_payload):
    # GET
    r = requests.get(f"{API}/boats/{bad_id}")
    assert r.status_code == 422, f"GET bad id {bad_id} got {r.status_code}"
    # PUT
    r2 = requests.put(f"{API}/boats/{bad_id}", json=sample_payload)
    assert r2.status_code == 422, f"PUT bad id {bad_id} got {r2.status_code}"


def test_put_invalid_body(device_id):
    r = requests.put(f"{API}/boats/{device_id}", json={"foo": "bar"})
    assert r.status_code == 422
