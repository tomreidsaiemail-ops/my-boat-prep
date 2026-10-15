"""Tier/auth/admin/per-user boat/email-log/payments tests (post Google-auth + tiers update)."""
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
RECIPIENT = "delivered@resend.dev"
TOK = {"admin": "test_session_admin_1", "free": "test_session_free_1", "pro": "test_session_pro_1", "beta": "test_session_beta_1"}
UID = {"admin": "test-admin-1", "free": "test-user-free", "pro": "test-user-pro", "beta": "test-user-beta"}
SEED_ROLES = {"test-admin-1": "beta_tester", "test-user-free": "free", "test-user-pro": "pro", "test-user-beta": "beta_tester"}

mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def H(who):
    return {"Authorization": f"Bearer {TOK[who]}"}


def boat_payload(vessel="TEST_Kia Ora", skipper="TEST_Skipper", callsign="ZMA123", email=RECIPIENT):
    return {
        "boat": {"vessel": vessel, "skipper": skipper, "callsign": callsign, "log_email": email},
        "registry": [{"id": "shipsLog", "name": "Ship's Log", "isSystem": True}],
        "data": {"shipsLog": [{"id": 1, "label": "Date: [DATE]", "checked": True, "dynamic": "logDate"},
                              {"id": 2, "label": "Fuel topped up", "checked": False}]},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture(scope="module", autouse=True)
def restore_roles():
    yield
    for uid, role in SEED_ROLES.items():
        mdb.users.update_one({"user_id": uid}, {"$set": {"role": role}})


# --- auth/me ---
class TestAuthMe:
    def test_me_401_without_session(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_401_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope_xyz"})
        assert r.status_code == 401

    @pytest.mark.parametrize("who,role,admin,premium", [
        ("free", "free", False, False), ("pro", "pro", False, True),
        ("beta", "beta_tester", False, True), ("admin", "beta_tester", True, True)])
    def test_me_bearer(self, who, role, admin, premium):
        r = requests.get(f"{API}/auth/me", headers=H(who))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_id"] == UID[who] and d["role"] == role
        assert d["is_admin"] is admin and d["premium"] is premium
        assert "_id" not in d

    def test_me_cookie(self):
        r = requests.get(f"{API}/auth/me", cookies={"session_token": TOK["free"]})
        assert r.status_code == 200 and r.json()["role"] == "free"

    def test_logout_clears_session(self):
        tok = f"test_session_tmp_{uuid.uuid4().hex[:8]}"
        mdb.user_sessions.insert_one({"user_id": UID["free"], "session_token": tok,
                                      "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
                                      "created_at": datetime.now(timezone.utc)})
        assert requests.get(f"{API}/auth/me", cookies={"session_token": tok}).status_code == 200
        r = requests.post(f"{API}/auth/logout", cookies={"session_token": tok})
        assert r.status_code == 200 and r.json()["ok"] is True
        assert requests.get(f"{API}/auth/me", cookies={"session_token": tok}).status_code == 401

    def test_logout_with_bearer_only(self):
        tok = f"test_session_tmp_{uuid.uuid4().hex[:8]}"
        mdb.user_sessions.insert_one({"user_id": UID["free"], "session_token": tok,
                                      "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
                                      "created_at": datetime.now(timezone.utc)})
        requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {tok}"})
        still = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code
        mdb.user_sessions.delete_one({"session_token": tok})
        assert still == 401, "Bearer logout does not invalidate the session"

    def test_expired_session_401(self):
        tok = f"test_session_tmp_{uuid.uuid4().hex[:8]}"
        mdb.user_sessions.insert_one({"user_id": UID["free"], "session_token": tok,
                                      "expires_at": datetime.now(timezone.utc) - timedelta(minutes=1),
                                      "created_at": datetime.now(timezone.utc)})
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        mdb.user_sessions.delete_one({"session_token": tok})
        assert r.status_code == 401


# --- per-user boat ---
class TestBoat:
    def test_boat_401(self):
        assert requests.get(f"{API}/me/boat").status_code == 401
        assert requests.put(f"{API}/me/boat", json=boat_payload()).status_code == 401

    def test_old_endpoints_removed(self):
        r = requests.get(f"{API}/boats/some-device")
        assert r.status_code in (404, 405)

    def test_put_get_isolation(self):
        marker = f"TEST_Free_{uuid.uuid4().hex[:6]}"
        r = requests.put(f"{API}/me/boat", json=boat_payload(vessel=marker), headers=H("free"))
        assert r.status_code == 200, r.text
        assert r.json()["owner_id"] == UID["free"] and "_id" not in r.json()
        g = requests.get(f"{API}/me/boat", headers=H("free"))
        assert g.status_code == 200 and g.json()["boat"]["vessel"] == marker
        gp = requests.get(f"{API}/me/boat", headers=H("pro"))
        if gp.status_code == 200:
            assert gp.json()["boat"]["vessel"] != marker
            assert gp.json()["owner_id"] == UID["pro"]
        else:
            assert gp.status_code == 404


# --- email-log gating ---
class TestEmailLog:
    def test_free_403(self):
        requests.put(f"{API}/me/boat", json=boat_payload(), headers=H("free"))
        r = requests.post(f"{API}/me/email-log", json={"local_date": "Wednesday, 14 October 2026"}, headers=H("free"))
        assert r.status_code == 403
        assert r.json()["detail"] == "Upgrade to Pro to use this feature"

    def test_unauth_401(self):
        r = requests.post(f"{API}/me/email-log", json={"local_date": "Wednesday, 14 October 2026"})
        assert r.status_code == 401

    def test_beta_missing_details_400(self):
        requests.put(f"{API}/me/boat", json=boat_payload(vessel="", skipper="", callsign=""), headers=H("beta"))
        r = requests.post(f"{API}/me/email-log", json={"local_date": "Wednesday, 14 October 2026"}, headers=H("beta"))
        assert r.status_code == 400 and "vessel details" in r.json()["detail"].lower()

    def test_pro_sends_and_pdf(self):
        assert requests.put(f"{API}/me/boat", json=boat_payload(), headers=H("pro")).status_code == 200
        r = requests.post(f"{API}/me/email-log", json={"local_date": "Wednesday, 14 October 2026"}, headers=H("pro"), timeout=60)
        assert r.status_code == 200, r.text
        ls = r.json()["log_sent"]
        assert ls["to"] == RECIPIENT and ls["title"].startswith("Ship's Log - TEST_Kia Ora")
        g = requests.get(f"{API}/me/boat", headers=H("pro")).json()
        assert g["log_sent"]["log_id"] == ls["log_id"]
        p = requests.get(f"{API}/ship-logs/{ls['log_id']}.pdf")
        assert p.status_code == 200 and p.content.startswith(b"%PDF")

    def test_pdf_malformed_422(self):
        assert requests.get(f"{API}/ship-logs/not-a-uuid.pdf").status_code == 422


# --- admin ---
class TestAdmin:
    @pytest.mark.parametrize("who", ["free", "pro", "beta"])
    def test_non_admin_403(self, who):
        assert requests.get(f"{API}/admin/users", headers=H(who)).status_code == 403
        r = requests.patch(f"{API}/admin/users/{UID['free']}", json={"role": "pro"}, headers=H(who))
        assert r.status_code == 403

    def test_list_users(self):
        r = requests.get(f"{API}/admin/users", headers=H("admin"))
        assert r.status_code == 200
        ids = {u["user_id"] for u in r.json()}
        assert set(UID.values()) <= ids
        assert all("_id" not in u for u in r.json())

    @pytest.mark.parametrize("role", ["beta_tester", "pro", "free"])
    def test_set_role(self, role):
        r = requests.patch(f"{API}/admin/users/{UID['free']}", json={"role": role}, headers=H("admin"))
        assert r.status_code == 200 and r.json()["role"] == role
        me = requests.get(f"{API}/auth/me", headers=H("free")).json()
        assert me["role"] == role and me["premium"] is (role != "free")

    def test_invalid_role_422(self):
        r = requests.patch(f"{API}/admin/users/{UID['free']}", json={"role": "god"}, headers=H("admin"))
        assert r.status_code == 422

    def test_unknown_user_404(self):
        r = requests.patch(f"{API}/admin/users/nope-xyz", json={"role": "pro"}, headers=H("admin"))
        assert r.status_code == 404


# --- payments ---
class TestPayments:
    def test_checkout_401(self):
        assert requests.post(f"{API}/payments/checkout", json={"origin_url": BASE_URL}).status_code == 401

    def test_checkout_bad_origin(self):
        r = requests.post(f"{API}/payments/checkout", json={"origin_url": "javascript:alert(1)"}, headers=H("free"))
        assert r.status_code == 400

    def test_checkout_creates_session(self):
        r = requests.post(f"{API}/payments/checkout", json={"origin_url": BASE_URL}, headers=H("free"), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://checkout.stripe.com")
        s = requests.get(f"{API}/payments/status/{d['session_id']}", timeout=30)
        assert s.status_code == 200 and s.json()["payment_status"] == "pending"

    def test_status_unknown_404(self):
        assert requests.get(f"{API}/payments/status/cs_test_nope").status_code == 404

    def test_renewal_no_sub_400(self):
        r = requests.post(f"{API}/payments/renewal", json={"renew": False}, headers=H("pro"))
        assert r.status_code == 400

    def test_webhook_bad_sig_400(self):
        r = requests.post(f"{API}/stripe/webhook", data=b"{}", headers={"stripe-signature": "bad"})
        assert r.status_code == 400
