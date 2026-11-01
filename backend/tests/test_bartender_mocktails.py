# Magic Bartender mocktails: children>0 adds up to 3 mocktail:true items (youtube 'mocktail'); children=0 none; parse_cocktails unit
import os
import sys
import pytest
import requests
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}
ING = ["Vodka", "White rum", "Limes", "Fresh mint", "Ginger beer", "Soda water", "Cola", "Lemons", "Orange juice", "Pineapple juice", "Grenadine"]


def _q(url):
    u = urlparse(url)
    assert u.netloc == "www.youtube.com" and u.path == "/results"
    return parse_qs(u.query)["search_query"][0].lower()


# --- unit: parse_cocktails caps and mocktail flag ---
def test_parse_cocktails_caps_unit():
    sys.path.insert(0, "/app/backend")
    import json
    from bartender import parse_cocktails, youtube_search
    cs = [{"name": f"C{i}", "uses": ["x"], "missing": [], "mocktail": False} for i in range(15)]
    ms = [{"name": f"M{i}", "uses": ["x"], "missing": [], "mocktail": True} for i in range(5)]
    bad = [{"name": "Str", "mocktail": "true"}, {"name": "TooMany", "missing": ["a", "b", "c"], "mocktail": True}]
    out = parse_cocktails(json.dumps({"cocktails": cs + ms + bad}))
    assert len([c for c in out if not c["mocktail"]]) == 12
    assert len([c for c in out if c["mocktail"]]) == 3
    assert all(c["name"] != "TooMany" for c in out)
    assert "mocktail" in youtube_search("Virgin Mojito", True) and "cocktail" in youtube_search("Mojito")


# --- real AI with kids ---
def test_bartender_children_adds_mocktails():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ING, "children": 1}, headers=PRO, timeout=150)
    assert r.status_code == 200, r.text
    cs = r.json()["cocktails"]
    mocks = [c for c in cs if c["mocktail"] is True]
    drinks = [c for c in cs if c["mocktail"] is False]
    print("drinks:", [c["name"] for c in drinks], "mocks:", [c["name"] for c in mocks])
    assert 1 <= len(mocks) <= 3
    assert len(drinks) <= 12
    for m in mocks:
        assert "mocktail" in _q(m["youtube"])
    for d in drinks:
        assert "cocktail" in _q(d["youtube"]) and "mocktail" not in _q(d["youtube"])
    # mocktails come after cocktails
    assert cs[-len(mocks):] == mocks


def test_bartender_no_children_no_mocktails():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ING, "children": 0}, headers=PRO, timeout=150)
    assert r.status_code == 200, r.text
    cs = r.json()["cocktails"]
    assert all(c["mocktail"] is False for c in cs), [(c["name"], c["uses"], c["youtube"]) for c in cs if c["mocktail"]]


def test_bartender_children_negative_422():
    r = requests.post(f"{BASE_URL}/api/ai/bartender", json={"ingredients": ["Vodka"], "children": -1}, headers=PRO)
    assert r.status_code == 422
