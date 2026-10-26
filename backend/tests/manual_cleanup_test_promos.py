# Manual cleanup: deactivate TEST* promo codes in Stripe, delete their coupons and db docs
import os, asyncio
from pathlib import Path
import stripe
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    async for d in db.promo_codes.find({"code": {"$regex": "^TEST"}}):
        try: stripe.PromotionCode.modify(d["stripe_promo_id"], active=False)
        except Exception as e: print("promo", e)
        try: stripe.Coupon.delete(d["stripe_coupon_id"])
        except Exception as e: print("coupon", e)
        await db.promo_codes.delete_one({"_id": d["_id"]})
        print("cleaned", d["code"])
asyncio.run(main())
