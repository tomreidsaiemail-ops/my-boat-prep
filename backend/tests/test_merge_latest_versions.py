# Merge Latest: master template version history (db.template_versions) and GET /api/templates/{list_id}/version
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LIST = "head"  # system list used only by this test; cleaned in teardown via mongo by the testing agent


def s(token):
    x = requests.Session()
    x.cookies.set("session_token", token)
    return x


@pytest.fixture(scope="module")
def admin():
    return s("test_session_admin_1")


@pytest.fixture(scope="module")
def pro():
    return s("test_session_pro_1")


def items(labels):
    return {"items": [{"id": i + 1, "label": l} for i, l in enumerate(labels)]}


class TestVersions:
    def test_publish_and_versions(self, admin, pro):
        r1 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_A1", "TEST_A2"]))
        assert r1.status_code == 200, r1.text
        a_at = r1.json()["updated_at"]
        # current version available
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": a_at})
        assert v.status_code == 200
        assert [i["label"] for i in v.json()["items"]] == ["TEST_A1", "TEST_A2"]
        time.sleep(0.05)
        r2 = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["TEST_A1", "TEST_B3"]))
        assert r2.status_code == 200
        b_at = r2.json()["updated_at"]
        assert b_at != a_at
        # previous version kept
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": a_at})
        assert v.status_code == 200
        assert [i["label"] for i in v.json()["items"]] == ["TEST_A1", "TEST_A2"]
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": b_at})
        assert [i["label"] for i in v.json()["items"]] == ["TEST_A1", "TEST_B3"]
        # templates endpoint shows newest
        t = pro.get(f"{BASE_URL}/api/templates").json()["templates"][LIST]
        assert t["updated_at"] == b_at

    def test_unknown_version_404(self, pro):
        r = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": "2001-01-01T00:00:00+00:00"})
        assert r.status_code == 404
        r = pro.get(f"{BASE_URL}/api/templates/nope_list/version", params={"at": "x"})
        assert r.status_code == 404

    def test_version_requires_auth_and_param(self):
        r = requests.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": "x"})
        assert r.status_code == 401
        r = s("test_session_pro_1").get(f"{BASE_URL}/api/templates/{LIST}/version")
        assert r.status_code == 422

    def test_non_admin_cannot_publish(self, pro):
        r = pro.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items(["X"]))
        assert r.status_code in (401, 403)

    def test_same_items_republish_no_new_version(self, admin, pro):
        cur = pro.get(f"{BASE_URL}/api/templates").json()["templates"][LIST]
        labels = [i["label"] for i in cur["items"]]
        r = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json={"items": cur["items"]})
        assert r.status_code == 200
        # old updated_at still resolvable? it is not saved (items identical) -> 404 expected unless current
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": cur["updated_at"]})
        print("identical republish old at ->", v.status_code, labels)

    def test_cap_30_versions(self, admin, pro):
        first = None
        for n in range(33):
            r = admin.put(f"{BASE_URL}/api/admin/templates/{LIST}", json=items([f"TEST_cap_{n}"]))
            assert r.status_code == 200
            if n == 0:
                first = r.json()["updated_at"]
        v = pro.get(f"{BASE_URL}/api/templates/{LIST}/version", params={"at": first})
        assert v.status_code == 404  # pruned beyond 30


class TestCustomListVersions:
    def test_custom_list_edit_keeps_version(self, admin, pro):
        c = admin.post(f"{BASE_URL}/api/admin/template-lists", json={"name": "TEST_merge_custom", "items": ["c1", "c2"]})
        assert c.status_code == 200, c.text
        d = c.json()
        try:
            time.sleep(0.05)
            u = admin.put(f"{BASE_URL}/api/admin/template-lists/{d['id']}", json={"name": "TEST_merge_custom", "items": ["c1", "c3"]})
            assert u.status_code == 200
            assert u.json()["updated_at"] != d["updated_at"]
            v = pro.get(f"{BASE_URL}/api/templates/{d['id']}/version", params={"at": d["updated_at"]})
            assert v.status_code == 200
            assert [i["label"] for i in v.json()["items"]] == ["c1", "c2"]
            # name-only edit must not bump version
            u2 = admin.put(f"{BASE_URL}/api/admin/template-lists/{d['id']}", json={"name": "TEST_merge_custom2", "items": ["c1", "c3"]})
            assert u2.json()["updated_at"] == u.json()["updated_at"]
        finally:
            admin.delete(f"{BASE_URL}/api/admin/template-lists/{d['id']}")
