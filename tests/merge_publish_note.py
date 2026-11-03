# Helper: publish a riggingChecks master variant with a "why this changed" note. Usage: python merge_publish_note.py A|B|C "note"
import sys
import requests
sys.argv = sys.argv[:2] + sys.argv[3:] if len(sys.argv) > 2 else sys.argv
NOTE = __import__("os").environ.get("NOTE", "")
exec(open("/app/tests/merge_publish.py").read().split("r = requests.put")[0])
r = requests.put(f"{BASE}/api/admin/templates/{lid}", cookies={"session_token": "test_session_admin_1"},
                 json={"items": [{"id": 200 + i, "label": l} for i, l in enumerate(labels)], "note": NOTE})
print(r.status_code, r.json().get("updated_at"), r.json().get("note"), len(labels))
