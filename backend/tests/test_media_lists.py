# Admin-administered media lists: Sailing YouTube Channels & Sailing Movies
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def H(who):
    return {"Authorization": f"Bearer test_session_{who}_1"}


def items(kind, who="admin"):
    r = requests.get(f"{API}/media/{kind}", headers=H(who), timeout=20)
    assert r.status_code == 200
    return r.json()["items"]


def add(kind, payload):
    return requests.post(f"{API}/admin/media/{kind}", json=payload, headers=H("admin"), timeout=40)


def find(lst, name):
    return next((i for i in lst if i["name"] == name), None)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for kind in ("youtube", "movies"):
        for i in items(kind):
            if i["name"].startswith("TEST_") or not i["name"].strip():
                requests.delete(f"{API}/admin/media/{kind}/{i['id']}", headers=H("admin"), timeout=20)


# --- Read access ---
class TestRead:
    @pytest.mark.parametrize("who", ["admin", "free", "pro", "beta"])
    @pytest.mark.parametrize("kind", ["youtube", "movies"])
    def test_any_user_reads(self, who, kind):
        r = requests.get(f"{API}/media/{kind}", headers=H(who), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json()["items"], list)

    def test_unauth_401(self):
        assert requests.get(f"{API}/media/youtube", timeout=20).status_code == 401

    def test_bad_kind_422(self):
        assert requests.get(f"{API}/media/books", headers=H("admin"), timeout=20).status_code == 422


# --- Admin write ---
class TestAdminWrite:
    def test_non_admin_403(self):
        for who in ("free", "pro", "beta"):
            r = requests.post(f"{API}/admin/media/youtube", json={"name": "TEST_x", "url": "https://example.com"}, headers=H(who), timeout=20)
            assert r.status_code == 403, who

    def test_unauth_401(self):
        r = requests.post(f"{API}/admin/media/youtube", json={"name": "TEST_x", "url": "https://example.com"}, timeout=20)
        assert r.status_code == 401

    def test_add_youtube_channel_thumbnail(self):
        r = add("youtube", {"name": "TEST_LaVag", "url": "https://www.youtube.com/@SailingLaVagabonde", "note": "  great channel  "})
        assert r.status_code == 200, r.text
        it = find(r.json()["items"], "TEST_LaVag")
        assert it["note"] == "great channel"
        assert it["thumbnail"] and "yt3" in it["thumbnail"], it["thumbnail"]
        assert find(items("youtube", "free"), "TEST_LaVag")

    def test_add_youtube_video_ytimg(self):
        r = add("youtube", {"name": "TEST_Video", "url": "https://youtu.be/dQw4w9WgXcQ"})
        assert r.status_code == 200
        assert find(r.json()["items"], "TEST_Video")["thumbnail"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"

    def test_add_imdb_thumbnail(self):
        r = add("movies", {"name": "TEST_MandC", "url": "https://www.imdb.com/title/tt0311113/"})
        assert r.status_code == 200
        th = find(r.json()["items"], "TEST_MandC")["thumbnail"]
        if th is None:
            pytest.xfail("IMDb fetch flaky -> null fallback")
        assert "m.media-amazon" in th

    def test_add_no_scheme_no_thumb(self):
        r = add("movies", {"name": "TEST_Example", "url": "example.com"})
        assert r.status_code == 200
        it = find(r.json()["items"], "TEST_Example")
        assert it["url"] == "https://example.com"
        assert it["thumbnail"] is None
        assert it["note"] == ""

    @pytest.mark.parametrize("url", ["notaurl", "ftp://x.com", "https://", "   "])
    def test_invalid_url_422(self, url):
        assert add("movies", {"name": "TEST_bad", "url": url}).status_code == 422

    def test_empty_name_422(self):
        assert add("movies", {"name": "", "url": "https://example.com"}).status_code == 422

    def test_whitespace_name(self):
        r = add("movies", {"name": "   ", "url": "https://example.com"})
        # whitespace-only name should not be stored as empty
        assert r.status_code in (400, 422), f"whitespace name accepted: {r.status_code}"

    def test_note_too_long_422(self):
        assert add("movies", {"name": "TEST_long", "url": "https://example.com", "note": "x" * 161}).status_code == 422

    def test_duplicate_name_400(self):
        r = add("movies", {"name": "test_example", "url": "https://example.org"})
        assert r.status_code == 400
        assert "already exists" in r.json()["detail"]

    def test_private_host_no_fetch(self):
        r = add("movies", {"name": "TEST_Local", "url": "http://localhost.localdomain:8001/"})
        assert r.status_code == 200
        assert find(r.json()["items"], "TEST_Local")["thumbnail"] is None


# --- Edit / reorder / delete ---
class TestEditOrderDelete:
    def test_edit_same_url_keeps_thumb(self):
        it = find(items("youtube"), "TEST_LaVag")
        r = requests.put(f"{API}/admin/media/youtube/{it['id']}", json={"name": "TEST_LaVag2", "url": it["url"], "note": "n"}, headers=H("admin"), timeout=40)
        assert r.status_code == 200
        new = find(items("youtube"), "TEST_LaVag2")
        assert new["id"] == it["id"] and new["thumbnail"] == it["thumbnail"] and new["note"] == "n"

    def test_edit_url_change_refetches(self):
        it = find(items("youtube"), "TEST_LaVag2")
        r = requests.put(f"{API}/admin/media/youtube/{it['id']}", json={"name": "TEST_LaVag2", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}, headers=H("admin"), timeout=40)
        assert r.status_code == 200
        assert find(items("youtube"), "TEST_LaVag2")["thumbnail"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"

    def test_edit_duplicate_400_and_404(self):
        it = find(items("youtube"), "TEST_LaVag2")
        r = requests.put(f"{API}/admin/media/youtube/{it['id']}", json={"name": "test_video", "url": it["url"]}, headers=H("admin"), timeout=20)
        assert r.status_code == 400
        r = requests.put(f"{API}/admin/media/youtube/nope", json={"name": "TEST_z", "url": "https://example.com"}, headers=H("admin"), timeout=20)
        assert r.status_code == 404

    def test_edit_non_admin_403(self):
        it = find(items("youtube"), "TEST_LaVag2")
        r = requests.put(f"{API}/admin/media/youtube/{it['id']}", json={"name": "TEST_q", "url": it["url"]}, headers=H("free"), timeout=20)
        assert r.status_code == 403

    def test_reorder(self):
        ids = [i["id"] for i in items("movies")]
        rev = list(reversed(ids))
        r = requests.put(f"{API}/admin/media/movies/order", json={"ids": rev}, headers=H("admin"), timeout=20)
        assert r.status_code == 200
        assert [i["id"] for i in items("movies")] == rev
        r = requests.put(f"{API}/admin/media/movies/order", json={"ids": ids}, headers=H("admin"), timeout=20)
        assert [i["id"] for i in items("movies")] == ids

    def test_reorder_mismatch_400(self):
        ids = [i["id"] for i in items("movies")]
        assert requests.put(f"{API}/admin/media/movies/order", json={"ids": ids[:-1]}, headers=H("admin"), timeout=20).status_code == 400
        assert requests.put(f"{API}/admin/media/movies/order", json={"ids": ids + ["x"]}, headers=H("admin"), timeout=20).status_code == 400
        assert requests.put(f"{API}/admin/media/movies/order", json={"ids": ids}, headers=H("free"), timeout=20).status_code == 403

    def test_reorder_duplicate_ids(self):
        ids = [i["id"] for i in items("movies")]
        if len(ids) < 2:
            pytest.skip()
        dup = [ids[0]] * len(ids)
        r = requests.put(f"{API}/admin/media/movies/order", json={"ids": dup}, headers=H("admin"), timeout=20)
        assert r.status_code == 400

    def test_delete(self):
        it = find(items("movies"), "TEST_Local")
        r = requests.delete(f"{API}/admin/media/movies/{it['id']}", headers=H("admin"), timeout=20)
        assert r.status_code == 200
        assert find(items("movies"), "TEST_Local") is None
        assert requests.delete(f"{API}/admin/media/movies/{it['id']}", headers=H("free"), timeout=20).status_code == 403


# --- Email log PDF includes media list ---
class TestEmailPdf:
    def test_email_movies_pdf(self):
        r = requests.post(f"{API}/me/email-log", json={"local_date": "Monday, 19 January 2026", "list_ids": ["sailingMovies"]}, headers=H("pro"), timeout=60)
        if r.status_code == 429:
            pytest.skip("daily email limit")
        assert r.status_code == 200, r.text
        pdf_url = r.json()["log_sent"]["pdf_url"]
        log_id = r.json()["log_sent"]["log_id"]
        p = requests.get(f"{API}/ship-logs/{log_id}.pdf", timeout=30)
        assert p.status_code == 200 and p.headers["content-type"] == "application/pdf"
        assert p.content[:4] == b"%PDF"
        print(pdf_url)

    def test_email_free_403(self):
        r = requests.post(f"{API}/me/email-log", json={"local_date": "x", "list_ids": ["sailingYoutube"]}, headers=H("free"), timeout=20)
        assert r.status_code == 403
