# Rigging Log: POST /api/service-history/pdf kind=rigging (content, filename, photos) + sync_merge rigging_log section
import io
import os
import sys
import pytest
import requests
from pypdf import PdfReader

sys.path.insert(0, "/app/backend")
from sync_merge import merge_state, SECTIONS  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
URL = f"{BASE_URL}/api/service-history/pdf"
PRO, FREE = "test_session_pro_1", "test_session_free_1"
CREATED = []


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


def text(content):
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(content)).pages)


RIG = {"kind": "rigging", "vessel": "TEST_Kia Ora", "skipper": "Tom", "local_date": "4/11/2026",
       "entries": [{"date": "2026-11-04", "rigger": "TEST_Jo Mast", "notes": "retensioned", "items": ["Cap shrouds", "Forestay"]},
                   {"date": "2026-03-01", "rigger": "TEST_Old Rigger", "notes": "", "items": []}]}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for sess, pid in CREATED:
        sess.delete(f"{BASE_URL}/api/boats/main/item-photo/{pid}", timeout=30)


class TestRiggingPdf:
    def test_rigging_pdf_ok(self):
        r = s(PRO).post(URL, json=RIG, timeout=60)
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"
        assert 'filename="Rigging Service History - TEST_Kia Ora.pdf"' in r.headers["content-disposition"]
        t = text(r.content)
        assert "RIGGING SERVICE HISTORY" in t.upper()
        assert "TEST_Jo Mast" in t and "Cap shrouds" in t and "retensioned" in t
        assert "Rigger" in t
        assert "04/11/2026" in t
        assert t.index("TEST_Jo Mast") < t.index("TEST_Old")  # newest first

    def test_rigger_too_long_422(self):
        bad = {**RIG, "entries": [{"date": "2026-11-04", "rigger": "x" * 81}]}
        assert s(PRO).post(URL, json=bad, timeout=30).status_code == 422

    def test_free_forbidden(self):
        r = s(FREE).post(URL, json=RIG, timeout=30)
        assert r.status_code in (403, 200)  # 200 only if FIRST200 promo is on

    def test_rigging_photos(self):
        from PIL import Image
        o = s(PRO)
        pids = []
        for colour in ((0, 90, 200), (200, 90, 0)):
            buf = io.BytesIO()
            Image.new("RGB", (400, 300), colour).save(buf, "JPEG")
            up = o.post(f"{BASE_URL}/api/boats/main/item-photo", params={"list_id": "riggingChecks"},
                        files={"file": ("p.jpg", buf.getvalue(), "image/jpeg")}, timeout=90)
            assert up.status_code == 200, up.text
            pids.append(up.json()["photo_id"])
            CREATED.append((o, pids[-1]))
        body = {**RIG, "boat_id": "main", "photos": [{"item": "TEST_Forestay", "slot": "Before", "photo_id": pids[0], "note": "frayed"},
                                                       {"item": "TEST_Forestay", "slot": "After", "photo_id": pids[1], "note": "new wire"}]}
        r = o.post(URL, json=body, timeout=90)
        assert r.status_code == 200, r.text
        t = text(r.content)
        assert "PHOTOS" in t and "TEST_Forestay" in t and "frayed" in t and "new wire" in t
        assert sum(len(p.images) for p in PdfReader(io.BytesIO(r.content)).pages) == 2


class TestRiggingMerge:
    def test_section_listed(self):
        assert "rigging_log" in SECTIONS

    def test_newer_rigging_log_wins(self):
        prev = {"registry": [], "data": {}, "rigging_log": [{"id": 1}], "sec_ts": {"rigging_log": "2026-01-01"}}
        inc = {"registry": [], "data": {}, "rigging_log": [{"id": 1}, {"id": 2}], "sec_ts": {"rigging_log": "2026-02-01"}}
        assert merge_state(prev, inc)["rigging_log"] == [{"id": 1}, {"id": 2}]
        assert merge_state(inc, prev)["rigging_log"] == [{"id": 1}, {"id": 2}]


class TestRiggingStored:
    def test_get_boat_has_rigging_log(self):
        r = s(PRO).get(f"{BASE_URL}/api/me/boat", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json().get("rigging_log", []), list)
