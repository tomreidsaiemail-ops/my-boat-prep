# Manual cleanup: cancel test-user-free's Stripe sub and reset its Mongo billing fields (keeps stripe_customer_id)
import os, asyncio
from pathlib import Path
import stripe
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    u = await db.users.find_one({"user_id": "test-user-free"})
    sid = u.get("stripe_subscription_id")
    if sid:
        try:
            print("cancel", stripe.Subscription.cancel(sid).status)
        except Exception as e:
            print("cancel err", e)
    await db.users.update_one({"user_id": "test-user-free"}, {"$set": {"role": "free"}, "$unset": {
        "stripe_subscription_id": "", "subscription_status": "", "pro_until": "", "cancel_at_period_end": "", "first5000": "", "renew_price": ""}})
    print(await db.users.find_one({"user_id": "test-user-free"}, {"_id": 0, "role": 1, "stripe_customer_id": 1, "first5000": 1, "stripe_subscription_id": 1}))

asyncio.run(main())
