# Magic Marine Navigator (POST /api/ai/navigator-ask), boat route fields, Route Planning template name, MMN analytics
import os
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, ADMIN = "test_session_pro_1", "test_session_free_1", "test_session_admin_1"
FOOTER = "Suggested route only. Check official charts, notices to mariners, tides and the latest weather before you sail."
URL = f"{BASE_URL}/api/ai/navigator-ask"


def s(tok):
    c = requests.Session()
    c.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return c


def mdb():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l and not l.startswith("#"))
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


BOAT = {"boat_type": "Sloop", "units": "m", "loa": "11", "beam": "3.6", "draft": "1.9", "mast_height": "16", "pob": 3, "children": 1, "trip_days": 3}
BODY = {"question": "Mana to Picton via Queen Charlotte Sound", "start": "Mana", "destination": "Picton", "boat": BOAT,
        "items": ["Tide times check", "Weather alerts"]}


# Validation and access
class TestNavigatorValidation:
    def test_no_auth_401(self):
        assert requests.post(URL, json=BODY).status_code == 401

    def test_free_403(self):
        assert s(FREE).post(URL, json=BODY).status_code == 403

    @pytest.mark.parametrize("patch", [{"start": ""}, {"destination": "  "}, {"start": None}])
    def test_blank_places_422(self, patch):
        b = {**BODY, **patch}
        if patch.get("start", 1) is None:
            b.pop("start")
        r = s(PRO).post(URL, json=b)
        assert r.status_code == 422, r.text

    def test_question_too_long_422(self):
        assert s(PRO).post(URL, json={**BODY, "question": "x" * 1025}).status_code == 422

    def test_place_too_long_422(self):
        assert s(PRO).post(URL, json={**BODY, "start": "x" * 81}).status_code == 422


# Real AI call (1 Gemini call)
class TestNavigatorAsk:
    def test_ask_pro_and_usage(self):
        db = mdb()
        since = datetime.now(timezone.utc).isoformat()
        r = s(PRO).post(URL, json=BODY, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["answer"], str) and d["answer"].strip().endswith(FOOTER)
        assert d["answer"].count("Suggested route only") == 1
        assert isinstance(d["asks_left"], int) and d["asks_left"] >= 0  # shared Magic pool
        row = db.ai_usage.find_one({"user_id": "test-user-pro", "feature": "MMN"}, sort=[("_id", -1)])
        assert row is not None
        print("usage row", {k: v for k, v in row.items() if k != "_id"})
        drafts = db.ai_drafts.count_documents({"user_id": "test-user-pro", "kind": "navigator", "created_at": {"$gte": since}})
        assert drafts == 1

    def test_admin_analytics_has_mmn(self):
        r = s(ADMIN).get(f"{BASE_URL}/api/admin/analytics")
        assert r.status_code == 200
        txt = r.text
        assert "MMN" in txt and "Magic Marine Navigator" in txt


# Boat route fields
class TestBoatRoute:
    def state(self, **boat):
        return {"boat": {"vessel": "TEST_Nav", **boat}, "registry": [{"id": "routeHazards", "name": "Route Planning", "isSystem": True}],
                "data": {"routeHazards": []}, "updated_at": datetime.now(timezone.utc).isoformat()}

    def test_route_fields_roundtrip(self):
        c = s(PRO)
        r = c.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_nav"}, json=self.state(route_start="Mana", route_dest="Picton"))
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["route_start"] == "Mana" and r.json()["boat"]["route_dest"] == "Picton"
        g = c.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_nav"}).json()
        assert g["boat"]["route_start"] == "Mana" and g["boat"]["route_dest"] == "Picton"

    def test_route_too_long_422(self):
        r = s(PRO).put(f"{BASE_URL}/api/me/boat", params={"boat_id": "TEST_nav"}, json=self.state(route_start="x" * 81))
        assert r.status_code == 422

    def test_cleanup(self):
        r = s(PRO).delete(f"{BASE_URL}/api/me/boats/TEST_nav")
        assert r.status_code in (200, 204)


# Template name
def test_template_lists_route_planning():
    src = open("/app/backend/templates.py").read()
    assert '"routeHazards": "Route Planning"' in src and "Route Hazards" not in src
    r = s(ADMIN).get(f"{BASE_URL}/api/admin/template-lists")
    assert r.status_code == 200
    print(r.text[:600])
