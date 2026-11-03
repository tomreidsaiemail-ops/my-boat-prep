# Service History PDF photos: POST /api/service-history/pdf with boat_id + photos[] (Before/After + captions)
import io
import os
import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/service-history/pdf"
OWNER, OTHER = "test_session_pro_1", "test_session_beta_1"
JPG = open("/app/tests/fixtures/medical.jpg", "rb").read()
CREATED = []


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


def upload(sess, data=JPG, ctype="image/jpeg", list_id="engineService"):
    r = sess.post(f"{BASE_URL}/api/boats/main/item-photo", params={"list_id": list_id}, files={"file": ("p.jpg", data, ctype)}, timeout=90)
    assert r.status_code == 200, r.text
    pid = r.json()["photo_id"]
    CREATED.append((sess, pid))
    return pid


def text(content):
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(content)).pages)


def n_images(content):
    return sum(len(p.images) for p in PdfReader(io.BytesIO(content)).pages)


def body(photos, boat_id="main", kind="engine"):
    return {"kind": kind, "vessel": "TEST_Vessel", "skipper": "T", "local_date": "1/1/2026", "boat_id": boat_id,
            "entries": [{"date": "2026-01-05", "hours": 100, "notes": "n", "items": ["Impeller"]}], "photos": photos}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for sess, pid in CREATED:
        sess.delete(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=30)


@pytest.fixture(scope="module")
def two():
    from PIL import Image
    o = s(OWNER)
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), (0, 90, 200)).save(buf, "JPEG")
    return upload(o), upload(o, data=buf.getvalue())


class TestServicePdfPhotos:
    def test_before_after_with_captions(self, two):
        b, a = two
        r = s(OWNER).post(URL, json=body([{"item": "TEST_Impeller swap", "slot": "Before", "photo_id": b, "note": "worn May 2026"},
                                          {"item": "TEST_Impeller swap", "slot": "After", "photo_id": a, "note": "replaced May 2026"}]), timeout=90)
        assert r.status_code == 200, r.text
        t = text(r.content)
        assert "PHOTOS" in t and "TEST_Impeller swap" in t
        assert "worn May 2026" in t and "replaced May 2026" in t
        assert "Before" in t and "After" in t
        assert t.index("Impeller") < t.index("PHOTOS")  # table first
        assert n_images(r.content) == 2

    def test_electrical_kind(self, two):
        r = s(OWNER).post(URL, json=body([{"item": "TEST_Batt", "slot": "After", "photo_id": two[0]}], kind="electrical"), timeout=90)
        assert r.status_code == 200
        t = text(r.content)
        assert "ELECTRICAL SERVICE HISTORY" in t and "PHOTOS" in t and "TEST_Batt" in t

    def test_no_photos_no_section(self):
        r = s(OWNER).post(URL, json=body([]), timeout=60)
        assert r.status_code == 200 and "PHOTOS" not in text(r.content)

    def test_other_owner_skipped(self, two):
        # beta user asking for pro's photo id -> skipped, not error
        r = s(OTHER).post(URL, json=body([{"item": "X", "slot": "Before", "photo_id": two[0]}]), timeout=60)
        assert r.status_code == 200 and "PHOTOS" not in text(r.content)

    def test_wrong_boat_and_unknown_skipped(self, two):
        r = s(OWNER).post(URL, json=body([{"item": "X", "slot": "Before", "photo_id": two[0]}], boat_id="nope"), timeout=60)
        assert r.status_code == 200 and "PHOTOS" not in text(r.content)
        r = s(OWNER).post(URL, json=body([{"item": "X", "slot": "Before", "photo_id": "0" * 32}]), timeout=60)
        assert r.status_code == 200 and "PHOTOS" not in text(r.content)

    def test_deleted_skipped_partial(self, two):
        o = s(OWNER)
        keep, gone = two[0], upload(o)
        o.delete(f"{BASE_URL}/api/boats/main/item-photo/{gone}", timeout=30)
        r = o.post(URL, json=body([{"item": "TEST_A", "slot": "Before", "photo_id": keep}, {"item": "TEST_B", "slot": "Before", "photo_id": gone}]), timeout=90)
        assert r.status_code == 200
        t = text(r.content)
        assert "TEST_A" in t and "TEST_B" not in t and n_images(r.content) == 1

    def test_no_boat_id_ignores_photos(self, two):
        r = s(OWNER).post(URL, json=body([{"item": "X", "slot": "Before", "photo_id": two[0]}], boat_id=""), timeout=60)
        assert r.status_code == 200 and "PHOTOS" not in text(r.content)

    @pytest.mark.parametrize("ph", [
        {"item": "X", "slot": "During", "photo_id": "a" * 32},
        {"item": "X", "slot": "Before", "photo_id": "bad"},
        {"item": "X", "slot": "Before", "photo_id": "a" * 32, "note": "n" * 81},
    ])
    def test_validation(self, ph):
        assert s(OWNER).post(URL, json=body([ph]), timeout=30).status_code == 422

    def test_too_many_photos(self):
        assert s(OWNER).post(URL, json=body([{"item": "X", "slot": "Before", "photo_id": "a" * 32}] * 61), timeout=30).status_code == 422

    def test_html_escaped_in_item_and_note(self, two):
        r = s(OWNER).post(URL, json=body([{"item": "TEST_<b>x & y", "slot": "Before", "photo_id": two[0], "note": "<i>a&b"}]), timeout=60)
        assert r.status_code == 200
        t = text(r.content)
        assert "TEST_<b>x & y" in t and "<i>a&b" in t

    def test_png_photo(self):
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGBA", (300, 200), (255, 0, 0, 128)).save(buf, "PNG")
        pid = upload(s(OWNER), data=buf.getvalue(), ctype="image/png")
        r = s(OWNER).post(URL, json=body([{"item": "TEST_png", "slot": "Before", "photo_id": pid}]), timeout=60)
        assert r.status_code == 200 and "TEST_png" in text(r.content)

    def test_corrupt_image_does_not_500(self):
        # upload only checks the client content-type; a non-image stored as jpeg must not break the whole PDF
        pid = upload(s(OWNER), data=b"not really a jpeg" * 50, ctype="image/jpeg")
        r = s(OWNER).post(URL, json=body([{"item": "TEST_bad", "slot": "Before", "photo_id": pid}]), timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
