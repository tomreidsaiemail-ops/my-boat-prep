# Helper: publish a master version of riggingChecks. Usage: python merge_publish.py A|B|C
import sys, json, requests
BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0]
D = ["Shrouds and stays: no broken strands or kinks", "Bottlescrews pinned and taped", "Chainplates: no cracks or rust stains", "Forestay and furler: foil, drum and swivel turning freely", "Backstay and adjuster", "Spreaders and spreader ends taped", "Mast step and mast collar", "Masthead: wind instruments, lights and VHF aerial (check with binoculars)", "Halyards: no chafe, sheaves turning freely", "Sheets and running rigging: no chafe", "Shackles moused or seized", "Boom gooseneck and vang", "Mainsheet blocks and traveller", "Reefing lines run freely", "Lifelines, stanchions and pulpits secure"]
v = sys.argv[1]
labels = list(D)
if v in ("B", "C"):
    labels.insert(3, "TEST_master new B1")
    labels.append("TEST_master new B2")
    labels.remove("Mast step and mast collar")  # master removes one (user didn't delete this one)
if v == "C":
    labels.insert(1, "TEST_master new C1")
    labels.remove("Boom gooseneck and vang")
lid = sys.argv[2] if len(sys.argv) > 2 else "riggingChecks"
r = requests.put(f"{BASE}/api/admin/templates/{lid}", cookies={"session_token": "test_session_admin_1"},
                 json={"items": [{"id": 200 + i, "label": l} for i, l in enumerate(labels)]})
print(r.status_code, r.json()["updated_at"], len(labels))
