# Model Vessel ideas panels (iteration 200): Finish-style lines under a ##place are not Finish panel lines; server step index ignores them
import os
import sys
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
LINES = """myboatprep does provisioning and inventory, trip planning, boat maintenance, safety and multiple AI integrations involving medical, engine, meal preparation, sundowners and fishing.
??Q1  What would you like to know about first?
???provisioning and inventory, trip planning, boat maintenance, safety, AI integrations
???IF Q1 provisioning and inventory then goto ##provisioning and inventory
???IF Q1 trip planning then goto ##trip planning
???IF Q1 boat maintenance then goto ##boat maintenance
???IF Q1 safety then goto ##safety
???IF Q1 AI integrations then goto ##AI integrations
???goto ##finish
##provisioning and inventory
$$ Magic scan cupboards, boxes and folders.
$$$ Magic Scanning
$$ Familiar with Magic Scanning now?  Try Batch Magic Scanning, where you can photo your saloon cupboards and boxes in a morning.
$$$ Batch Magic Scanning
???goto ##finish
##trip planning
$$ Planning a trip? Myboatprep allows you to prepare your boat and your crew for what lies ahead
$$$ Route Planning
$$ Ready to make your crew safer with prep-to-deck? Click Crew Safety Briefings
$$$ Crew Safety Briefings
???goto ##finish
##boat maintenance
$$ Create the 6 boat maintenance lists, and see how they are categorized along side engine and electrical servicing
$$$ Creating above deck hardware
???goto ##finish
##safety
Mayday and pan-pans
Grab bag check lists
???goto ##finish
##AI integrations
These need internet connectivity
???goto ##finish
##finish
--Here are other topics
$$ Planning a trip? Myboatprep allows you to prepare your boat and your crew for what lies ahead
$$$ Route Planning
$$ Ready to make your crew safer with prep-to-deck? Click Crew Safety Briefings
$$$ Crew Safety Briefings
$$ Would you like to see how you can make crew safer? Click below
$$$ Crew Registration and Invites...
$$ Create the 6 boat maintenance lists, and see how they are categorized along side engine and electrical servicing
$$$ Creating above deck hardware""".split("\n")
FINISH9 = LINES[-9:]


def _find():
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=H)
    assert r.status_code == 200
    data = r.json()
    lists = data if isinstance(data, list) else data.get("lists", data.get("items", []))
    return next((l for l in lists if l.get("name") == NAME), None)


@pytest.fixture(scope="module")
def topics():
    old = _find()
    if old:
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{old['id']}", headers=H)
    r = requests.post(f"{BASE_URL}/api/admin/template-lists", headers=H, json={"name": NAME, "private": True, "items": LINES})
    assert r.status_code in (200, 201), r.text
    doc = r.json()
    yield doc
    if os.environ.get("KEEP_TOPICS") != "1":
        requests.delete(f"{BASE_URL}/api/admin/template-lists/{doc['id']}", headers=H)


def _fb():
    sys.path.insert(0, "/app/backend")
    try:
        import wizard_progress
    except Exception as e:  # noqa
        pytest.skip(f"cannot import wizard_progress: {e}")
    return wizard_progress._finish_block


# _finish_block unit: only ##finish lines
def test_finish_block_only_finish_section():
    block = _fb()(LINES)
    assert [t for t, b in zip(LINES, block) if b] == FINISH9


# bottom run under a non-finish place stays Finish
def test_finish_block_bottom_run_in_section():
    lines = ["Step a", "##safety", "Step b", "$$ idea mid", "Step c", "???IF Q1 yes", "$$ bottom idea", "$$$ Bottom link"]
    block = _fb()(lines)
    assert [t for t, b in zip(lines, block) if b] == ["???IF Q1 yes", "$$ bottom idea", "$$$ Bottom link"]


def test_create_all_lines(topics):
    assert [i["label"] for i in topics["items"]] == LINES


# Edit Step index: 0 intro, 1 ??Q1, 2 Mayday, 3 Grab bag, 4 These need
def test_edit_step_mayday_and_revert(topics):
    r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=H, json={"wizard": "Topics Demo", "step": 2, "expect": "Mayday and pan-pans", "text": "Mayday and pan-pans!"})
    assert r.status_code == 200, r.text
    assert "Mayday and pan-pans!" in r.json()["lines"]
    r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=H, json={"wizard": "Topics Demo", "step": 2, "expect": "Mayday and pan-pans!", "text": "Mayday and pan-pans"})
    assert r.status_code == 200, r.text
    assert [i["label"] for i in _find()["items"]] == LINES


def test_edit_step_wrong_expect_409(topics):
    r = requests.post(f"{BASE_URL}/api/admin/wizard-step", headers=H, json={"wizard": "Topics Demo", "step": 2, "expect": "Grab bag check lists", "text": "x"})
    assert r.status_code == 409


# Edit Final: expect = the 9 ##finish lines; old section ideas untouched
def test_edit_final_roundtrip(topics):
    new = FINISH9 + ["--TEST_extra"]
    r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=H, json={"wizard": "Topics Demo", "expect": FINISH9, "lines": new})
    assert r.status_code == 200, r.text
    labels = r.json()["lines"]
    assert labels[:-10] == LINES[:-9] and labels[-10:] == new
    r = requests.post(f"{BASE_URL}/api/admin/wizard-finish", headers=H, json={"wizard": "Topics Demo", "expect": new, "lines": FINISH9})
    assert r.status_code == 200, r.text
    assert [i["label"] for i in _find()["items"]] == LINES
