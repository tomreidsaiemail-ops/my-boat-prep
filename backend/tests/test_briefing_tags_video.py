# Role Briefing fill-in tags (<VESSEL> etc.) + <YOUTUBE:url> briefing video choices (crew read, skipper view, PDF)
import os
import sys
import requests
import pytest

sys.path.insert(0, "/app/backend")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for ln in open("/app/frontend/.env"):
        if ln.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
Q = {"owner_id": "test-user-pro", "boat_id": "main"}


def sess(tok):
    s = requests.Session()
    s.cookies.set("session_token", tok)
    return s


free, pro, beta = sess("test_session_free_1"), sess("test_session_pro_1"), sess("test_session_beta_1")


def helm(data):
    return next(r for r in data["roles"] if r["role"] == "Helm")


# Agreement role view: tags filled, blank kept, YOUTUBE removed, video url
def test_agreement_filled():
    r = free.get(f"{BASE_URL}/api/crew/agreement", params=Q)
    assert r.status_code == 200, r.text
    h = helm(r.json())
    b = h["briefing"]
    assert "TEST_Kia Ora" in b and "ZMA123" in b and "<MMSI NUMBER>" in b and "Beneteau Oceanis 38" in b
    assert "YOUTUBE" not in b.upper()
    assert h["video"] == URL
    assert "\n" in b


# briefing-read validation and persistence
def test_read_requires_video():
    r = free.post(f"{BASE_URL}/api/crew/briefing-read", json={**Q, "role": "Helm"})
    assert r.status_code == 400 and "Pick one of the briefing video options first" in r.text


def test_read_bogus_video():
    r = free.post(f"{BASE_URL}/api/crew/briefing-read", json={**Q, "role": "Helm", "video": "bogus"})
    assert r.status_code == 422


def test_read_will_watch_and_persist():
    r = free.post(f"{BASE_URL}/api/crew/briefing-read", json={**Q, "role": "Helm", "video": "will_watch"})
    assert r.status_code == 200, r.text
    assert r.json()["video_choice"] == "will_watch" and r.json()["read_at"]
    h = helm(free.get(f"{BASE_URL}/api/crew/agreement", params=Q).json())
    assert h["read_at"] and h["video_choice"] == "will_watch"


# Skipper's crew view
def test_skipper_crew_view():
    r = pro.get(f"{BASE_URL}/api/boats/main/crew")
    assert r.status_code == 200
    m = next(c for c in r.json()["crew"] if c["user_id"] == "test-user-free")
    b = next(x for x in m["briefings"] if x["role"] == "Helm")
    assert b["video"] is True and b["video_choice"] == "will_watch" and b["read_at"]


# PDF builds; shown() text includes the video link + answer
def test_pdf_and_shown():
    r = pro.get(f"{BASE_URL}/api/crew/agreement/pdf", params={"boat_id": "main", "member_id": "test-user-free"})
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    from briefing_fill import shown
    t = shown("- On <VESSEL>\n- <YOUTUBE:%s>" % URL, {"vessel": "X"}, "watched")
    assert "On X" in t and f"Briefing video: {URL}" in t and "I have watched the briefing video" in t
    assert "Briefing video" not in shown("- On <VESSEL>", {"vessel": "X"})
    # non-youtube video url ignored
    assert "Briefing video" not in shown("<YOUTUBE:https://evil.com/x>", {})


# Regression: briefing without YOUTUBE needs no video (beta temporarily given Mainsheet, then restored)
def test_no_video_role_read():
    try:
        assert pro.put(f"{BASE_URL}/api/boats/main/crew/test-user-beta/roles", json={"roles": ["Mainsheet"]}).status_code == 200
        r = beta.post(f"{BASE_URL}/api/crew/briefing-read", json={**Q, "role": "Mainsheet"})
        assert r.status_code == 200, r.text
        assert r.json()["video_choice"] == ""
        m = next(x for x in beta.get(f"{BASE_URL}/api/crew/agreement", params=Q).json()["roles"] if x["role"] == "Mainsheet")
        assert m["video"] == "" and m["read_at"]
    finally:
        pro.put(f"{BASE_URL}/api/boats/main/crew/test-user-beta/roles", json={"roles": []})
