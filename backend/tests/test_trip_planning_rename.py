# Trip Planning rename (was Route Planning): migration, charter alias, ownership trip detection, boat API.
import os
import re
import sys

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OLD = re.compile(r"^\s*route planning\b", re.I)


@pytest.fixture(scope="module")
def db():
    c = MongoClient(os.environ["MONGO_URL"])
    yield c[os.environ["DB_NAME"]]
    c.close()


def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# Startup migration
class TestMigration:
    def test_migration_marker(self, db):
        assert db.migrations.find_one({"_id": "trip_planning_rename_2026_06"}) is not None

    def test_no_route_planning_registry_names(self, db):
        assert db.user_boats.count_documents({"registry.name": {"$regex": r"^\s*route planning\b", "$options": "i"}}) == 0

    def test_no_route_planning_invite_trip_names(self, db):
        assert db.crew_invites.count_documents({"trip_name": {"$regex": r"^\s*route planning\b", "$options": "i"}}) == 0

    def test_copies_renamed(self, db):
        d = db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"registry": 1})
        names = {r["id"]: r["name"] for r in d["registry"]}
        assert names["routeHazards"] == "Trip Planning"
        assert names["custom_trip2"] == "Trip Planning - 2"


# Boat API returns renamed names
class TestBoatApi:
    def test_pro_boat_registry(self):
        r = auth("test_session_pro_1").get(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"})
        assert r.status_code == 200
        txt = r.text
        assert '"Trip Planning"' in txt
        reg = r.json().get("registry") or r.json().get("state", {}).get("registry") or []
        assert not any(OLD.match(x.get("name") or "") for x in reg)


# Charter handover alias: admin list says "Route Planning", boat list is "Trip Planning"
class TestCharterNorm:
    def test_norm_alias(self):
        from charter import norm
        assert norm("Trip Planning") == norm("Route Planning") == "route planning"
        assert norm("  *Trip   Planning ") == "route planning"
        assert norm("Trip Planning - Sounds") == "route planning - sounds"
        assert norm("Leaving Dock") == "leaving dock"

    def test_handover_includes_trip_planning(self, db):
        from charter import DEFAULT_HANDOVER, norm
        t = db.list_templates.find_one({"name": {"$regex": r"^\s*admin - charter lists to hand over\s*$", "$options": "i"}}, {"items": 1})
        lines = [i.get("label") for i in (t or {}).get("items") or []] or list(DEFAULT_HANDOVER)
        names = {norm(n) for n in lines}
        assert norm("Trip Planning") in names

    def test_charters_api_handover_lists_include_trip_planning(self):
        r = auth("test_session_pro_1").get(f"{BASE_URL}/api/charters", params={"boat_id": "main"})
        assert r.status_code == 200, r.text
        assert "Trip Planning" in r.json()["handover_lists"]


# Ownership transfer trip detection
class TestOwnershipIsTrip:
    def test_is_trip(self):
        from ownership import is_trip
        assert is_trip({"id": "routeHazards", "name": "Trip Planning"})
        assert is_trip({"id": "x1", "name": "Trip Planning - Sounds"})
        assert is_trip({"id": "x2", "name": "Route Planning - 2"})
        assert is_trip({"id": "x3", "name": "Anything", "trip": True})
        assert not is_trip({"id": "x4", "name": "Leaving Dock"})
