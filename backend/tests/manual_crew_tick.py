# Crew ticks an item via API (used by UI poll test): python manual_crew_tick.py <list> <item_id> <true|false>
import sys
from datetime import datetime, timezone
import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
F = requests.Session(); F.cookies.set("session_token", "test_session_free_1")
p = {"boat_id": "main", "owner": "test-admin-1"}
d = F.get(f"{BASE}/api/me/boat", params=p).json()
now = datetime.now(timezone.utc).isoformat()
lid, iid, val = sys.argv[1], int(sys.argv[2]), sys.argv[3] == "true"
for it in d["data"][lid]:
    if it["id"] == iid:
        it["checked"], it["ts"] = val, now
d["updated_at"] = now
r = F.put(f"{BASE}/api/me/boat", params=p, json=d)
print(r.status_code, [(i["id"], i["checked"]) for i in r.json()["data"][lid][:3]])
