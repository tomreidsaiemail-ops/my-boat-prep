import os
from pathlib import Path
import stripe
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

CATALOG = [
    {
        "emergent_product_id": "mbp_pro",
        "name": "My Boat Prep Pro",
        "tax_code": "txcd_10103001",
        "prices": [
            {"lookup_key": "pro_yearly", "amount": 4999, "currency": "nzd", "interval": "year", "migrate": True},
            # FIRST5000 launch price: first year and first renewal, then the schedule moves them to pro_yearly.
            {"lookup_key": "pro_yearly_first5000", "amount": 2499, "currency": "nzd", "interval": "year", "metadata": {"plan": "first5000"}},
        ],
    },
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(name=entry["name"], tax_code=entry.get("tax_code"),
                                 metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def ensure_price(product, p):
    existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
    if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if existing:
        return existing[0]
    kwargs = dict(product=product.id, unit_amount=p["amount"], currency=p["currency"], lookup_key=p["lookup_key"], transfer_lookup_key=True)
    if p.get("interval"):
        kwargs["recurring"] = {"interval": p["interval"]}
    if p.get("metadata"):
        kwargs["metadata"] = p["metadata"]
    return stripe.Price.create(**kwargs)


def migrate_subscribers(product, price):
    """Move live subscriptions on an old price to the current one from their next renewal (no proration)."""
    moved = 0
    for sub in stripe.Subscription.list(status="all", limit=100).auto_paging_iter():
        # FIRST5000 subscriptions run on their own schedule, so leave them alone.
        if sub.status not in ("active", "trialing", "past_due") or sub.get("schedule"):
            continue
        for item in sub["items"]["data"]:
            old = item["price"]
            if old["product"] == product.id and old["id"] != price.id and old.get("recurring") and (old.get("metadata") or {}).get("plan") != "first5000":
                stripe.Subscription.modify(sub.id, items=[{"id": item["id"], "price": price.id}], proration_behavior="none")
                moved += 1
    return moved


def setup():
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            price = ensure_price(product, p)
            moved = migrate_subscribers(product, price) if p.get("migrate") else 0
            print(f"{entry['name']}: {price.lookup_key} {price.unit_amount} {price.currency} ({price.id}), moved {moved} subscriptions")


if __name__ == "__main__":
    setup()
