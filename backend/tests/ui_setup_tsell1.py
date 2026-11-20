# Setup/cleanup helper for UI test of multi-buyer transfer: python ui_setup_tsell1.py setup|cleanup
import os, sys, uuid, asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
V = "TEST_SellBoat"


async def main(cmd):
    cli = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = cli[os.environ['DB_NAME']]
    await db.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": "tsell1"})
    await db.user_boats.delete_many({"owner_id": {"$in": ["test-user-free", "test-user-beta"]}, "transferred.vessel": V})
    await db.user_notices.delete_many({"user_id": {"$in": ["test-user-free", "test-user-beta"]}, "text": {"$regex": "^TEST_SellBoat is now"}})
    await db.boat_transfers.delete_many({"seller_id": "test-user-pro", "boat_id": "tsell1"})
    await db.ownership_requests.delete_many({"boat_key": V.lower()})
    if cmd == "setup":
        src = await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
        src.pop("_id")
        src["boat_id"] = "tsell1"
        src["boat"] = {**src.get("boat", {}), "vessel": V}
        src["registry"] = src["registry"] + [{"id": "transferOwnership", "name": "Transfer ownership"}]
        src["data"]["transferOwnership"] = [{"id": 1, "label": "Gather maintenance logs", "checked": False}]
        await db.user_boats.insert_one(src)
        now = datetime.now(timezone.utc)
        for n, (uid, email, name) in enumerate((("test-user-free", "test.user.free@example.com", "Test Free"), ("test-user-beta", "test.user.beta@example.com", "Test Beta"))):
            u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
            await db.ownership_requests.insert_one({"request_id": uuid.uuid4().hex, "buyer_id": uid, "owner_key": "test.user.pro@example.com", "boat_key": V.lower(),
                                                    "status": "pending", "boat_name": V, "owner_email": "test.user.pro@example.com", "buyer_email": email,
                                                    "buyer_name": (u or {}).get("name") or name, "created_at": (now + timedelta(seconds=n)).isoformat(), "updated_at": now.isoformat()})
        async for r in db.ownership_requests.find({"boat_key": V.lower()}, {"_id": 0, "request_id": 1, "buyer_email": 1, "buyer_name": 1}):
            print(r)
    else:
        print("cleaned")
    cli.close()

asyncio.run(main(sys.argv[1]))
