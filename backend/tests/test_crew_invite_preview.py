# Crew invite preview endpoint + Model Vessel email block (iteration 187)
import os
import subprocess
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


@pytest.fixture
def pro():
    s = requests.Session()
    s.headers.update({"Authorization": "Bearer test_session_pro_1", "Content-Type": "application/json"})
    return s


@pytest.fixture
def free():
    s = requests.Session()
    s.headers.update({"Authorization": "Bearer test_session_free_1"})
    return s


# Preview endpoint
class TestCrewPreview:
    def test_preview_owner(self, pro):
        r = pro.get(f"{BASE_URL}/api/boats/main/crew-preview", params=[("roles", "Navigator"), ("roles", "Bosun")])
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["terms"], (str, list, dict)) and d["terms"]
        assert "boat_terms" in d
        assert [x["role"] for x in d["roles"]] == ["Navigator", "Bosun"]
        assert all(x["read_at"] is None for x in d["roles"])
        assert d["agreement"] is None and d["walkthrough"] is None
        assert "shore_brief" in d and d["joincrew_offer"] is False

    def test_preview_no_roles(self, pro):
        r = pro.get(f"{BASE_URL}/api/boats/main/crew-preview")
        assert r.status_code == 200 and r.json()["roles"] == []

    def test_preview_model_vessel(self, pro):
        r = pro.get(f"{BASE_URL}/api/boats/model_vessel/crew-preview", params={"roles": "Helm"})
        assert r.status_code == 200, r.text
        assert r.json()["roles"][0]["role"] == "Helm"

    def test_preview_not_owner_404(self, free):
        # free user is crew on pro's main but owns no boat with id "nonexistent"
        r = free.get(f"{BASE_URL}/api/boats/nonexistent_boat_xyz/crew-preview")
        assert r.status_code in (404, 422)

    def test_preview_unauth(self):
        r = requests.get(f"{BASE_URL}/api/boats/main/crew-preview")
        assert r.status_code == 401


def _invite(pro, boat, send_email=True):
    email = f"test_preview_{uuid.uuid4().hex[:8]}@example.com"
    r = pro.post(f"{BASE_URL}/api/boats/{boat}/invites",
                 json={"name": "TEST_Tom", "email": email, "roles": ["Navigator"], "send_email": send_email})
    return r, email


# Model Vessel email block
class TestModelVesselEmail:
    def test_model_vessel_email_blocked(self, pro):
        r, email = _invite(pro, "model_vessel")
        assert r.status_code == 200, r.text
        d = r.json()
        try:
            assert d["email_blocked"] is True
            assert d["email"] == email
            time.sleep(1)
            log = subprocess.run("tail -n 400 /var/log/supervisor/backend.err.log /var/log/supervisor/backend.out.log 2>/dev/null",
                                 shell=True, capture_output=True, text=True).stdout
            assert "Email not sent (Model Vessel training)" in log
        finally:
            dr = pro.delete(f"{BASE_URL}/api/boats/model_vessel/invites/{d['invite_id']}")
            assert dr.status_code in (200, 204), dr.text

    def test_model_vessel_no_send_not_blocked(self, pro):
        r, _ = _invite(pro, "model_vessel", send_email=False)
        assert r.status_code == 200, r.text
        d = r.json()
        try:
            assert d["email_blocked"] is False
        finally:
            pro.delete(f"{BASE_URL}/api/boats/model_vessel/invites/{d['invite_id']}")

    def test_main_email_not_blocked(self, pro):
        r, _ = _invite(pro, "main")
        assert r.status_code == 200, r.text
        d = r.json()
        try:
            assert d["email_blocked"] is False
        finally:
            dr = pro.delete(f"{BASE_URL}/api/boats/main/invites/{d['invite_id']}")
            assert dr.status_code in (200, 204), dr.text
