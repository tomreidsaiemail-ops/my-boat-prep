# Shore contact phone (shore.py) + background distress SMS (distress_sms.py). Only ever uses +9991234567 (unassigned, Twilio rejects).
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN = {"Authorization": "Bearer test_session_admin_1"}
PRO = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
FAKE = "+9991234567"
SMS = {"kind": "mayDay", "vessel": "TEST_Vessel", "callsign": "TEST1", "position": "UNKNOWN", "lines": ["MAYDAY · VHF Channel 16", "TEST_ line"]}
created = {"invites": [], "sms": []}


def _invite(headers, boat="main", **kw):
    body = {"name": "TEST_SmsContact", "email": "test.sms.contact@example.com", "send_email": False, **kw}
    return requests.post(f"{BASE_URL}/api/boats/{boat}/shore/invites", json=body, headers=headers)


def _find(headers, email, boat="main"):
    r = requests.get(f"{BASE_URL}/api/boats/{boat}/shore", headers=headers)
    assert r.status_code == 200
    return next((c for c in r.json()["contacts"] if c["email"] == email), None)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for owner, key in created["invites"]:
        requests.delete(f"{BASE_URL}/api/boats/main/shore/contacts/{key}", headers=owner)


class TestShorePhone:
    def test_invite_phone_normalised(self):
        r = _invite(ADMIN, phone="+64 21 555 1234")
        assert r.status_code == 200, r.text
        c = _find(ADMIN, "test.sms.contact@example.com")
        assert c and c["phone"] == "+64215551234" and c["status"] == "invited"
        created["invites"].append((ADMIN, c["key"]))

    def test_invite_phone_0064(self):
        r = _invite(ADMIN, email="test.sms.contact2@example.com", phone="0064 21 555 1234")
        assert r.status_code == 200, r.text
        c = _find(ADMIN, "test.sms.contact2@example.com")
        assert c["phone"] == "+64215551234"
        created["invites"].append((ADMIN, c["key"]))

    def test_invite_phone_invalid(self):
        r = _invite(ADMIN, email="test.sms.contact3@example.com", phone="021 555")
        assert r.status_code == 400
        assert r.json()["detail"].startswith("Use the international format")
        assert _find(ADMIN, "test.sms.contact3@example.com") is None

    def test_invite_no_phone(self):
        r = _invite(ADMIN, email="test.sms.contact4@example.com")
        assert r.status_code == 200
        c = _find(ADMIN, "test.sms.contact4@example.com")
        assert c["phone"] == ""
        created["invites"].append((ADMIN, c["key"]))

    def test_set_phone_invite_and_clear(self):
        c = _find(ADMIN, "test.sms.contact4@example.com")
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{c['key']}/phone", json={"phone": "+1 (415) 555-0100"}, headers=ADMIN)
        assert r.status_code == 200 and r.json()["phone"] == "+14155550100"
        assert _find(ADMIN, "test.sms.contact4@example.com")["phone"] == "+14155550100"
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{c['key']}/phone", json={"phone": ""}, headers=ADMIN)
        assert r.status_code == 200 and r.json()["phone"] == ""
        assert _find(ADMIN, "test.sms.contact4@example.com")["phone"] == ""

    def test_set_phone_invalid_400(self):
        c = _find(ADMIN, "test.sms.contact4@example.com")
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{c['key']}/phone", json={"phone": "12ab"}, headers=ADMIN)
        assert r.status_code == 400

    def test_set_phone_unknown_404(self):
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/nope-key-123/phone", json={"phone": FAKE}, headers=ADMIN)
        assert r.status_code == 404

    def test_set_phone_owner_only(self):
        c = _find(ADMIN, "test.sms.contact4@example.com")
        # Pro owns its own main; admin's invite key is not on pro's boat -> 404, and admin's invite unchanged
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{c['key']}/phone", json={"phone": FAKE}, headers=PRO)
        assert r.status_code == 404
        assert _find(ADMIN, "test.sms.contact4@example.com")["phone"] == ""

    def test_set_phone_joined_contact_and_restore(self):
        # test-shore-only is joined on pro/main (no phone); set then clear
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/test-shore-only/phone", json={"phone": FAKE}, headers=PRO)
        assert r.status_code == 200 and r.json()["phone"] == FAKE
        assert _find(PRO, "shore.only.test@example.com")["phone"] == FAKE
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/test-shore-only/phone", json={"phone": ""}, headers=PRO)
        assert r.status_code == 200
        assert _find(PRO, "shore.only.test@example.com")["phone"] == ""


class TestDistressSms:
    def test_requires_auth(self):
        assert requests.post(f"{BASE_URL}/api/distress-sms", json={**SMS, "boat_id": "main"}).status_code == 401

    def test_bad_kind_422(self):
        r = requests.post(f"{BASE_URL}/api/distress-sms", json={**SMS, "boat_id": "main", "kind": "sos"}, headers=ADMIN)
        assert r.status_code == 422

    def test_no_phones_null(self):
        # free user's own main has no shore contacts
        r = requests.get(f"{BASE_URL}/api/distress-sms/phones", params={"boat_id": "main"}, headers=FREE)
        assert r.status_code == 200 and r.json()["phones"] == 0
        r = requests.post(f"{BASE_URL}/api/distress-sms", json={**SMS, "boat_id": "main"}, headers=FREE)
        assert r.status_code == 200 and r.json() == {"sms_id": None, "count": 0}

    def test_stranger_404(self):
        r = requests.get(f"{BASE_URL}/api/distress-sms/phones", params={"boat_id": "main", "owner_id": "test-admin-1"}, headers=FREE)
        assert r.status_code == 404
        r = requests.post(f"{BASE_URL}/api/distress-sms", json={**SMS, "boat_id": "main", "owner_id": "test-admin-1"}, headers=FREE)
        assert r.status_code == 404

    def test_send_fake_number_fails_gracefully(self):
        c = _find(ADMIN, "test.sms.contact4@example.com")
        # make the 2 +64 invites blank so only FAKE is texted
        for e in ("test.sms.contact@example.com", "test.sms.contact2@example.com"):
            k = _find(ADMIN, e)["key"]
            assert requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{k}/phone", json={"phone": ""}, headers=ADMIN).status_code == 200
        assert requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/{c['key']}/phone", json={"phone": FAKE}, headers=ADMIN).status_code == 200
        r = requests.get(f"{BASE_URL}/api/distress-sms/phones", params={"boat_id": "main"}, headers=ADMIN)
        assert r.status_code == 200 and r.json()["phones"] == 1
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/distress-sms", json={**SMS, "boat_id": "main"}, headers=ADMIN, timeout=30)
        assert r.status_code == 200, r.text
        assert time.time() - t0 < 5, "POST should return immediately"
        d = r.json()
        assert d["count"] == 1 and isinstance(d["sms_id"], str)
        created["sms"].append(d["sms_id"])
        # only the sender may read
        assert requests.get(f"{BASE_URL}/api/distress-sms/{d['sms_id']}", headers=PRO).status_code == 404
        status = None
        for _ in range(20):
            s = requests.get(f"{BASE_URL}/api/distress-sms/{d['sms_id']}", headers=ADMIN)
            assert s.status_code == 200
            status = s.json()
            if status["status"] != "sending":
                break
            time.sleep(2)
        assert status == {"status": "failed", "delivered": 0, "total": 1}, status

    def test_status_bad_id_422_unknown_404(self):
        assert requests.get(f"{BASE_URL}/api/distress-sms/xyz", headers=ADMIN).status_code == 422
        assert requests.get(f"{BASE_URL}/api/distress-sms/00000000-0000-0000-0000-000000000000", headers=ADMIN).status_code == 404

    def test_crew_phones_on_pro_main(self):
        r = requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/test-shore-only/phone", json={"phone": FAKE}, headers=PRO)
        assert r.status_code == 200
        try:
            r = requests.get(f"{BASE_URL}/api/distress-sms/phones", params={"boat_id": "main", "owner_id": "test-user-pro"}, headers=FREE)
            assert r.status_code == 200 and r.json()["phones"] == 1
        finally:
            requests.put(f"{BASE_URL}/api/boats/main/shore/contacts/test-shore-only/phone", json={"phone": ""}, headers=PRO)
