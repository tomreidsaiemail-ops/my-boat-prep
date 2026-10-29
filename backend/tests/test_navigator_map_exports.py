# Iteration 53: Navigator waypoints/distance/passage_time (parse + real Gemini) and MPA PROV / On board badges in email-log + PDF exports
import os
import sys
from datetime import datetime, timezone
from io import BytesIO
import pytest
import requests
from pypdf import PdfReader

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")
from ai_lists import parse_navigator, _waypoints, NAV_FOOTER  # noqa: E402
from ship_log import render_items, _mpa_label  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = "test_session_pro_1"
BID = "TEST_mpaexp"


def s(tok=PRO):
    c = requests.Session()
    c.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return c


# parse_navigator / _waypoints unit checks
class TestParseNavigator:
    def test_full_json(self):
        t = '{"answer": "1. Mana to Cape Terawhiti 15 nm\\n2. Cross to Tory Channel 20 nm\\nSuggested route only. blah", "waypoints": [{"name": "Mana", "lat": -41.1, "lon": 174.86}, {"name": "Tory", "lat": "-41.2", "lon": 174.3}, {"name": "Picton", "lat": -41.29, "lon": 174.0}], "distance_nm": "52.34", "passage_time": "about 9 hours at 6 knots"}'
        d = parse_navigator(t)
        assert d["answer"].endswith(NAV_FOOTER) and d["answer"].count("Suggested route only") == 1
        assert "\n2. Cross" in d["answer"]
        assert [w["name"] for w in d["waypoints"]] == ["Mana", "Tory", "Picton"]
        assert d["waypoints"][1]["lat"] == -41.2
        assert d["distance_nm"] == 52.3 and d["passage_time"].startswith("about 9")

    def test_code_fence_json(self):
        t = '```json\n{"answer": "Leg 1", "waypoints": [{"name":"A","lat":1,"lon":2},{"name":"B","lat":3,"lon":4}]}\n```'
        d = parse_navigator(t)
        assert len(d["waypoints"]) == 2 and d["distance_nm"] is None and d["passage_time"] == ""

    @pytest.mark.parametrize("raw", [None, "x", [], [{"name": "A", "lat": 1, "lon": 2}], [{"name": "A", "lat": 91, "lon": 2}, {"name": "B", "lat": 1, "lon": 200}],
                                     [{"name": "A", "lat": "abc", "lon": 2}, {"lat": None, "lon": 1}], [1, 2, "x"]])
    def test_invalid_waypoints_empty(self, raw):
        assert _waypoints(raw) == []

    def test_waypoints_cap_20(self):
        assert len(_waypoints([{"name": str(i), "lat": i / 10, "lon": i / 10} for i in range(30)])) == 20

    def test_nan_dropped(self):
        assert _waypoints([{"name": "A", "lat": "nan", "lon": 1}, {"name": "B", "lat": 1, "lon": 1}]) == []

    def test_plain_text_fallback(self):
        d = parse_navigator("1. Go north\n2. Go west")
        assert d["waypoints"] == [] and d["answer"].endswith(NAV_FOOTER)

    def test_bad_distance(self):
        d = parse_navigator('{"answer": "x", "distance_nm": "far"}')
        assert d["distance_nm"] is None


# Real Gemini call (1 ask)
class TestNavigatorLive:
    def test_ask_returns_waypoints(self):
        body = {"question": "Mana Marina to Picton", "start": "Mana Marina", "destination": "Picton",
                "boat": {"boat_type": "Sloop", "units": "m", "loa": "11", "draft": "1.9", "pob": 3, "children": 1, "trip_days": 2}, "items": ["Tide times"]}
        r = s().post(f"{BASE_URL}/api/ai/navigator-ask", json=body, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        print("NAV", {k: v for k, v in d.items() if k != "answer"})
        print(d["answer"])
        assert d["answer"].strip().endswith(NAV_FOOTER)
        assert "\n" in d["answer"]
        wps = d["waypoints"]
        assert 2 <= len(wps) <= 20
        for w in wps:
            assert isinstance(w["lat"], float) or isinstance(w["lat"], int)
            assert -42.5 < w["lat"] < -40.5 and 173.0 < w["lon"] < 175.5, w  # Cook Strait region
        assert "mana" in wps[0]["name"].lower() and "picton" in wps[-1]["name"].lower()
        assert d["distance_nm"] is None or 10 < d["distance_nm"] < 200
        assert isinstance(d["passage_time"], str)
        assert isinstance(d["asks_left"], int)


# render_items badges
class TestRenderBadges:
    CTX = {"vessel": "V", "callsign": "C", "position": "P", "local_date": "D", "pob": 1}

    def test_badges(self):
        m1 = {"base": "Rice – 200g", "src": ["Meals A"], "meals": [1], "prov": True, "areas": ["Galley", "Fridge"]}
        m2 = {"base": "Salt", "prov": True}
        m3 = {"base": "Eggs", "meals": [2], "areas": ["Fridge"]}
        m4 = {"base": "Milk", "areas": ["Fridge"]}
        items = [{"id": 1, "label": "Header"},
                 {"id": 2, "label": _mpa_label(m1), "mpa": m1, "indent": True},
                 {"id": 3, "label": "Salt", "mpa": m2, "indent": True},
                 {"id": 4, "label": "Eggs [2]", "mpa": m3},
                 {"id": 5, "label": "Milk EDITED", "mpa": m4},
                 {"id": 6, "label": "Plain item"},
                 {"id": 7, "label": "Butter", "mpa": {"base": "Butter"}}]
        out = [i["label"] for i in render_items(items, self.CTX)]
        assert out[0] == "Header"
        assert out[1] == "Rice – 200g (Meals A) [1] · PROV · On board: Galley, Fridge"
        assert out[2] == "Salt · PROV"
        assert out[3] == "Eggs [2] · On board: Fridge"
        assert out[4] == "Milk EDITED"
        assert out[5] == "Plain item"
        assert out[6] == "Butter"


# Email-log + PDF end-to-end with MPA rows on a TEST boat
@pytest.fixture(scope="module")
def test_boat():
    c = s()
    t = datetime.now(timezone.utc).isoformat()
    m1 = {"base": "Coffee – 1 jar", "prov": True, "areas": ["Main Galley Cupboard", "Fridge"]}
    m2 = {"base": "Rice – 200g", "meals": [1], "areas": ["Main Galley Cupboard"]}
    m3 = {"base": "Tea", "prov": True}
    items = [{"id": 1, "label": "Provisions for 2 days", "checked": False},
             {"id": 2, "label": _mpa_label(m1), "checked": False, "indent": True, "mpa": m1},
             {"id": 3, "label": _mpa_label(m2), "checked": True, "indent": True, "mpa": m2},
             {"id": 4, "label": "Tea EDITED", "checked": False, "indent": True, "mpa": m3},
             {"id": 5, "label": "Plain row", "checked": False}]
    state = {"boat": {"vessel": "TEST_Exp", "skipper": "Tess", "callsign": "ZMT123", "log_email": "delivered@resend.dev"},
             "registry": [{"id": "custom_mpa53", "name": "TEST_MPA Shop", "isSystem": False, "kind": "mpa"}],
             "data": {"custom_mpa53": items}, "updated_at": t}
    r = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BID}, json=state)
    assert r.status_code == 200, r.text
    yield c
    c.delete(f"{BASE_URL}/api/me/boats/{BID}")


class TestExportBadges:
    def test_mpa_persisted(self, test_boat):
        g = test_boat.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BID}).json()
        assert g["data"]["custom_mpa53"][1]["mpa"]["prov"] is True

    def test_email_and_pdf(self, test_boat):
        r = test_boat.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "1 Jan 2026", "list_ids": ["custom_mpa53"], "boat_id": BID}, timeout=60)
        assert r.status_code == 200, r.text
        url = r.json()["log_sent"]["pdf_url"]
        log_id = r.json()["log_sent"]["log_id"]
        p = requests.get(f"{BASE_URL}/api/ship-logs/{log_id}.pdf", timeout=60)
        assert p.status_code == 200 and p.headers["content-type"].startswith("application/pdf")
        txt = " ".join(pg.extract_text() for pg in PdfReader(BytesIO(p.content)).pages)
        flat = " ".join(txt.split())
        print("PDF url", url, "\n", flat[:900])
        assert "Coffee – 1 jar · PROV · On board: Main Galley Cupboard, Fridge" in flat or "Coffee - 1 jar · PROV · On board: Main Galley Cupboard, Fridge" in flat
        assert "Rice – 200g [1] · On board: Main Galley Cupboard" in flat or "Rice - 200g [1] · On board: Main Galley Cupboard" in flat
        assert "Tea EDITED" in flat and "Tea EDITED ·" not in flat
        assert "Plain row" in flat and "Plain row ·" not in flat
        # email html uses same rendered labels (stored on log)
        import sys as _s
        _s.path.insert(0, "/app/backend")
        from ship_log import build_email_html
        from pymongo import MongoClient
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        log = db.ship_logs.find_one({"log_id": log_id}, {"_id": 0})
        labels = [i["label"] for i in log["lists"][0]["items"]]
        print(labels)
        assert labels[1] == "Coffee – 1 jar · PROV · On board: Main Galley Cupboard, Fridge"
        html = build_email_html(log, url, "My Boat Prep")
        assert "· PROV · On board: Main Galley Cupboard, Fridge" in html
