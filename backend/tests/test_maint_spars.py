# Iteration 96: Spars & Heavy Hardware maintenance list (6th list) - validation, migration of master attributes, real AI tailoring
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE = "test_session_pro_1", "test_session_free_1"
ALL6 = ["deckHardware", "sailLoft", "runningRigging", "standingRigging", "groundTackle", "sparsHardware"]
BOAT = {"make": "Beneteau", "model": "Oceanis 38", "boat_type": "Sloop", "units": "m", "currency": "NZD"}
SPAR_ATTRS = [
    {"key": "make", "name": "Make", "type": "char", "options": []},
    {"key": "model", "name": "Model", "type": "char", "options": []},
    {"key": "colour", "name": "Colour", "type": "char", "options": []},
    {"key": "weight", "name": "Weight", "type": "decimal weight", "options": []},
    {"key": "cost", "name": "Cost", "type": "decimal cost", "options": []},
    {"key": "diameter", "name": "Diameter", "type": "decimal length", "options": []},
    {"key": "length", "name": "Length", "type": "decimal length", "options": []},
    {"key": "spar_material", "name": "Spar material", "type": "picklist", "options": ["Aluminium", "Carbon fibre", "Wood", "Stainless steel", "Fibreglass", "Composite"]},
]
RR_ATTRS = [{"key": "diameter", "name": "Diameter", "type": "decimal length", "options": []},
            {"key": "length", "name": "Length", "type": "decimal length", "options": []},
            {"key": "cost", "name": "Cost", "type": "decimal cost", "options": []}]


def sess(tok):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


def launch_free():
    return requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {FREE}"}).json().get("launch_free")


# Validation
class TestValidation:
    def test_seven_lists_422(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/maint-lists", json={**BOAT, "lists": ALL6 + ["sailLoft"]})
        assert r.status_code == 422

    def test_unknown_only_422(self):
        r = sess(PRO).post(f"{BASE_URL}/api/ai/maint-lists", json={**BOAT, "lists": ["bogus", "spars"]})
        assert r.status_code == 422

    def test_free_403(self):
        if launch_free():
            pytest.skip("launch free promo")
        r = sess(FREE).post(f"{BASE_URL}/api/ai/maint-lists", json={**BOAT, "lists": ["sparsHardware"]})
        assert r.status_code == 403

    def test_no_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/ai/maint-lists", json={**BOAT, "lists": ["sparsHardware"]})
        assert r.status_code == 401


# Migration of master attribute lists
class TestMigration:
    def test_master_lists(self):
        r = sess(PRO).get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - master"})
        assert r.status_code == 200
        names = {l["name"]: [i["label"] for i in l["items"]] for l in r.json()["lists"]}
        attrs, types = names["Admin - master attributes"], names["Admin - master attribute types"]
        for n in ("Age", "Diameter", "Length"):
            line = next(a for a in attrs if a.split("|")[0].strip() == n)
            assert "Spars & Heavy Hardware" in line, line
        assert sum(1 for a in attrs if a.lower().startswith("spar material")) == 1
        assert any(a.replace(" ", "") == "Sparmaterial|sparmaterialtypes|Spars&HeavyHardware" for a in attrs)
        t = [x for x in types if x.lower().startswith("spar material types")]
        assert len(t) == 1 and "Aluminium" in t[0] and "Carbon fibre" in t[0]


# Real AI call (one Magic use, two lists in parallel)
class TestTailoredSpars:
    def test_spars_and_running(self):
        s = sess(PRO)
        before = s.get(f"{BASE_URL}/api/auth/me").json()
        body = {**BOAT, "lists": ["sparsHardware", "runningRigging"], "attrs": {"sparsHardware": SPAR_ATTRS, "runningRigging": RR_ATTRS}}
        r = s.post(f"{BASE_URL}/api/ai/maint-lists", json=body, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        print("asks_left", d.get("asks_left"), "before", {k: before.get(k) for k in before if "ask" in k or "magic" in k})
        assert "sparsHardware" in d["lists"], list(d["lists"])
        assert "runningRigging" in d["lists"]
        labels = " | ".join(i["label"].lower() for g in d["lists"]["sparsHardware"] for i in g["items"])
        print("SPARS:", labels)
        for word in ("mast", "boom", "vang", "spinnaker pole", "bowsprit"):
            assert word in labels or (word == "vang" and "kicker" in labels), f"{word} missing: {labels}"
        items = [i for g in d["lists"]["sparsHardware"] for i in g["items"]]
        keys = {k for i in items for k in i["attrs"]}
        print("SPAR attr keys:", keys)
        for k in ("make", "weight", "cost", "length", "diameter"):
            assert k in keys, k
        for i in items:
            for k in ("weight", "cost", "length", "diameter"):
                if k in i["attrs"]:
                    assert isinstance(i["attrs"][k], str) and float(i["attrs"][k]) > 0
            if "spar_material" in i["attrs"]:
                assert i["attrs"]["spar_material"] in SPAR_ATTRS[-1]["options"]
            assert set(i["attrs"]) <= {a["key"] for a in SPAR_ATTRS}
        mast = next(i for i in items if i["label"].lower().startswith("mast") or i["label"].lower() == "main mast")
        print("MAST:", mast)
        assert "cost" in mast["attrs"] and "weight" in mast["attrs"]
        rr = [i for g in d["lists"]["runningRigging"] for i in g["items"]]
        assert any("diameter" in i["attrs"] for i in rr), rr[:3]
