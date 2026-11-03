# Item photos (Rigging / Electrical / Engine checklist items): POST/GET/DELETE /api/boats/{boat}/item-photo
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER, CREW, OTHER = "test_session_pro_1", "test_session_beta_1", "test_session_free_1"
JPG = open("/tmp/hand.jpg", "rb").read()


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


def mongo(js):
    subprocess.run(["mongosh", "test_database", "--quiet", "--eval", js], check=True, capture_output=True)


@pytest.fixture(scope="module")
def crew_setup():
    mongo('db.user_boats.updateOne({owner_id:"test-user-pro",boat_id:"main"},{$addToSet:{crew:"test-user-beta"}})')
    yield
    mongo('db.user_boats.updateOne({owner_id:"test-user-pro",boat_id:"main"},{$pull:{crew:"test-user-beta"}})')


def upload(sess, list_id="riggingChecks", data=JPG, ctype="image/jpeg"):
    return sess.post(f"{BASE_URL}/api/boats/main/item-photo", params={"list_id": list_id}, files={"file": ("p.jpg", data, ctype)}, timeout=90)


class TestItemPhotos:
    def test_full_cycle_and_access(self, crew_setup):
        o = s(OWNER)
        r = upload(o)
        assert r.status_code == 200, r.text
        pid = r.json()["photo_id"]
        assert isinstance(pid, str) and len(pid) == 32
        g = o.get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=60)
        assert g.status_code == 200 and g.content == JPG
        assert g.headers["content-type"].startswith("image/jpeg")
        # crew via owner param
        c = s(CREW).get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", params={"owner": "test-user-pro"}, timeout=60)
        assert c.status_code == 200 and c.content == JPG
        # crew without owner param -> 404 (looks in their own boat)
        assert s(CREW).get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=60).status_code == 404
        # unrelated user
        assert s(OTHER).get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", params={"owner": "test-user-pro"}, timeout=60).status_code == 404
        # crew cannot delete owner's photo
        s(CREW).delete(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=30)
        assert o.get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=60).status_code == 200
        # crew cannot upload to owner's boat (their own boat 'main' exists, so it would land on crew's own boat)
        d = o.delete(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=30)
        assert d.status_code == 200 and d.json() == {"ok": True}
        assert o.get(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=60).status_code == 404

    @pytest.mark.parametrize("lst", ["electricalService", "engineService"])
    def test_other_allowed_lists(self, lst):
        o = s(OWNER)
        r = upload(o, lst)
        assert r.status_code == 200
        o.delete(f"{BASE_URL}/api/boats/main/item-photo/{r.json()['photo_id']}", timeout=30)

    @pytest.mark.parametrize("lst", ["safety", "provisions", "x" * 41])
    def test_wrong_list(self, lst):
        assert upload(s(OWNER), lst).status_code in (400, 422)

    def test_non_image(self):
        r = upload(s(OWNER), data=b"hello", ctype="text/plain")
        assert r.status_code == 400

    def test_too_big(self):
        r = upload(s(OWNER), data=JPG + b"\0" * (3 * 1024 * 1024))
        assert r.status_code == 400 and "3 MB" in r.json()["detail"]

    def test_unauth(self):
        assert upload(requests.Session()).status_code == 401
        assert requests.get(f"{BASE_URL}/api/boats/main/item-photo/{'a'*32}").status_code == 401

    def test_unknown_boat(self):
        o = s(OWNER)
        r = o.post(f"{BASE_URL}/api/boats/nope_boat/item-photo", params={"list_id": "riggingChecks"}, files={"file": ("p.jpg", JPG, "image/jpeg")})
        assert r.status_code == 404

    def test_bad_photo_id(self):
        assert s(OWNER).get(f"{BASE_URL}/api/boats/main/item-photo/not-hex").status_code == 422
