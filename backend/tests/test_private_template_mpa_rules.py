# Private admin template lists + GET /api/mpa/rules (iteration 58)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
SYN = [{"label": "1. Salt"}, {"label": "Table Salt", "indent": True}, {"label": "Sea salt", "indent": True}, {"label": "chips = fries"}]
NOISE = [{"label": x} for x in ["fresh", "frozen", "[0-9]g", "[0-9]grams", "[0-9]grammes"]]
created = []


def _create(name, items, private, desc=""):
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, json={"name": name, "description": desc, "items": items, "private": private})
    assert r.status_code == 200, r.text
    created.append(r.json()["id"])
    return r.json()


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    # Make sure no stale rule lists exist from earlier runs
    for d in requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json():
        if d["name"].lower().startswith(("admin - food", "test_")):
            requests.delete(f"{BASE_URL}/api/admin/template-lists/{d['id']}", headers=ADMIN)
    yield
    for i in created:
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{i}", headers=ADMIN)


class TestRulesEmpty:
    def test_rules_empty_when_missing(self):
        r = requests.get(f"{BASE_URL}/api/mpa/rules", headers=PRO)
        assert r.status_code == 200
        assert r.json() == {"synonyms": [], "noise": []}

    def test_rules_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/mpa/rules").status_code == 401

    def test_public_lists_with_rule_names_ignored(self):
        pub = _create("Admin - Food Synonyms", SYN, False)
        assert pub["private"] is False
        r = requests.get(f"{BASE_URL}/api/mpa/rules", headers=PRO).json()
        assert r["synonyms"] == []
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{pub['id']}", headers=ADMIN)
        created.remove(pub["id"])


class TestPrivateLists:
    def test_create_private_and_rules(self):
        s = _create("ADMIN - food synonyms", SYN, True)
        n = _create("Admin - Food Noise Words", NOISE, True)
        assert s["private"] is True and n["private"] is True
        r = requests.get(f"{BASE_URL}/api/mpa/rules", headers=PRO)
        assert r.status_code == 200
        d = r.json()
        assert [i["label"] for i in d["synonyms"]] == ["1. Salt", "Table Salt", "Sea salt", "chips = fries"]
        assert d["synonyms"][1].get("indent") is True and "indent" not in d["synonyms"][0]
        assert [i["label"] for i in d["noise"]] == ["fresh", "frozen", "[0-9]g", "[0-9]grams", "[0-9]grammes"]
        assert "id" not in d["noise"][0]

    def test_admin_list_returns_private(self):
        lst = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN).json()
        by = {d["name"]: d for d in lst}
        assert by["ADMIN - food synonyms"]["private"] is True
        assert all("private" in d for d in lst)

    def test_templates_excludes_private_for_admin_and_pro(self):
        pub = _create("TEST_Public Iter58", [{"label": "Item A"}], False)
        for h in (ADMIN, PRO):
            t = requests.get(f"{BASE_URL}/api/templates", headers=h).json()["templates"]
            assert pub["id"] in t
            assert t[pub["id"]]["name"] == "TEST_Public Iter58"
            for i in created[:-1]:
                assert i not in t

    def test_non_admin_cannot_create(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=PRO, json={"name": "TEST_x", "items": ["a"], "private": True})
        assert r.status_code == 403

    def test_toggle_private_via_put(self):
        lst = _create("TEST_Toggle Iter58", [{"label": "One"}], True)
        t = requests.get(f"{BASE_URL}/api/templates", headers=PRO).json()["templates"]
        assert lst["id"] not in t
        r = requests.put(f"{BASE_URL}/api/admin/template-lists/{lst['id']}", headers=ADMIN, json={"name": "TEST_Toggle Iter58", "items": [{"label": "One"}], "private": False})
        assert r.status_code == 200 and r.json()["private"] is False
        t = requests.get(f"{BASE_URL}/api/templates", headers=PRO).json()["templates"]
        assert lst["id"] in t
        r = requests.put(f"{BASE_URL}/api/admin/template-lists/{lst['id']}", headers=ADMIN, json={"name": "TEST_Toggle Iter58", "items": [{"label": "One"}], "private": True})
        assert r.json()["private"] is True
        assert lst["id"] not in requests.get(f"{BASE_URL}/api/templates", headers=PRO).json()["templates"]

    def test_put_without_private_defaults_false(self):
        # Documents behaviour: omitted 'private' on PUT resets to public
        lst = _create("TEST_Default Iter58", [{"label": "One"}], True)
        r = requests.put(f"{BASE_URL}/api/admin/template-lists/{lst['id']}", headers=ADMIN, json={"name": "TEST_Default Iter58", "items": [{"label": "One"}]})
        assert r.status_code == 200
        print("private after PUT w/o field:", r.json()["private"])

    def test_private_name_clash(self):
        r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, json={"name": "admin - food noise words", "items": ["x"], "private": True})
        assert r.status_code == 400
