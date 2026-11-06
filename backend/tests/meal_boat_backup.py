# Backup/restore of pro boat main fields touched by the meal plan / galley crew tests
import asyncio, os, sys, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
F = ("registry", "data", "list_ts", "sec_ts", "crew_roles", "updated_at", "areas")
P = "/tmp/pro_boat_meal_backup.json"
async def m(cmd):
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    key = {"owner_id": "test-user-pro", "boat_id": "main"}
    if cmd == "backup":
        d = await db.user_boats.find_one(key, {"_id": 0})
        json.dump({f: d.get(f) for f in F}, open(P, "w"))
        print("backed up", len(d["registry"]))
    else:
        b = json.load(open(P))
        await db.user_boats.update_one(key, {"$set": b})
        print("restored", len(b["registry"]))
asyncio.run(m(sys.argv[1]))
