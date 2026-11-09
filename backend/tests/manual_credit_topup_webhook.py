# Manual helper (it135): send a signed checkout.session.completed webhook for a magic_topup session. Usage: python manual_credit_topup_webhook.py <session_id> <user_id> [pack_size]
import os, sys, json, time, hmac, hashlib
import requests
from dotenv import dotenv_values

ENV = dotenv_values("/app/backend/.env")
BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
sid, uid = sys.argv[1], sys.argv[2]
pack = sys.argv[3] if len(sys.argv) > 3 else "50"
ev = {"id": f"evt_TEST_{int(time.time())}", "object": "event", "type": "checkout.session.completed", "api_version": "2024-06-20",
      "data": {"object": {"id": sid, "object": "checkout.session", "mode": "payment", "payment_status": "paid", "status": "complete",
                          "metadata": {"kind": "magic_topup", "pack_size": pack, "user_id": uid}}}}
payload = json.dumps(ev)
t = int(time.time())
sig = hmac.new(ENV["STRIPE_WEBHOOK_SECRET"].encode(), f"{t}.{payload}".encode(), hashlib.sha256).hexdigest()
r = requests.post(f"{BASE}/api/stripe/webhook", data=payload, headers={"stripe-signature": f"t={t},v1={sig}", "Content-Type": "application/json"}, timeout=30)
print(r.status_code, r.text[:200])
