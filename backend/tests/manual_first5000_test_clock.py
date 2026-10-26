# Manual: Stripe test clock check of FIRST5000 price lifecycle (2499 -> 2499 -> 4999) using billing.end_first5000_after_first_renewal
import os, sys, time
from pathlib import Path
import stripe
from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
import billing

DAY = 86400


def wait(clock):
    for _ in range(60):
        c = stripe.test_helpers.TestClock.retrieve(clock.id)
        if c.status == "ready":
            return
        time.sleep(2)
    raise RuntimeError("clock not ready")


now = int(time.time())
clock = stripe.test_helpers.TestClock.create(frozen_time=now)
try:
    cus = stripe.Customer.create(email="test.clock@example.com", test_clock=clock.id, payment_method="pm_card_visa",
                                 invoice_settings={"default_payment_method": "pm_card_visa"})
    price = stripe.Price.list(lookup_keys=["pro_yearly_first5000"], active=True, limit=1).data[0]
    sub = stripe.Subscription.create(customer=cus.id, items=[{"price": price.id}], metadata={"first5000": "1"})
    billing.end_first5000_after_first_renewal(sub)
    print("year1 price:", stripe.Subscription.retrieve(sub.id)["items"]["data"][0]["price"]["unit_amount"])
    stripe.test_helpers.TestClock.advance(clock.id, frozen_time=now + 366 * DAY); wait(clock)
    sub = stripe.Subscription.retrieve(sub.id)
    print("renewal1 invoice:", stripe.Invoice.retrieve(sub.latest_invoice).subtotal)
    billing.end_first5000_after_first_renewal(sub)
    sub = stripe.Subscription.retrieve(sub.id)
    print("after switch price:", sub["items"]["data"][0]["price"]["unit_amount"], "schedule:", sub.get("schedule"))
    print("next preview:", stripe.Invoice.create_preview(subscription=sub.id).subtotal)
    billing.end_first5000_after_first_renewal(sub)  # idempotent: should no-op now
    stripe.test_helpers.TestClock.advance(clock.id, frozen_time=now + 732 * DAY); wait(clock)
    sub = stripe.Subscription.retrieve(sub.id)
    print("renewal2 invoice:", stripe.Invoice.retrieve(sub.latest_invoice).subtotal)
finally:
    stripe.test_helpers.TestClock.delete(clock.id)
    print("clock deleted")
