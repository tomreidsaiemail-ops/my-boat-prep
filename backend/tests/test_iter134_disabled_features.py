# Admin - disabled features: /api/me/features + gating of /api/ai/mpa/consumed
import os
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
NAME = "Admin - disabled features"
DEFAULT = [{"id": 1, "label": "Speak Button Feature; enabled for nobody"},
           {"id": 2, "label": "Sync Food & Drinks Cupboards Magically Feature; enabled for nobody"},
           {"id": 3, "label": "Charter Registrations Feature; enabled for nobody"}]
TOK = {"admin": "test_session_admin_1", "pro": "test_session_pro_1", "beta": "test_session_beta_1", "free": "test_session_free_1"}


def _db():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l and not l.startswith("#"))
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


def feats(who):
    r = requests.get(f"{BASE_URL}/api/me/features", headers={"Authorization": f"Bearer {TOK[who]}"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["disabled"]


def set_items(items):
    _db().list_templates.update_one({"custom": True, "name": NAME}, {"$set": {"items": items}})


class TestDisabledFeatures:
    @pytest.fixture(autouse=True, scope="class")
    def restore(self):
        yield
        set_items(DEFAULT)

    def test_seeded_once_private(self):
        d = _db()
        docs = list(d.list_templates.find({"custom": True, "name": NAME}, {"_id": 0}))
        assert len(docs) == 1 and docs[0]["private"] is True
        assert d.migrations.find_one({"_id": "disabled_features_list"})

    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/me/features", timeout=20).status_code == 401

    def test_defaults_all_disabled(self):
        set_items(DEFAULT)
        for w in TOK:
            assert feats(w) == ["charter", "speak", "sync_stores"], w

    def test_consumed_403_when_off(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", headers={"Authorization": f"Bearer {TOK['pro']}"},
                          json={"text": "ate milk", "stock": [{"name": "Milk", "qty": 2}]}, timeout=30)
        assert r.status_code == 403 and r.json()["detail"] == "This feature is switched off for now"

    def test_email_lists_case_insensitive(self):
        set_items([{"id": 1, "label": "Home Page Speak Button Feature; TEST.User.Pro@Example.com"},
                   {"id": 2, "label": "Food & Drinks Cupboards Magically Feature; test.user.pro@example.com, test.user.beta@example.com,tomreidsaiemail@gmail.com"}])
        assert feats("pro") == []
        assert feats("beta") == ["speak"]
        assert feats("admin") == ["speak"]
        assert feats("free") == ["speak", "sync_stores"]

    def test_consumed_not_403_when_on(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", headers={"Authorization": f"Bearer {TOK['pro']}"},
                          json={"text": "ate milk", "stock": [{"name": "Milk", "qty": 2}]}, timeout=90)
        print(r.status_code, r.text[:300])
        assert r.status_code != 403
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", headers={"Authorization": f"Bearer {TOK['free']}"},
                          json={"text": "ate milk", "stock": [{"name": "Milk", "qty": 2}]}, timeout=30)
        assert r.status_code == 403

    def test_delete_row_enables_for_all(self):
        set_items([DEFAULT[1]])
        assert feats("free") == ["sync_stores"]
        set_items([])
        for w in TOK:
            assert feats(w) == []

    def test_restore(self):
        set_items(DEFAULT)
        assert feats("pro") == ["charter", "speak", "sync_stores"]
