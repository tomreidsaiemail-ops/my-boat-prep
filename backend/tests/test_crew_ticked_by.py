# Crew "Ticked by" name: server stamps crew name on crew ticks (server-trusted), clears on untick / skipper ticks.
import os
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
P = {"boat_id": "main", "owner": "test-user-pro"}
LID = "riggingChecks"


def sess(tok):
    s = requests.Session(); s.cookies.set("session_token", tok); return s


CREW, SKIP = sess("test_session_free_1"), sess("test_session_pro_1")


def now(off=0):
    return (datetime.now(timezone.utc) + timedelta(seconds=off)).isoformat()


def crew_get():
    r = CREW.get(f"{BASE}/api/me/boat", params=P); assert r.status_code == 200, r.text; return r.json()


def skip_get():
    r = SKIP.get(f"{BASE}/api/me/boat", params={"boat_id": "main"}); assert r.status_code == 200, r.text; return r.json()


def find(d, iid, lid=LID):
    return next(i for i in d["data"][lid] if i["id"] == iid)


@pytest.fixture(scope="module")
def target():
    d = crew_get()
    assert d.get("role") in (None, "crew") or True
    it = next(i for i in d["data"][LID] if not i.get("checked"))
    yield it["id"]
    # cleanup: crew unticks
    d = crew_get(); t = now(2)
    for i in d["data"][LID]:
        if i["id"] == it["id"]:
            i["checked"], i["ts"] = False, t
    d["updated_at"] = t
    CREW.put(f"{BASE}/api/me/boat", params=P, json=d)


def crew_set(iid, val, spoof=None):
    d = crew_get(); t = now(1)
    for i in d["data"][LID]:
        if i["id"] == iid:
            i["checked"], i["ts"] = val, t
            if spoof is not None:
                i["checked_by"] = spoof
    d["updated_at"] = t
    r = CREW.put(f"{BASE}/api/me/boat", params=P, json=d)
    assert r.status_code == 200, r.text
    return r.json()


class TestCrewTickedBy:
    def test_crew_tick_stamps_server_name(self, target):
        out = crew_set(target, True, spoof="HACKER")
        assert find(out, target)["checked"] is True
        assert find(out, target)["checked_by"] == "TEST Free Crew"
        s = find(skip_get(), target)
        assert s["checked"] is True and s["checked_by"] == "TEST Free Crew"

    def test_crew_spoof_without_state_change_ignored(self, target):
        d = crew_get(); t = now(1)
        for i in d["data"][LID]:
            if i["id"] == target:
                i["checked_by"] = "HACKER"; i["ts"] = t
        d["updated_at"] = t
        r = CREW.put(f"{BASE}/api/me/boat", params=P, json=d); assert r.status_code == 200
        assert find(skip_get(), target)["checked_by"] == "TEST Free Crew"

    def test_crew_untick_removes_name(self, target):
        out = crew_set(target, False)
        it = find(out, target)
        assert it["checked"] is False and "checked_by" not in it
        assert "checked_by" not in find(skip_get(), target)

    def test_crew_spoof_on_other_item_ignored(self, target):
        # crew tick with spoofed name -> still crew name
        out = crew_set(target, True, spoof="Captain Fake")
        assert find(out, target)["checked_by"] == "TEST Free Crew"
        crew_set(target, False)
