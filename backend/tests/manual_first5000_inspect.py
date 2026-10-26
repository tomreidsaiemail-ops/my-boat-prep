# Manual: inspect test-user-free's Stripe subscription (schedule, price, latest invoice, upcoming invoice) and Mongo fields
import os, asyncio, sys
from pathlib import Path
import stripe
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
UID = sys.argv[1] if len(sys.argv) > 1 else "test-user-free"


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    u = await db.users.find_one({"user_id": UID}, {"_id": 0, "role": 1, "stripe_subscription_id": 1, "subscription_status": 1,
                                                    "pro_until": 1, "cancel_at_period_end": 1, "first5000": 1, "renew_price": 1})
    print("DB:", u)
    sid = (u or {}).get("stripe_subscription_id")
    if not sid:
        return
    sub = stripe.Subscription.retrieve(sid)
    it = sub["items"]["data"][0]
    print("SUB:", sub.id, sub.status, "schedule=", sub.get("schedule"), "cancel_at_period_end=", sub.cancel_at_period_end,
          "price=", it["price"]["lookup_key"], it["price"]["unit_amount"], "meta=", dict(sub.metadata))
    inv = stripe.Invoice.retrieve(sub.latest_invoice)
    print("LATEST INVOICE:", inv.subtotal, inv.total, inv.status)
    try:
        up = stripe.Invoice.create_preview(subscription=sid)
        print("UPCOMING:", up.subtotal, up.total, [l["amount"] for l in up.lines.data])
    except Exception as e:
        print("UPCOMING err:", e)
    print("schedules for customer:", [ (s.id, s.status) for s in stripe.SubscriptionSchedule.list(customer=sub.customer, limit=10).data])

asyncio.run(main())
