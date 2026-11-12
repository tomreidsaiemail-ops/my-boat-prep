# Iter158: shore tracking needs a contact (400), contacts locked while tracking on (409), chooser data (/me/boats, /shore/boats)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def s(tok):
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def pro():
    return s("test_session_pro_1")


@pytest.fixture(scope="module")
def free():
    return s("test_session_free_1")


# Free user's own boat main: no contacts -> tracking on rejected
def test_free_no_contacts_tracking_400(free):
    info = free.get(f"{BASE_URL}/api/boats/main/shore")
    if info.status_code == 404:
        pytest.skip("free has no own boat main")
    assert info.status_code == 200
    if info.json()["contacts"]:
        pytest.skip("free boat has contacts now")
    r = free.put(f"{BASE_URL}/api/boats/main/shore/tracking", json={"on": True})
    assert r.status_code == 400
    assert "Invite a shore contact" in r.json()["detail"]
    # still off
    assert not free.get(f"{BASE_URL}/api/boats/main/shore").json()["tracking"].get("on")


# Turning off with no contacts is always allowed
def test_free_tracking_off_ok(free):
    r = free.put(f"{BASE_URL}/api/boats/main/shore/tracking", json={"on": False})
    assert r.status_code in (200, 404)


# Pro boat main: tracking on, 2 joined contacts, deletion locked
def test_pro_remove_locked_409(pro):
    info = pro.get(f"{BASE_URL}/api/boats/main/shore").json()
    assert info["tracking"].get("on") is True
    keys = {c["key"] for c in info["contacts"]}
    assert {"test-user-beta", "test-shore-only"} <= keys
    r = pro.delete(f"{BASE_URL}/api/boats/main/shore/contacts/test-user-beta")
    assert r.status_code == 409
    assert "Untick" in r.json()["detail"]
    after = {c["key"] for c in pro.get(f"{BASE_URL}/api/boats/main/shore").json()["contacts"]}
    assert keys == after


# Invite-only counts as contact: invite then tracking on allowed; while on, invite removal 409; off -> removal ok
def test_invite_counts_and_lock(free):
    info = free.get(f"{BASE_URL}/api/boats/main/shore")
    if info.status_code != 200 or info.json()["contacts"]:
        pytest.skip("free boat not in clean state")
    inv = free.post(f"{BASE_URL}/api/boats/main/shore/invites", json={"name": "TEST_Inv", "email": "test_inv_iter158@example.com", "send_email": False})
    assert inv.status_code == 200
    try:
        c = [x for x in free.get(f"{BASE_URL}/api/boats/main/shore").json()["contacts"] if x["email"] == "test_inv_iter158@example.com"]
        assert c and c[0]["status"] == "invited"
        key = c[0]["key"]
        on = free.put(f"{BASE_URL}/api/boats/main/shore/tracking", json={"on": True})
        assert on.status_code == 200 and on.json()["on"] is True
        d = free.delete(f"{BASE_URL}/api/boats/main/shore/contacts/{key}")
        assert d.status_code == 409
        assert free.put(f"{BASE_URL}/api/boats/main/shore/tracking", json={"on": False}).status_code == 200
        d = free.delete(f"{BASE_URL}/api/boats/main/shore/contacts/{key}")
        assert d.status_code == 200
        assert not free.get(f"{BASE_URL}/api/boats/main/shore").json()["contacts"]
    finally:
        free.put(f"{BASE_URL}/api/boats/main/shore/tracking", json={"on": False})
        for x in free.get(f"{BASE_URL}/api/boats/main/shore").json()["contacts"]:
            if x["email"] == "test_inv_iter158@example.com":
                free.delete(f"{BASE_URL}/api/boats/main/shore/contacts/{x['key']}")


# Chooser data for beta: own boat, crew boat, shore boat
def test_beta_chooser_data():
    b = s("test_session_beta_1")
    assert b.put(f"{BASE_URL}/api/shore/home", json={"home": "shore"}).json()["home"] == "shore"
    boats = b.get(f"{BASE_URL}/api/me/boats").json()["boats"]
    assert any(x.get("crew") and x["owner_id"] == "test-user-pro" and x["boat_id"] == "main" for x in boats)
    sb = b.get(f"{BASE_URL}/api/shore/boats").json()["boats"]
    assert any(x["owner_id"] == "test-user-pro" and x["boat_id"] == "main" and not x.get("mine") for x in sb)
