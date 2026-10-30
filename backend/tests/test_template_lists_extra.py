# Extra coverage for admin template lists: validation, auth, ordering, update semantics
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN, FREE, PRO = "test_session_admin_1", "test_session_free_1", "test_session_pro_1"


def s(tok=None):
    ss = requests.Session()
    if tok:
        ss.cookies.set("session_token", tok)
    return ss


@pytest.fixture
def created():
    ids = []
    yield ids
    a = s(ADMIN)
    for i in ids:
        a.delete(f"{BASE_URL}/api/admin/template-lists/{i}")


def mk(name, items, ids):
    r = s(ADMIN).post(f"{BASE_URL}/api/admin/template-lists", json={"name": name, "items": items})
    assert r.status_code == 200, r.text
    ids.append(r.json()["id"])
    return r.json()


@pytest.mark.parametrize("name", ["My To Do List", "boat inventory", "FAQ", "  Leaving Dock  ", "Mayday", "Ship's Log", "Skipper's Tips"])
def test_reserved_names_rejected(name):
    r = s(ADMIN).post(f"{BASE_URL}/api/admin/template-lists", json={"name": name, "items": ["x"]})
    assert r.status_code == 400 and "already exists" in r.json()["detail"]


def test_validation_errors():
    a = s(ADMIN)
    assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_noitems", "items": []}).status_code == 400
    assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "   ", "items": ["x"]}).status_code == 400
    assert a.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "T" * 61, "items": ["x"]}).status_code == 422


def test_create_trims_dedupes_ids(created):
    t = mk("  TEST_Trim  ", ["  A ", "a", "B", "", "  ", "b", "C"], created)
    assert t["name"] == "TEST_Trim"
    assert [(i["id"], i["label"]) for i in t["items"]] == [(1, "A"), (2, "B"), (3, "C")]
    assert t["id"].startswith("tpl_") and len(t["id"]) == 14


def test_auth_guards(created):
    t = mk("TEST_Guard", ["x"], created)
    for tok in (FREE, PRO):
        c = s(tok)
        assert c.get(f"{BASE_URL}/api/admin/template-lists").status_code == 403
        assert c.put(f"{BASE_URL}/api/admin/template-lists/{t['id']}", json={"name": "TEST_h", "items": ["y"]}).status_code == 403
        assert c.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}").status_code == 403
    assert s().get(f"{BASE_URL}/api/admin/template-lists").status_code == 401
    assert s().get(f"{BASE_URL}/api/templates").status_code == 401


def test_list_sorted_and_templates_shape(created):
    t1 = mk("TEST_Sort1", ["a"], created)
    time.sleep(0.05)
    t2 = mk("TEST_Sort2", ["b"], created)
    lst = s(ADMIN).get(f"{BASE_URL}/api/admin/template-lists").json()
    ids = [x["id"] for x in lst]
    assert ids.index(t1["id"]) < ids.index(t2["id"])
    assert set(lst[0].keys()) == {"id", "name", "description", "items", "private", "created_at", "updated_at"}
    tpls = s(PRO).get(f"{BASE_URL}/api/templates").json()["templates"]
    g = tpls[t1["id"]]
    assert g["custom"] is True and g["name"] == "TEST_Sort1" and g["created_at"] == t1["created_at"] and g["items"] == t1["items"]
    for k, v in tpls.items():
        if not k.startswith("tpl_"):
            assert "custom" not in v and "name" not in v


def test_update_semantics(created):
    t = mk("TEST_Upd", ["One", "Two"], created)
    a = s(ADMIN)
    r = a.put(f"{BASE_URL}/api/admin/template-lists/{t['id']}", json={"name": "TEST_Upd renamed", "items": ["One", "Two"]})
    assert r.status_code == 200 and r.json()["name"] == "TEST_Upd renamed" and r.json()["updated_at"] == t["updated_at"]
    r = a.put(f"{BASE_URL}/api/admin/template-lists/{t['id']}", json={"name": "test_upd RENAMED", "items": ["two", "Three"]})
    u = r.json()
    assert r.status_code == 200 and u["updated_at"] > t["updated_at"]
    assert [(i["id"], i["label"]) for i in u["items"]] == [(2, "two"), (3, "Three")]
    other = mk("TEST_Other", ["z"], created)
    assert a.put(f"{BASE_URL}/api/admin/template-lists/{other['id']}", json={"name": "TEST_UPD renamed", "items": ["z"]}).status_code == 400
    assert a.put(f"{BASE_URL}/api/admin/template-lists/{other['id']}", json={"name": "Safety", "items": ["z"]}).status_code == 400
    assert a.put(f"{BASE_URL}/api/admin/template-lists/{other['id']}", json={"name": "TEST_Other", "items": [" "]}).status_code == 400
    assert a.put(f"{BASE_URL}/api/admin/template-lists/tpl_nope", json={"name": "TEST_x", "items": ["z"]}).status_code == 404
    got = a.get(f"{BASE_URL}/api/admin/template-lists").json()
    assert next(x for x in got if x["id"] == t["id"])["name"] == "test_upd RENAMED"


def test_publish_bar_custom_and_unknown(created):
    t = mk("TEST_Pub", ["a"], created)
    a = s(ADMIN)
    r = a.put(f"{BASE_URL}/api/admin/templates/{t['id']}", json={"items": [{"id": 1, "label": "a"}, {"id": 5, "label": "new"}]})
    assert r.status_code == 200
    g = s(FREE).get(f"{BASE_URL}/api/templates").json()["templates"][t["id"]]
    assert [i["label"] for i in g["items"]] == ["a", "new"] and g["custom"] and g["name"] == "TEST_Pub"
    assert a.put(f"{BASE_URL}/api/admin/templates/tpl_unknown", json={"items": [{"id": 1, "label": "a"}]}).status_code == 404
    assert a.put(f"{BASE_URL}/api/admin/templates/{t['id']}", json={"items": [{"id": 1, "label": "a", "dynamic": "maydayGps"}]}).status_code == 400
    assert a.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}").status_code == 200
    assert a.delete(f"{BASE_URL}/api/admin/template-lists/{t['id']}").status_code == 404
    created.remove(t["id"])
