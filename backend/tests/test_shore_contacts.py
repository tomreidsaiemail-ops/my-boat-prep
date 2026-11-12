# Shore Contact tracking: invites, join, tracking switch, points, shore views, cron alert
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


SECRET = _env("WEBHOOK_CRON_SECRET")
mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    x.headers.update({"Authorization": f"Bearer {tok}"})
    return x


PRO, BETA, FREE, ADMIN = s("test_session_pro_1"), s("test_session_beta_1"), s("test_session_free_1"), s("test_session_admin_1")
BETA_EMAIL = "test.user.beta@example.com"
now_ms = lambda off=0: int(time.time() * 1000) + off


class TestShoreFlow:
    state = {}

    # Skipper: list contacts and validation
    def test_01_get_shore(self):
        r = PRO.get(f"{API}/boats/main/shore")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "contacts" in d and "tracking" in d
        assert any(c["key"] == "test-user-beta" and c["status"] == "joined" for c in d["contacts"])

    def test_02_own_email_rejected(self):
        r = PRO.post(f"{API}/boats/main/shore/invites", json={"name": "Me", "email": "Test.User.Pro@example.com", "send_email": False})
        assert r.status_code == 400

    def test_03_duplicate_contact_rejected(self):
        r = PRO.post(f"{API}/boats/main/shore/invites", json={"name": "B", "email": BETA_EMAIL, "send_email": False})
        assert r.status_code == 400

    def test_04_invalid_email(self):
        r = PRO.post(f"{API}/boats/main/shore/invites", json={"name": "B", "email": "notanemail", "send_email": False})
        assert r.status_code == 400

    def test_05_invite_and_remove(self):
        r = PRO.post(f"{API}/boats/main/shore/invites", json={"name": "TEST_Shore", "email": "test_shore_x@example.com", "send_email": False})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "/shore/join/" in d["link"] and d["emailed"] is False
        lst = PRO.get(f"{API}/boats/main/shore").json()["contacts"]
        inv = [c for c in lst if c["email"] == "test_shore_x@example.com"]
        assert len(inv) == 1 and inv[0]["status"] == "invited"
        # wrong user joins -> 403
        tok = d["link"].rsplit("/", 1)[1]
        assert FREE.post(f"{API}/shore/join", json={"token": tok}).status_code == 403
        was_on = PRO.get(f"{API}/boats/main/shore").json()["tracking"].get("on")
        PRO.put(f"{API}/boats/main/shore/tracking", json={"on": True})
        assert PRO.delete(f"{API}/boats/main/shore/contacts/{inv[0]['key']}").status_code == 409  # sharing on: untick first
        PRO.put(f"{API}/boats/main/shore/tracking", json={"on": False})
        assert PRO.delete(f"{API}/boats/main/shore/contacts/{inv[0]['key']}").status_code == 200
        PRO.put(f"{API}/boats/main/shore/tracking", json={"on": bool(was_on)})
        lst = PRO.get(f"{API}/boats/main/shore").json()["contacts"]
        assert not any(c["email"] == "test_shore_x@example.com" for c in lst)
        # cancelled invite -> 400
        assert FREE.post(f"{API}/shore/join", json={"token": tok}).status_code == 400

    def test_06_non_owner_cannot_invite(self):
        r = ADMIN.post(f"{API}/boats/TEST_nonexistent_boat/shore/invites", json={"name": "x", "email": "x_test@example.com", "send_email": False})
        assert r.status_code in (403, 404)

    # Remove beta, re-invite, join
    def test_07_remove_beta_and_rejoin(self):
        was_on = PRO.get(f"{API}/boats/main/shore").json()["tracking"].get("on")
        PRO.put(f"{API}/boats/main/shore/tracking", json={"on": False})
        assert PRO.delete(f"{API}/boats/main/shore/contacts/test-user-beta").status_code == 200
        if was_on:
            PRO.put(f"{API}/boats/main/shore/tracking", json={"on": True})
        lst = PRO.get(f"{API}/boats/main/shore").json()["contacts"]
        assert not any(c["key"] == "test-user-beta" for c in lst)
        r = BETA.get(f"{API}/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"})
        assert r.status_code == 404
        PRO.put(f"{API}/shore/home", json={"home": "app"})  # noop for pro
        r = PRO.post(f"{API}/boats/main/shore/invites", json={"name": "Beta Shore", "email": BETA_EMAIL, "send_email": False})
        assert r.status_code == 200
        tok = r.json()["link"].rsplit("/", 1)[1]
        assert BETA.put(f"{API}/shore/home", json={"home": "app"}).json()["home"] == "app"
        r = BETA.post(f"{API}/shore/join", json={"token": tok})
        assert r.status_code == 200, r.text
        assert r.json() == {"owner_id": "test-user-pro", "boat_id": "main"}
        me = BETA.get(f"{API}/auth/me").json()
        me = me.get("user", me)
        # An existing skipper keeps their full app; the map is added via the account menu.
        assert me.get("home") == "app" and me.get("shore_contact") and not me.get("shore_only"), me
        lst = PRO.get(f"{API}/boats/main/shore").json()["contacts"]
        assert any(c["key"] == "test-user-beta" and c["status"] == "joined" for c in lst)
        # token single-use
        assert BETA.post(f"{API}/shore/join", json={"token": tok}).status_code == 400

    def test_08_home_app_clears(self):
        assert BETA.put(f"{API}/shore/home", json={"home": "app"}).status_code == 200
        me = BETA.get(f"{API}/auth/me").json()
        me = me.get("user", me)
        assert me.get("home") != "shore"
        assert BETA.put(f"{API}/shore/home", json={"home": "bad"}).status_code == 422
        BETA.put(f"{API}/shore/home", json={"home": "shore"})  # keep the seeded beta user's shore home

    # Tracking switch and points
    def test_09_tracking_new_trip(self):
        r = PRO.put(f"{API}/boats/main/shore/tracking", json={"on": False})
        assert r.status_code == 200 and r.json()["on"] is False and r.json()["state"] == "off"
        r = PRO.put(f"{API}/boats/main/shore/tracking", json={"on": True})
        d = r.json()
        assert d["on"] is True and len(d["trip_id"]) == 36 and d["state"] == "waiting"
        TestShoreFlow.state["trip"] = d["trip_id"]
        boats = PRO.get(f"{API}/me/boats").json()
        boats = boats.get("boats", boats) if isinstance(boats, dict) else boats
        main = [b for b in boats if b.get("boat_id") == "main"][0]
        assert main["tracking"]["on"] is True and main["tracking"]["trip_id"] == d["trip_id"]
        st = BETA.get(f"{API}/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}).json()
        assert st["status"]["state"] == "waiting" and st["points"] == []

    def test_10_points_owner_crew_outsider(self):
        trip = TestShoreFlow.state["trip"]
        t0 = now_ms(-60000)
        r = PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": trip, "points": [{"lat": -36.84, "lon": 174.76, "at": t0, "kind": "start"}]})
        assert r.status_code == 200 and r.json()["saved"] == 1, r.text
        r = PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": trip, "points": [{"lat": -36.84, "lon": 174.76, "at": t0, "kind": "start"}]})
        assert r.status_code == 200 and r.json()["saved"] == 0
        r = FREE.post(f"{API}/track/points", json={"owner_id": "test-user-pro", "boat_id": "main", "trip_id": trip, "points": [{"lat": -36.83, "lon": 174.78, "at": now_ms(), "kind": "move"}]})
        assert r.status_code == 200 and r.json()["saved"] == 1, r.text
        r = ADMIN.post(f"{API}/track/points", json={"owner_id": "test-user-pro", "boat_id": "main", "trip_id": trip, "points": [{"lat": 1, "lon": 1, "at": now_ms(), "kind": "move"}]})
        assert r.status_code == 404
        r = PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": str(uuid.uuid4()), "points": [{"lat": 1, "lon": 1, "at": now_ms(), "kind": "move"}]})
        assert r.status_code == 200 and r.json()["saved"] == 0
        r = PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": trip, "points": [{"lat": 100, "lon": 1, "at": now_ms(), "kind": "move"}]})
        assert r.status_code == 422

    def test_11_shore_views(self):
        b = BETA.get(f"{API}/shore/boats").json()["boats"]
        m = [x for x in b if x["owner_id"] == "test-user-pro" and x["boat_id"] == "main"]
        assert m and m[0]["status"]["state"] == "online"
        t = BETA.get(f"{API}/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}).json()
        assert t["status"]["state"] == "online" and len(t["points"]) == 2
        assert t["points"][-1]["lat"] == -36.83 and t["started_at"]
        assert ADMIN.get(f"{API}/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}).status_code == 404
        assert all(x["owner_id"] != "test-user-pro" for x in ADMIN.get(f"{API}/shore/boats").json()["boats"])

    # Cron
    def test_12_cron_auth(self):
        assert requests.post(f"{API}/cron/shore-check").status_code == 401
        assert requests.post(f"{API}/cron/shore-check", headers={"Authorization": "Bearer wrong"}).status_code == 401

    def test_13_cron_alert_and_clear(self):
        PRO.put(f"{API}/boats/main/shore/tracking", json={"on": False})
        trip = PRO.put(f"{API}/boats/main/shore/tracking", json={"on": True}).json()["trip_id"]
        old = now_ms(-3 * 3600 * 1000)
        r = PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": trip, "points": [{"lat": -36.6, "lon": 175.0, "at": old, "kind": "start"}]})
        assert r.json()["saved"] == 1
        st = BETA.get(f"{API}/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"}).json()
        assert st["status"]["state"] == "offline"
        wid = f"TEST_{uuid.uuid4()}"
        r = requests.post(f"{API}/cron/shore-check", headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": wid}, json={})
        assert r.status_code == 200 and r.json() == {"ok": True}
        time.sleep(3)
        t = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})["tracking"]
        assert t.get("alerted_at"), t
        first = t["alerted_at"]
        # idempotent run id
        r = requests.post(f"{API}/cron/shore-check", headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": wid}, json={})
        assert r.status_code == 200
        assert mdb.cron_runs.count_documents({"run_id": wid}) == 1
        # second run doesn't re-alert
        requests.post(f"{API}/cron/shore-check", headers={"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": wid + "b"}, json={})
        time.sleep(2)
        assert mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})["tracking"]["alerted_at"] == first
        # new point clears alert
        PRO.post(f"{API}/track/points", json={"owner_id": "", "boat_id": "main", "trip_id": trip, "points": [{"lat": -36.81, "lon": 174.71, "at": now_ms(), "kind": "ping"}]})
        t = mdb.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})["tracking"]
        assert "alerted_at" not in t
        mdb.cron_runs.delete_many({"run_id": {"$in": [wid, wid + "b"]}})
