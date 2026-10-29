# Iteration 56: list description limit 1000 (AI draft/topup, admin template lists) + MPA synonym badges in exports
import os
import sys
import pytest
import requests

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
CTX = {"vessel": "V", "callsign": "C", "position": "", "local_date": "", "pob": 2, "boat_type": "", "children": 0, "mmsi": ""}


# AI list-draft / list-topup description validation (1001 -> 422 without using quota)
class TestAiDescriptionLimit:
    def test_draft_1001_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-draft", json={"name": "TEST_x", "description": "a" * 1001}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_topup_1001_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/list-topup", json={"name": "TEST_x", "description": "a" * 1001, "items": [{"label": "Rope"}]}, headers=PRO, timeout=30)
        assert r.status_code == 422

    def test_draft_1000_accepted(self):
        desc = ("Safety gear for a coastal yacht: lifejackets, flares, EPIRB, first aid. " * 20)[:1000]
        r = requests.post(f"{BASE_URL}/api/ai/list-draft", json={"name": "TEST_Safety", "description": desc}, headers=PRO, timeout=90)
        assert r.status_code != 422, r.text
        assert r.status_code in (200, 429), r.text

    def test_models_accept_1000(self):
        from ai_lists import DraftIn, TopUpIn  # noqa
        assert len(DraftIn(name="x", description="b" * 1000).description) == 1000
        assert len(TopUpIn(name="x", description="b" * 1000).description) == 1000


# Admin template list description 1000
class TestTemplateDescription:
    def test_create_update_1000(self):
        d = "c" * 1000
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_Desc1000", "description": d, "items": ["One"]}, headers=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        try:
            assert len(r.json()["description"]) == 1000
            r2 = requests.put(f"{BASE_URL}/api/admin/template-lists/{lid}", json={"name": "TEST_Desc1000", "description": "e" * 1000, "items": ["One"]}, headers=ADMIN, timeout=30)
            assert r2.status_code == 200, r2.text
            r3 = requests.put(f"{BASE_URL}/api/admin/template-lists/{lid}", json={"name": "TEST_Desc1000", "description": "e" * 1001, "items": ["One"]}, headers=ADMIN, timeout=30)
            assert r3.status_code == 422
            g = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, timeout=30).json()
            lists = g if isinstance(g, list) else g.get("lists", g.get("items", []))
            found = [x for x in lists if x.get("id") == lid]
            assert found and found[0]["description"] == "e" * 1000
        finally:
            requests.delete(f"{BASE_URL}/api/admin/template-lists/{lid}", headers=ADMIN, timeout=30)

    def test_create_1001_rejected(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_Desc1001", "description": "c" * 1001, "items": ["One"]}, headers=ADMIN, timeout=30)
        assert r.status_code == 422


# ship_log._with_badges subs text
class TestExportBadges:
    def test_sub_badge_text(self):
        from ship_log import render_items, _mpa_label
        m = {"base": "Sea salt – 1 tsp", "meals": [1], "subs": [{"name": "Table Salt", "areas": ["Galley Cupboard 1"]}]}
        out = render_items([{"label": _mpa_label(m), "mpa": m, "indent": True}], CTX)
        assert out[0]["label"].endswith(" · On board instead: Galley Cupboard 1: Table Salt")

    def test_prov_onboard_and_sub(self):
        from ship_log import render_items, _mpa_label
        m = {"base": "Salt", "prov": True, "areas": ["Fridge"], "subs": [{"name": "Table Salt", "areas": ["A", "B"]}]}
        lab = render_items([{"label": _mpa_label(m), "mpa": m}], CTX)[0]["label"]
        assert lab == "Salt · PROV · On board: Fridge · On board instead: A: Table Salt, B: Table Salt"

    def test_edited_row_no_badges(self):
        from ship_log import render_items
        m = {"base": "Sea salt", "subs": [{"name": "Table Salt", "areas": ["G"]}]}
        assert render_items([{"label": "Sea salt edited", "mpa": m}], CTX)[0]["label"] == "Sea salt edited"
