# Cupboard (area) photos: upload by owner, read by owner/crew, access control
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_beta_1"}
CREW = {"Authorization": "Bearer test_session_free_1"}


def _jpeg():
    b = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 80, 20)).save(b, "JPEG")
    return b.getvalue()


@pytest.fixture(scope="module")
def photo_id():
    r = requests.post(f"{BASE_URL}/api/boats/main/area-photos", headers=PRO, files={"file": ("c.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 200, r.text
    p = r.json()["photo"]
    assert isinstance(p["id"], str) and len(p["id"]) == 36 and p["v"]
    return p["id"]


def test_owner_get(photo_id):
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/{photo_id}", headers=PRO)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/jpeg")
    assert r.content[:2] == b"\xff\xd8"


def test_crew_get_with_owner(photo_id):
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/{photo_id}", params={"owner": "test-user-pro"}, headers=CREW)
    assert r.status_code == 200
    assert r.content[:2] == b"\xff\xd8"


def test_non_crew_forbidden(photo_id):
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/{photo_id}", params={"owner": "test-user-pro"}, headers=FREE)
    assert r.status_code == 404


def test_crew_without_owner_404(photo_id):
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/{photo_id}", headers=CREW)
    assert r.status_code == 404


def test_unauth(photo_id):
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/{photo_id}")
    assert r.status_code == 401


def test_bad_type():
    r = requests.post(f"{BASE_URL}/api/boats/main/area-photos", headers=PRO, files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_too_big():
    r = requests.post(f"{BASE_URL}/api/boats/main/area-photos", headers=PRO, files={"file": ("a.jpg", b"\xff\xd8" + b"0" * (3 * 1024 * 1024 + 10), "image/jpeg")})
    assert r.status_code == 400


def test_unknown_boat():
    r = requests.post(f"{BASE_URL}/api/boats/nosuchboat_x/area-photos", headers=PRO, files={"file": ("c.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 404


def test_crew_cannot_upload_to_owner_boat():
    # crew has no own boat 'main'? upload goes to the crew's own boat key only
    r = requests.post(f"{BASE_URL}/api/boats/c_test-user-pro_main/area-photos", headers=CREW, files={"file": ("c.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 404


def test_bad_photo_id():
    r = requests.get(f"{BASE_URL}/api/boats/main/area-photos/notauuid", headers=PRO)
    assert r.status_code == 422
