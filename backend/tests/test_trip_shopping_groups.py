# Iteration 244: Trip Shopping List - POST /boats/main/crew/shopping with optional aisle groups, shopping_html grouping, BoatDetails.trip_meal_plan
import os
import sys
import pytest
import requests
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
sys.path.insert(0, '/app/backend')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
PRO = "test_session_pro_1"
URL = f"{BASE_URL}/api/boats/main/crew/shopping"


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- unit: shopping_html grouping by aisle ----
class TestShoppingHtmlGroups:
    def test_groups_render_aisles(self):
        from crew import shopping_html, ShopAisle
        out = shopping_html(["Bread", "Apples"], [ShopAisle(aisle="Bakery", items=["Bread"]), ShopAisle(aisle="<Fresh>", items=["Apples", " "])])
        assert "aisle by aisle" in out
        assert "<b>Bakery</b>" in out and "&lt;Fresh&gt;" in out
        assert "<li>Bread</li>" in out and "<li>Apples</li>" in out and "<li> </li>" not in out

    def test_empty_groups_skipped_and_fallback(self):
        from crew import shopping_html, ShopAisle
        out = shopping_html(["Bread"], [ShopAisle(aisle="Empty", items=["  "]), ShopAisle(aisle="Bakery", items=["Bread"])])
        assert "Empty" not in out and "Bakery" in out
        flat = shopping_html(["Bread"], [])
        assert "Food to bring on board:" in flat and "<li>Bread</li>" in flat


# ---- POST /crew/shopping with groups ----
class TestSendShoppingGroups:
    def test_groups_200(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "name": "TEST Free Crew", "items": ["TEST_Bread"],
                                     "groups": [{"aisle": "Bakery", "items": ["TEST_Bread"]}]}, headers=h(PRO), timeout=40)
        if r.status_code == 429:
            pytest.skip("daily limit")
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

    def test_without_groups_still_200(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "items": ["TEST_Milk"]}, headers=h(PRO), timeout=40)
        if r.status_code == 429:
            pytest.skip("daily limit")
        assert r.status_code == 200, r.text

    def test_groups_stranger_404(self):
        r = requests.post(URL, json={"email": "stranger_xyz@example.com", "items": ["Milk"], "groups": [{"aisle": "Dairy", "items": ["Milk"]}]}, headers=h(PRO))
        assert r.status_code == 404

    def test_groups_aisle_too_long_422(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "items": ["Milk"], "groups": [{"aisle": "x" * 121, "items": ["Milk"]}]}, headers=h(PRO))
        assert r.status_code == 422

    def test_groups_bad_shape_422(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "items": ["Milk"], "groups": [{"items": ["Milk"]}]}, headers=h(PRO))
        assert r.status_code == 422

    def test_too_many_groups_422(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "items": ["Milk"], "groups": [{"aisle": f"A{i}", "items": ["Milk"]} for i in range(41)]}, headers=h(PRO))
        assert r.status_code == 422

    def test_empty_items_with_groups_422(self):
        r = requests.post(URL, json={"email": "test.user.free@example.com", "items": [], "groups": [{"aisle": "Bakery", "items": ["Bread"]}]}, headers=h(PRO))
        assert r.status_code == 422

    def test_unauth_401(self):
        r = requests.post(URL, json={"email": "a@b.com", "items": ["Milk"], "groups": []})
        assert r.status_code == 401


# ---- BoatDetails.trip_meal_plan field ----
class TestTripMealPlanField:
    def test_model_field(self):
        from server import BoatDetails
        assert BoatDetails().trip_meal_plan == ""
        assert BoatDetails(trip_meal_plan="tpl_x").trip_meal_plan == "tpl_x"
        with pytest.raises(Exception):
            BoatDetails(trip_meal_plan="x" * 81)

    def test_me_boat_returns_trip_meal_plan(self):
        r = requests.get(f"{BASE_URL}/api/me/boat", headers=h(PRO))
        assert r.status_code == 200
        assert "trip_meal_plan" in (r.json().get("boat") or {})
