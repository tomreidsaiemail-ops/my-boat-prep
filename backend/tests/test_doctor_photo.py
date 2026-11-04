# Magic Marine Doctor: photo asks, history, photo serving, ownership, validation (iteration 76)
import io
import json
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = "test_session_pro_1"
BETA = "test_session_beta_1"
IMG = "/tmp/hand.jpg"


def sess(token):
    s = requests.Session()
    s.cookies.set("session_token", token)
    return s


@pytest.fixture(scope="module")
def pro():
    return sess(PRO)


@pytest.fixture(scope="module")
def beta():
    return sess(BETA)


@pytest.fixture(scope="module")
def created(pro):
    ids = []
    yield ids
    for i in ids:
        pro.delete(f"{BASE_URL}/api/ai/doctor-history/{i}")


PAYLOAD = {"log_agree": True, "question": "TEST_ What are these items and when would I use them for a cut hand?", "kit_name": "First Aid Kit",
           "kit": ["Plasters", "Bandage", "Antiseptic"], "adults": 2, "children": 0}


@pytest.fixture(scope="module")
def photo_answer(pro, created):
    with open(IMG, "rb") as f:
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps(PAYLOAD)},
                     files={"file": ("doctor.jpg", f, "image/jpeg")}, timeout=150)
    assert r.status_code == 200, r.text
    d = r.json()
    created.append(d["saved"]["id"])
    return d


class TestDoctorPhoto:
    def test_photo_ask_answers(self, photo_answer):
        d = photo_answer
        assert d["photo_saved"] is True
        assert d["saved"]["has_photo"] is True
        assert "Mayday" in d["answer"]
        assert isinstance(d["asks_left"], int)
        print("PHOTO ANSWER:", d["answer"][:600])

    def test_history_lists_newest_first(self, pro, photo_answer):
        r = pro.get(f"{BASE_URL}/api/ai/doctor-history")
        assert r.status_code == 200
        ans = r.json()["answers"]
        assert ans[0]["id"] == photo_answer["saved"]["id"]
        assert ans[0]["has_photo"] is True
        dates = [a["created_at"] for a in ans]
        assert dates == sorted(dates, reverse=True)
        assert all("_id" not in a and "user_id" not in a for a in ans)

    def test_photo_served(self, pro, photo_answer):
        r = pro.get(f"{BASE_URL}/api/ai/doctor-history/{photo_answer['saved']['id']}/photo")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/jpeg")
        assert r.content == open(IMG, "rb").read()

    def test_other_user_404_and_no_history(self, beta, photo_answer):
        aid = photo_answer["saved"]["id"]
        assert beta.get(f"{BASE_URL}/api/ai/doctor-history/{aid}/photo").status_code == 404
        r = beta.get(f"{BASE_URL}/api/ai/doctor-history")
        assert r.status_code == 200
        assert aid not in [a["id"] for a in r.json()["answers"]]
        assert beta.delete(f"{BASE_URL}/api/ai/doctor-history/{aid}").status_code == 404

    def test_unauth_401(self, photo_answer):
        assert requests.get(f"{BASE_URL}/api/ai/doctor-history").status_code == 401
        assert requests.get(f"{BASE_URL}/api/ai/doctor-history/{photo_answer['saved']['id']}/photo").status_code == 401

    def test_non_image_400(self, pro):
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps(PAYLOAD)},
                     files={"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")})
        assert r.status_code == 400
        assert "JPEG" in r.json()["detail"]

    def test_too_big_400(self, pro):
        big = b"\xff\xd8" + b"0" * (5 * 1024 * 1024 + 10)
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps(PAYLOAD)},
                     files={"file": ("big.jpg", io.BytesIO(big), "image/jpeg")}, timeout=120)
        assert r.status_code in (400, 413), r.status_code
        if r.status_code == 400:
            assert "5 MB" in r.json()["detail"]

    def test_empty_question_422(self, pro):
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps({**PAYLOAD, "question": "   "})},
                     files={"file": ("doctor.jpg", open(IMG, "rb"), "image/jpeg")})
        assert r.status_code == 422
        r2 = pro.post(f"{BASE_URL}/api/ai/doctor-ask", json={**PAYLOAD, "question": ""})
        assert r2.status_code == 422

    def test_bad_payload_json_422(self, pro):
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": "not json"},
                     files={"file": ("doctor.jpg", open(IMG, "rb"), "image/jpeg")})
        assert r.status_code == 422

    def test_text_ask_saved_without_photo(self, pro, created):
        r = pro.post(f"{BASE_URL}/api/ai/doctor-ask", json={**PAYLOAD, "question": "TEST_ How do I treat mild seasickness?"}, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        created.append(d["saved"]["id"])
        assert d["saved"]["has_photo"] is False
        assert pro.get(f"{BASE_URL}/api/ai/doctor-history/{d['saved']['id']}/photo").status_code == 404

    def test_pet_photo_ask(self, pro, created):
        p = {**PAYLOAD, "question": "TEST_ My dog chewed these, what should I do?", "pet": {"type": "Dog", "name": "TEST_Rex", "breed": "Labrador", "weight": "30"}, "units": "kg"}
        with open(IMG, "rb") as f:
            r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps(p)},
                         files={"file": ("doctor.jpg", f, "image/jpeg")}, timeout=150)
        assert r.status_code == 200, r.text
        d = r.json()
        created.append(d["saved"]["id"])
        assert d["saved"]["pet"] == "TEST_Rex"
        assert "vet" in d["answer"].lower()
        print("PET ANSWER:", d["answer"][:400])

    def test_delete_removes(self, pro):
        with open(IMG, "rb") as f:
            r = pro.post(f"{BASE_URL}/api/ai/doctor-ask-photo", data={"payload": json.dumps({**PAYLOAD, "question": "TEST_ delete me: what is this?"})},
                         files={"file": ("doctor.jpg", f, "image/jpeg")}, timeout=150)
        assert r.status_code == 200
        aid = r.json()["saved"]["id"]
        assert pro.delete(f"{BASE_URL}/api/ai/doctor-history/{aid}").status_code == 200
        assert aid not in [a["id"] for a in pro.get(f"{BASE_URL}/api/ai/doctor-history").json()["answers"]]
        assert pro.get(f"{BASE_URL}/api/ai/doctor-history/{aid}/photo").status_code == 404
        assert pro.delete(f"{BASE_URL}/api/ai/doctor-history/{aid}").status_code == 200  # soft-delete again matches
