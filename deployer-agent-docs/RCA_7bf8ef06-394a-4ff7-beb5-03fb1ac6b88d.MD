# RCA — "Couldn't start checkout" on POST /api/payments/topup-checkout (My Boat Prep / gemini-prototype)

## Symptom
Clicking "Buy +20 for NZ$5" → frontend fallback toast "Couldn't start checkout". Backend returns HTTP 500 (no JSON `detail`), so the frontend shows its generic fallback.

## Root cause (PROVEN from production logs)
The 500 is NOT a bad/placeholder Stripe key and NOT a price-lookup failure. It is an unhandled Stripe `InvalidRequestError` raised by `stripe.checkout.Session.create(...)` because the `customer=` passed in does not exist in the Stripe account that the **production** `STRIPE_SECRET_KEY` belongs to.

Backend log (active run 7bf8ef06), two occurrences at 23:18:25 and 23:19:02 UTC:
```
INFO: 136.68.30.50:0 - "POST /api/payments/topup-checkout HTTP/1.1" 500 Internal Server Error
stripe - error_code=resource_missing error_message="No such customer: 'cus_VRwBm7c10k2aPx'" error_param=customer error_type=invalid_request_error
stripe._error.InvalidRequestError: Request req_...: No such customer: 'cus_VRwBm7c10k2aPx'
  File "/app/backend/payments.py", line 128, in topup_checkout
  File "/app/backend/payments.py", line 62, in _create_session
  File ".../stripe/checkout/_session.py", line 2471, in create
    return stripe.checkout.Session.create(**kwargs)
```
Stripe returned HTTP 400 (`resource_missing` / param `customer`). The code does not catch it, so FastAPI emits a bare 500 with no `detail` — hence the frontend fallback toast.

### Why the customer is missing
The production key and the preview key point at **different Stripe accounts/modes**. Evidence:
- Price/product lookups in prod succeed (200): `pro_yearly`, `pro_yearly_first5000` → `price_1UUfhvFjIUTSd6H6wfKX6PHF` ("My Boat Prep Pro ... 2499 nzd"). So the prod key's account DOES contain the configured prices/products.
- But the customer id stored on the user does NOT exist in that same account → the customer was created under a *different* Stripe account (the preview/test account) and carried into the prod DB.
- DB confirms the stale id: `users` doc `tomreidsemail@gmail.com` (created 2026-10-15) holds `stripe_customer_id="cus_VRwBm7c10k2aPx"`. **7 users** total carry a `stripe_customer_id`, all at risk of the same 500 once they have a stored customer id.

The code passes `customer=stripe_customer_id if user has one` straight into `Session.create` with no guard, so any user whose stored customer id originated in the other Stripe account fails checkout.

## Stripe secret inventory (names only — values never read)
Present and non-empty on the active run: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`, `STRIPE_ACCOUNT_ID`.
- `STRIPE_SECRET_KEY`: set, non-empty, and **NOT** the placeholder `sk_test_emergent` (matches_expected=false). It is a real working key — the Stripe API accepted it for prices/products/subscriptions (all 200). I cannot read the value so I cannot state test vs live directly, but the account it belongs to has the prices and lacks the customer ids, which proves it is a **different account than the one that created the stored customer ids**.
- No `STRIPE_API_KEY` / `STRIPE_TAX_MODE` key exists under those names in the active run's secret set.

## Fixes
1. **Code (E1)** — make `topup_checkout`/`_create_session` resilient. When `Session.create` raises `stripe.error.InvalidRequestError` with `error_code == 'resource_missing'` on param `customer`, clear the stale `stripe_customer_id`, create a fresh Stripe customer in the current account, persist it, and retry the session create. Also catch Stripe errors and return a proper JSON body with `detail` (and non-500 where appropriate) so the frontend shows a real message instead of the generic fallback. Reproduce against live Stripe is not possible in the sandbox (no secrets), so this was NOT eph-verified — diagnosis is from the production traceback.
2. **User** — confirm the production `STRIPE_SECRET_KEY` points at the intended Stripe account/mode, and clear the stale `stripe_customer_id` on the affected prod users (7 users, incl. tomreidsemail@gmail.com → `cus_VRwBm7c10k2aPx`) so new customers are created in the correct account. The code fix in (1) makes this self-heal; otherwise the stored ids must be reset manually.
