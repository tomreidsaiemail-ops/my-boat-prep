# Mayday / Pan-Pan shore contact alert: raise, idempotency, upgrade, near/far, stand-down, shore views, crew agreement shore_ok
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, FREE, SHORE, ADMIN = "test_session_pro_1", "test_session_free_1", "test_session_shore_1", "test_session_admin_1"
LAST = {"lat": -36.81, "lon": 174.71}


def s(tok):
    x = requests.Session()
    x.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return x


def now_ms():
    return int(time.time() * 1000)


@pytest.fixture(scope="module", autouse=True)
def ensure_cleared():
    # stand down anything active before and after
    def clear():
        r = s(PRO).get(f"{BASE_URL}/api/shore/alert", params={"boat_id": "main"})
        a = r.json().get("alert")
        if a and a.get("state") == "active":
            s(PRO).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "", "boat_id": "main", "alert_id": a["alert_id"]})
    clear()
    yield
    clear()


def track_last():
    r = s(SHORE).get(f"{BASE_URL}/api/shore/track", params={"owner_id": "test-user-pro", "boat_id": "main"})
    assert r.status_code == 200
    pts = r.json().get("points") or []
    return r.json(), (pts[-1] if pts else None)


class TestAccess:
    def test_get_skipper(self):
        r = s(PRO).get(f"{BASE_URL}/api/shore/alert", params={"boat_id": "main"})
        assert r.status_code == 200
        assert r.json()["contacts"] == 2

    def test_get_crew(self):
        r = s(FREE).get(f"{BASE_URL}/api/shore/alert", params={"boat_id": "main", "owner_id": "test-user-pro"})
        assert r.status_code == 200 and r.json()["contacts"] == 2

    def test_outsider_404(self):
        for tok in (ADMIN, SHORE):
            r = s(tok).get(f"{BASE_URL}/api/shore/alert", params={"boat_id": "main", "owner_id": "test-user-pro"})
            assert r.status_code == 404, (tok, r.status_code)
            r = s(tok).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "test-user-pro", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "mayDay", "at": now_ms()})
            assert r.status_code == 404

    def test_no_shore_contacts_null(self):
        r = s(FREE).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "mayDay", "at": now_ms()})
        assert r.status_code == 200
        assert r.json()["alert"] is None and r.json()["contacts"] == 0

    def test_validation(self):
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "help", "at": now_ms()})
        assert r.status_code == 422
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "mayDay", "at": now_ms(), "lat": 95})
        assert r.status_code == 422


class TestFlow:
    ids = {}

    def test_1_raise_no_gps(self):
        aid = str(uuid.uuid4())
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": aid, "kind": "panPan", "at": now_ms()})
        assert r.status_code == 200, r.text
        a = r.json()["alert"]
        assert a["state"] == "active" and a["kind"] == "panPan" and a["pos"] is None
        assert a["last"] and "at" in a["last"] and a["near"] is False and a["dist_m"] is None
        assert a["by_name"] and isinstance(a["emailed"], bool)
        self.__class__.ids["m"] = aid

    def test_2_idempotent(self):
        aid = self.ids["m"]
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": aid, "kind": "panPan", "at": now_ms()})
        assert r.json()["alert"]["alert_id"] == aid
        r = s(FREE).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "test-user-pro", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "panPan", "at": now_ms()})
        assert r.json()["alert"]["alert_id"] == aid

    def test_3_shore_sees(self):
        d, _ = track_last()
        assert d["alert"]["alert_id"] == self.ids["m"] and d["alert"]["state"] == "active"
        r = s(SHORE).get(f"{BASE_URL}/api/shore/boats")
        b = [x for x in r.json()["boats"] if x.get("boat_id") == "main" and x.get("owner_id") == "test-user-pro"]
        assert b and b[0]["alert"] == {"state": "active", "kind": "panPan"}

    def test_4_upgrade_near(self):
        last = track_last()[0]["alert"]["last"]
        aid = str(uuid.uuid4())
        r = s(FREE).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "test-user-pro", "boat_id": "main", "alert_id": aid, "kind": "mayDay",
                                                              "at": now_ms(), "lat": last["lat"] + 0.0003, "lon": last["lon"], "acc": 10})
        a = r.json()["alert"]
        assert a["kind"] == "mayDay" and a["upgraded_from"] == "panPan"
        assert a["near"] is True and a["dist_m"] <= 100 and a["pos"]["lat"] == round(last["lat"] + 0.0003, 6)
        self.__class__.ids["p"] = aid
        # an active Mayday is never downgraded by a later Pan-Pan
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": str(uuid.uuid4()), "kind": "panPan", "at": now_ms()})
        assert r.json()["alert"]["alert_id"] == aid and r.json()["alert"]["kind"] == "mayDay"

    def test_5_stale_409(self):
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "", "boat_id": "main", "alert_id": self.ids["m"]})
        assert r.status_code == 409

    def test_6_crew_stand_down(self):
        r = s(FREE).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "test-user-pro", "boat_id": "main", "alert_id": self.ids["p"]})
        assert r.status_code == 200
        a = r.json()["alert"]
        assert a["state"] == "cleared" and a["cleared_at"] and a["cleared_by_name"] and isinstance(a["emailed"], bool)
        r2 = s(PRO).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "", "boat_id": "main", "alert_id": self.ids["p"]})
        assert r2.status_code == 200 and r2.json()["alert"]["state"] == "cleared" and r2.json()["alert"]["cleared_at"] == a["cleared_at"]
        # stale id after cleared -> no 409
        r3 = s(PRO).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "", "boat_id": "main", "alert_id": self.ids["m"]})
        assert r3.status_code == 200
        d, _ = track_last()
        assert d["alert"]["state"] == "cleared"
        b = [x for x in s(SHORE).get(f"{BASE_URL}/api/shore/boats").json()["boats"] if x.get("owner_id") == "test-user-pro" and x.get("boat_id") == "main"]
        assert b[0]["alert"] is None
        # replay of a cleared alert_id doesn't re-raise
        r4 = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": self.ids["p"], "kind": "mayDay", "at": now_ms()})
        assert r4.json()["alert"]["state"] == "cleared"

    def test_7_far(self):
        last = track_last()[0]["alert"]["last"]
        aid = str(uuid.uuid4())
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert", json={"owner_id": "", "boat_id": "main", "alert_id": aid, "kind": "panPan", "at": now_ms(), "lat": last["lat"] - 0.05, "lon": last["lon"]})
        a = r.json()["alert"]
        assert a["near"] is False and 5000 < a["dist_m"] < 6000 and "upgraded_from" not in a
        r = s(PRO).post(f"{BASE_URL}/api/shore/alert/stand-down", json={"owner_id": "", "boat_id": "main", "alert_id": aid})
        assert r.json()["alert"]["state"] == "cleared"


class TestAgreement:
    def test_shore_brief_and_ok(self):
        x = s(FREE)
        g = x.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": "test-user-pro", "boat_id": "main"})
        assert g.status_code == 200
        brief = g.json()["shore_brief"]
        assert isinstance(brief, list) and len(brief) >= 3 and any("Stand down" in t for t in brief)
        stops = (g.json()["agreement"] or {}).get("stops") or []
        body = {"owner_id": "test-user-pro", "boat_id": "main", "stops": stops, "accept": True, "shore_ok": False}
        r = x.post(f"{BASE_URL}/api/crew/agreement", json=body)
        assert r.status_code == 400 and "shore contact alert instructions" in r.json()["detail"], r.text
