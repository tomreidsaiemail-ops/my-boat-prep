# Iteration 156 UI setup: fresh password accounts (A phone-fill, B save-and-sign-out, C sign-out-anyway)
import os, json, uuid, asyncio, requests
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


async def main():
    out = {}
    tag = uuid.uuid4().hex[:6]
    for k in ("A", "B", "C"):
        email = f"test_ui156_{k.lower()}_{tag}@example.com"
        r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Harbour2026!", "name": f"TEST_Skip{k}"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        u = r.json()
        out[k] = {"email": email, "user_id": u["user_id"], "token": r.cookies.get("session_token")}
    a = out["A"]
    await db.crew_register.insert_one({"entry_id": str(uuid.uuid4()), "owner_id": a["user_id"], "kind": "crew", "name": "TEST_SkipA",
                                       "email": a["email"], "email_key": a["email"], "phone": "+64 21 000 111", "status": "registered",
                                       "updated_at": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    json.dump(out, open("/tmp/u156.json", "w"))
    print(json.dumps(out, indent=1))

asyncio.run(main())
