# Zone Map Overview callouts: swatch lx (0..1) / band ('top'|'bottom') label position API tests
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MID = "cba66e09-3511-4d45-bf60-17224c73d58d"
PRO = {"Cookie": "session_token=test_session_pro_1"}
FREE = {"Cookie": "session_token=test_session_free_1"}
URL = f"{API}/boats/main/zone-maps/{MID}/swatches"


def current():
    r = requests.get(f"{API}/me/boats", headers=PRO, timeout=30)
    assert r.status_code == 200
    b = next(b for b in r.json()["boats"] if b["boat_id"] == "main" and not b["crew"])
    return next(m for m in b["zone_maps"] if m["id"] == MID)["swatches"]


@pytest.fixture(scope="module", autouse=True)
def restore():
    orig = current()
    yield
    r = requests.put(URL, json={"swatches": orig}, headers=PRO, timeout=30)
    assert r.status_code == 200


class TestLabelFields:
    def test_lx_band_saved_and_persisted(self):
        sw = current()
        sw[0] = {**sw[0], "lx": 0.3, "band": "bottom"}
        r = requests.put(URL, json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 200
        got = next(s for s in current() if s["id"] == sw[0]["id"])
        assert got["lx"] == 0.3 and got["band"] == "bottom"

    def test_band_top_and_lx_edges(self):
        sw = current()
        sw[1] = {**sw[1], "lx": 0, "band": "top"}
        sw[2] = {**sw[2], "lx": 1, "band": "bottom"}
        assert requests.put(URL, json={"swatches": sw}, headers=PRO, timeout=30).status_code == 200
        c = {s["id"]: s for s in current()}
        assert c[sw[1]["id"]]["lx"] == 0 and c[sw[1]["id"]]["band"] == "top"
        assert c[sw[2]["id"]]["lx"] == 1

    def test_omitted_not_stored_as_null(self):
        sw = [{k: v for k, v in s.items() if k not in ("lx", "band")} for s in current()]
        assert requests.put(URL, json={"swatches": sw}, headers=PRO, timeout=30).status_code == 200
        for s in current():
            assert "lx" not in s and "band" not in s

    def test_null_explicit_not_stored(self):
        sw = current()
        sw[0] = {**sw[0], "lx": None, "band": None}
        assert requests.put(URL, json={"swatches": sw}, headers=PRO, timeout=30).status_code == 200
        got = next(s for s in current() if s["id"] == sw[0]["id"])
        assert "lx" not in got and "band" not in got

    @pytest.mark.parametrize("bad", [{"lx": 1.2}, {"lx": -0.1}, {"band": "left"}, {"band": ""}])
    def test_invalid_422(self, bad):
        sw = current()
        before = current()
        sw[0] = {**sw[0], **bad}
        r = requests.put(URL, json={"swatches": sw}, headers=PRO, timeout=30)
        assert r.status_code == 422
        assert current() == before

    def test_crew_cannot_save(self):
        sw = current()
        r = requests.put(f"{API}/boats/main/zone-maps/{MID}/swatches", json={"swatches": sw}, headers=FREE, timeout=30)
        # free user has no overview with this id on their own 'main' -> 404
        assert r.status_code in (403, 404)

    def test_unauth(self):
        assert requests.put(URL, json={"swatches": []}, timeout=30).status_code == 401
