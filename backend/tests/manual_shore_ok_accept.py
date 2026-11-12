# Manual: crew accepts with shore_ok true -> shore_ok_at stored; restores the free user's original agreement record afterwards
import os, asyncio, requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    q = {"owner_id": "test-user-pro", "boat_id": "main"}
    orig = (await db.user_boats.find_one(q, {"agreements.test-user-free": 1}))["agreements"]["test-user-free"]
    walk = await db.walkthroughs.find_one({**q, "user_id": "test-user-free"}, {"_id": 0})
    h = {"Authorization": "Bearer test_session_free_1"}
    try:
        r = requests.post(f"{BASE}/api/crew/agreement", headers=h, json={**q, "stops": orig["stops"], "accept": True, "shore_ok": True})
        print("accept shore_ok", r.status_code, r.json())
        assert r.status_code == 200 and r.json()["agreement"].get("shore_ok_at")
        print("PASS")
    finally:
        await db.user_boats.update_one(q, {"$set": {"agreements.test-user-free": orig}})
        if walk:
            await db.walkthroughs.replace_one({**q, "user_id": "test-user-free"}, walk)
        print("restored")

asyncio.run(main())
