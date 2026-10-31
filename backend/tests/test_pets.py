# Tests: pets on board (BoatDetails.pets persistence), MPA provisions with pets, ship log pet wording
import os
import sys
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
BOAT_ID = "TEST_bt_pets"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
REAL_AI = os.environ.get("PETS_REAL_AI") == "1"

PETS = [{"id": "pet_a", "type": "Dog", "name": "Biscuit", "breed": "Labrador", "weight": "28.5"},
        {"id": "pet_b", "type": "Cat", "name": "Mog", "breed": "", "weight": "4"}]


def _put(boat):
    state = {"boat": {"vessel": "TEST Vessel", **boat}, "registry": [{"id": "myTodo", "name": "My To Do List", "isSystem": True}],
             "data": {"myTodo": []}, "updated_at": datetime.now(timezone.utc).isoformat()}
    return requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=state)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    requests.delete(f"{BASE_URL}/api/me/boats/{BOAT_ID}", cookies=PRO)


# Boat pets persistence
class TestPetsPersist:
    def test_put_get_pets(self):
        r = _put({"pets": PETS, "units": "m"})
        assert r.status_code == 200, r.text
        b = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO).json()["boat"]
        assert [p["name"] for p in b["pets"]] == ["Biscuit", "Mog"]
        assert b["pets"][0]["weight"] == "28.5" and b["pets"][0]["breed"] == "Labrador" and b["pets"][1]["type"] == "Cat"

    def test_too_many_pets_422(self):
        r = _put({"pets": [{"type": "Fish", "name": f"F{i}"} for i in range(21)]})
        assert r.status_code == 422

    def test_weight_too_long_422(self):
        r = _put({"pets": [{"type": "Dog", "name": "X", "weight": "123456789"}]})
        assert r.status_code == 422


# MPA provisions validation
class TestProvisionsValidation:
    def test_no_items_no_pets_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/provisions", cookies=PRO, json={"items": [], "adults": 2, "children": 0, "days": 3})
        assert r.status_code == 422

    def test_blank_pets_only_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/provisions", cookies=PRO,
                          json={"items": [], "adults": 2, "children": 0, "days": 3, "pets": [{"type": " ", "name": ""}]})
        assert r.status_code == 422

    def test_bad_units_422(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/provisions", cookies=PRO,
                          json={"items": [], "adults": 2, "children": 0, "days": 3, "pets": PETS, "units": "st"})
        assert r.status_code == 422

    @pytest.mark.skipif(not REAL_AI, reason="real LLM call only with PETS_REAL_AI=1")
    def test_real_items_and_pets(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/provisions", cookies=PRO, timeout=120,
                          json={"items": ["Drinking water"], "adults": 2, "children": 0, "days": 5, "pets": PETS, "units": "kg"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d) == {"amounts", "pets", "drafts_left"}
        assert "Drinking water" in d["amounts"]
        assert d["pets"] and {p["for"] for p in d["pets"]} <= {"Biscuit", "Mog"}
        print(d)


# Unit: parse_provisions + ship log wording
class TestUnits:
    def test_parse_pets(self):
        from ai_lists import parse_provisions
        out = parse_provisions('x {"items": [{"name": "rice", "amount": "2 kg"}], "pets": [{"name": "Dry dog food", "amount": "3 kg", "for": "biscuit"}]}', ["Rice"], ["Biscuit"])
        assert out == {"amounts": {"Rice": "2 kg"}, "pets": [{"name": "Dry dog food", "amount": "3 kg", "for": "Biscuit"}]}

    def test_parse_no_pets_unchanged(self):
        from ai_lists import parse_provisions
        out = parse_provisions('{"items": [{"name": "Rice", "amount": "2 kg"}]}', ["Rice"], [])
        assert out == {"amounts": {"Rice": "2 kg"}, "pets": []}

    def test_parse_pets_missing_raises(self):
        from ai_lists import parse_provisions
        with pytest.raises(ValueError):
            parse_provisions('{"items": []}', [], ["Biscuit"])

    def test_pob_words(self):
        from ship_log import _pob_words
        assert _pob_words({"pob": 3, "pets": PETS}) == "3 persons on board POB. Also 2 pets on board: a dog and a cat."
        assert _pob_words({"pob": 3}) == "3 persons on board POB."
        assert _pob_words({"pob": 3, "children": 1, "pets": PETS[:1]}) == "3 persons on board POB, 2 adults and 1 child. Also 1 pet on board: a dog."
        assert _pob_words({"pob": 2, "pets": [{"type": "Iguana", "name": "Iggy"}]}).endswith("an iguana.")
