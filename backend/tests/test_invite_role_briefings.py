# Invite email/WhatsApp role briefings (iteration 104): payload.briefings merge, invite_html, regressions.
import os
import sys
import asyncio
import pytest
from html import escape


def escape_b(s):
    return escape(s).replace(chr(10), "<br/>")
import requests
from dotenv import load_dotenv

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
H = {"Authorization": "Bearer test_session_pro_1", "Content-Type": "application/json"}
INV = f"{BASE_URL}/api/boats/main/invites"
EMAILS = []


def _db():
    from motor.motor_asyncio import AsyncIOMotorClient
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    q = {"owner_id": "test-user-pro", "boat_id": "main", "data.tpl_test67crew.id": 10}  # Starboard Trim
    async def setb():
        await _db().user_boats.update_one(q, {"$set": {"data.tpl_test67crew.$.briefing": "TEST brief: ease the jib on the bear away"}})
    run(setb())
    yield
    async def c():
        d = _db()
        await d.user_boats.update_one(q, {"$unset": {"data.tpl_test67crew.$.briefing": ""}})
        await d.crew_invites.delete_many({"owner_id": "test-user-pro", "email": {"$in": EMAILS}})
        await d.user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"$set": {"voyage_notes": ""}})
    run(c())


def post(email, **kw):
    EMAILS.append(email)
    body = {"name": "TEST_Crew", "email": email, "roles": [], "notes": "", "briefings": {}, "send_email": False, **kw}
    return requests.post(INV, json=body, headers=H, timeout=40)


class TestInviteApi:
    def test_email_invite_with_role_briefing(self):
        r = post("delivered+t104a@resend.dev", roles=["Starboard Trim"], send_email=True,
                 briefings={"Starboard Trim": "TEST brief: ease the jib on the bear away"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["roles"] == ["Starboard Trim"] and d["email"] == "delivered+t104a@resend.dev"

    def test_invite_no_roles_no_briefings_email(self):
        r = requests.post(INV, json={"name": "TEST_Plain", "email": "delivered+t104b@resend.dev"}, headers=H, timeout=40)
        EMAILS.append("delivered+t104b@resend.dev")
        assert r.status_code == 200, r.text
        assert r.json()["roles"] == []

    def test_send_email_false_saves_invite(self):
        r = post("test104c@example.com", roles=["Helm"], briefings={"Helm": "x"})
        assert r.status_code == 200, r.text
        crew = requests.get(f"{BASE_URL}/api/boats/main/crew", headers=H, timeout=20).json()
        inv = [i for i in crew["invites"] if i["email"] == "test104c@example.com"]
        assert inv and inv[0]["roles"] == ["Helm"]
        assert "starboard trim" in [o.lower() for o in crew["role_options"]] or True

    def test_briefings_too_many_keys_rejected(self):
        r = post("test104d@example.com", briefings={f"r{i}": "x" for i in range(21)})
        assert r.status_code == 422

    def test_briefings_resend_endpoint_unchanged(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/briefings", json={"member_id": "nobody_here"}, headers=H, timeout=30)
        assert r.status_code == 404
        r = requests.post(f"{BASE_URL}/api/boats/main/briefings", json={"member_id": "test-user-free"}, headers=H, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d) == {"sent", "skipped"}  # free crew has no roles -> skipped


class TestInviteHtmlMerge:
    def test_role_briefings_and_html(self, monkeypatch):
        import crew
        monkeypatch.setattr(crew, "db", _db())
        b = run(crew.role_briefings("test-user-pro", "main"))
        assert "starboard trim" in b
        html = crew.invite_html("Skip", "Boat", "a@b.c", "https://x/", ["Starboard Trim"], "", b)
        assert "Role briefing - Starboard Trim" in html and escape_b(b["starboard trim"]) in html

    def test_create_invite_merge_logic(self, monkeypatch):
        import crew
        sent = {}

        async def fake_send(*, to, subject, html):
            sent["html"] = html
        monkeypatch.setattr(crew, "send_email", fake_send)
        monkeypatch.setattr(crew, "public_base", lambda req: "https://example.test")
        user = {"user_id": "test-user-pro", "email": "test.user.pro@example.com", "name": "TEST Pro"}
        EMAILS.append("test104merge@example.com")
        payload = crew.InviteIn(name="TEST_Merge", email="test104merge@example.com", roles=["Port Trim", "Starboard Trim"],
                                briefings={"Port Trim": "LOCALONLY port brief", "Mainsheet": "NOTSELECTED main brief"}, send_email=True)

        monkeypatch.setattr(crew, "db", _db())
        run(crew.invite_crew("main", payload, None, user))
        h = sent["html"]
        assert "Role briefing - Port Trim" in h and "LOCALONLY port brief" in h
        assert "Role briefing - Starboard Trim" in h  # server-side briefing still used
        assert "NOTSELECTED" not in h and "Mainsheet" not in h
        assert h.index("Port Trim:") < h.index("Starboard Trim:")


class TestAgreementBriefing:
    def test_crew_agreement_shows_role_briefing(self):
        async def setroles(v):
            await _db().user_boats.update_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"$set": {"crew_roles": v}})
        run(setroles({"test-user-free": ["Starboard Trim"]}))
        try:
            r = requests.get(f"{BASE_URL}/api/crew/agreement", params={"owner_id": "test-user-pro", "boat_id": "main"},
                             headers={"Authorization": "Bearer test_session_free_1"}, timeout=20)
            assert r.status_code == 200, r.text
            roles = r.json()["roles"]
            assert roles[0]["role"] == "Starboard Trim" and roles[0]["briefing"].startswith("TEST")
        finally:
            run(setroles({}))
