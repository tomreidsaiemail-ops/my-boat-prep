# Seed helper for crew UI tests: fill admin main boat details, create a 2nd admin boat, make crew invite for free user
import hashlib, os, secrets, sys, uuid
from datetime import datetime, timezone, timedelta
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
A = requests.Session(); A.cookies.set("session_token", "test_session_admin_1")
cmd = sys.argv[1]
now = datetime.now(timezone.utc).isoformat()

if cmd == "seed":
    cur = A.get(f"{BASE}/api/me/boat").json()
    cur["boat"].update(vessel="TEST_Admin Main", skipper="TEST Skip", callsign="ZMTEST")
    cur["updated_at"] = now
    cur["sec_ts"] = {**cur.get("sec_ts", {}), "boat": now}
    print(A.put(f"{BASE}/api/me/boat", json=cur).status_code)
    two = {**cur, "boat": {**cur["boat"], "vessel": "TEST_Second Boat", "callsign": "ZMTWO"}}
    print(A.put(f"{BASE}/api/me/boat", params={"boat_id": "TESTsecond"}, json=two).status_code)
elif cmd == "invite":
    boat = sys.argv[2] if len(sys.argv) > 2 else "main"
    token = secrets.token_urlsafe(32)
    n = datetime.now(timezone.utc)
    DB.crew_invites.insert_one({"invite_id": str(uuid.uuid4()), "token_hash": hashlib.sha256(token.encode()).hexdigest(), "owner_id": "test-admin-1",
                                "boat_id": boat, "email": "test.user.free@example.com", "created_at": n.isoformat(), "expires_at": (n + timedelta(days=7)).isoformat()})
    print(token)
