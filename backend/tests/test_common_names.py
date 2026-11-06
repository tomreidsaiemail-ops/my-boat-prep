# Admin lists: "Admin - Common <Zone> Names" prefix (Galley area name pick list)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}


def get(prefix, h=PRO):
    return requests.get(f"{BASE_URL}/api/admin-lists", params={"prefix": prefix}, headers=h, timeout=20)


def test_common_prefix_returns_galley_list():
    r = get("Admin - Common")
    assert r.status_code == 200
    lists = r.json()["lists"]
    names = [l["name"] for l in lists]
    galley = [l for l in lists if l["name"].lower() == "admin - common galley names"]
    assert len(galley) == 1, names
    labels = [i["label"] for i in galley[0]["items"]]
    for want in ["Counter Top", "Fridge", "Freezer", "Larder", "Dry Foods Store", "Hanging Basket", "Bilge Storage",
                 "Spice Rack", "Root locker", "Provisioning Bin"]:  # admin DB list has no "Provisioning Bin 2"
        assert any(want.lower() == l.lower() for l in labels), (want, labels)
    assert all(l["name"].lower().startswith("admin - common ") for l in lists)


@pytest.mark.parametrize("prefix", ["admin - common", "  Admin   -  Common  "])
def test_common_prefix_case_whitespace(prefix):
    r = get(prefix)
    assert r.status_code == 200
    assert any(l["name"].lower() == "admin - common galley names" for l in r.json()["lists"])


@pytest.mark.parametrize("prefix", ["Admin - Help Panel -", "Admin - List Template -", "Admin - Boat Budget", "Admin - Master"])
def test_other_prefixes_still_work(prefix):
    r = get(prefix)
    assert r.status_code == 200
    assert isinstance(r.json()["lists"], list)


def test_unknown_prefix_400():
    r = get("Admin - Bogus")
    assert r.status_code == 400


def test_requires_auth():
    r = get("Admin - Common", h={})
    assert r.status_code == 401


def test_single_galley_list_no_duplicate_seed():
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers={"Authorization": "Bearer test_session_admin_1"}, timeout=20)
    assert r.status_code == 200
    n = [d for d in r.json() if " ".join(d["name"].lower().split()) == "admin - common galley names"]
    assert len(n) == 1
