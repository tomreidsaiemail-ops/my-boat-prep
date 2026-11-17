# Model Vessel "Topics Demo" template list: duplicate wizard/Finish lines must be saved (iteration 199)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for l in f:
            if l.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = l.split("=", 1)[1].strip().rstrip("/")
H = {"Authorization": "Bearer test_session_admin_1"}
NAME = "Admin - Model Vessel - Topics Demo"
LINES = [
    "myboatprep does provisioning and inventory, trip planning, boat maintenance, safety and multiple AI integrations.",
    "??Q1  What would you like to know about first?",
    "???provisioning and inventory, trip planning, boat maintenance, safety, AI integrations",
    "???IF Q1 provisioning and inventory then goto ##provisioning and inventory",
    "???IF Q1 trip planning then goto ##trip planning",
    "???IF Q1 boat maintenance then goto ##boat maintenance",
    "???IF Q1 safety then goto ##safety",
    "???IF Q1 AI integrations then goto ##AI integrations",
    "???goto ##finish",
    "##provisioning and inventory",
    "$$ Magic scan cupboards, boxes and folders.",
    "$$$ Magic Scanning",
    "???goto ##finish",
    "##trip planning",
    "$$ Planning a trip? Myboatprep allows you to prepare your boat",
    "$$$ Route Planning",
    "???goto ##finish",
    "##boat maintenance",
    "$$ Create the 6 boat maintenance lists",
    "$$$ Creating above deck hardware",
    "???goto ##finish",
    "##safety",
    "Mayday and pan-pans",
    "Grab bag check lists",
    "???goto ##finish",
    "##AI integrations",
    "These need internet connectivity",
    "medical - photo supplied medical diagnosis",
    "???goto ##finish",
    "##finish",
    "--Here are other topics",
    "$$ Planning a trip? Myboatprep allows you to prepare your boat",
    "$$$ Route Planning",
    "$$ Create the 6 boat maintenance lists",
    "$$$ Creating above deck hardware",
]


def _find():
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=H)
    assert r.status_code == 200
    data = r.json()
    lists = data if isinstance(data, list) else data.get("lists", data.get("items", []))
    return next((l for l in lists if l.get("name") == NAME), None)


@pytest.fixture(scope="module")
def topics():
    old = _find()
    if old:  # leftover from an earlier run of this same test
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{old['id']}", headers=H)
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=H, json={"name": NAME, "private": True, "items": LINES})
    assert r.status_code in (200, 201), r.text
    doc = r.json()
    yield doc
    if os.environ.get("KEEP_TOPICS") != "1":
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{doc['id']}", headers=H)


def test_create_keeps_all_lines(topics):
    labels = [i["label"] for i in topics["items"]]
    assert labels == LINES


def test_get_persists_duplicates(topics):
    got = _find()
    assert got is not None
    labels = [i["label"] for i in got["items"]]
    assert labels == LINES
    assert labels.count("$$$ Route Planning") == 2
    assert labels.count("$$$ Creating above deck hardware") == 2
    assert labels.count("???goto ##finish") == 6
    ids = [i["id"] for i in got["items"]]
    assert len(set(ids)) == len(ids)


def test_update_keeps_duplicates(topics):
    r = requests.put(f"{BASE_URL}/api/admin/template-lists/{topics['id']}", headers=H, json={"name": NAME, "description": "", "items": LINES, "private": True})
    assert r.status_code == 200, r.text
    labels = [i["label"] for i in _find()["items"]]
    assert labels == LINES


def test_plain_duplicates_still_dropped():
    from importlib import util
    import sys
    sys.path.insert(0, "/app/backend")
    try:
        import templates  # noqa
    except Exception as e:  # noqa
        pytest.skip(f"cannot import templates: {e}")
    out = templates._items_from_labels(["Salt", "salt", "$$ x", "$$ x", "???goto ##finish", "???goto ##finish"])
    assert [i["label"] for i in out] == ["Salt", "$$ x", "$$ x", "???goto ##finish", "???goto ##finish"]
