# Role Briefing bullets: admin Crew Roles template, seed file, migration, read-receipt hashes, boats copies (read-only)
import hashlib
import os
import sys

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"Authorization": "Bearer test_session_admin_1"}

from crew import brief_hash, brief_read  # noqa: E402
from role_briefings import SAFETY_BRIEFINGS, _flat, as_bullets  # noqa: E402
from templates import _role_key  # noqa: E402

RADIO = ("- VHF 16 is monitored at all times.\n"
         "- Know the boat's name, callsign and MMSI, and where the position is shown, before you ever need them.\n"
         "- MAYDAY is only for grave and imminent danger to life or the vessel;\n"
         "- PAN-PAN for urgent help.\n"
         "- Speak slowly, repeat the position, and log every safety call.\n"
         "- The red DSC distress button sends our position automatically: lift the cover, hold it for 5 seconds.")


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def crew_roles():
    r = requests.get(f"{BASE_URL}/api/admin/template-lists", headers=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    t = [d for d in r.json() if d.get("name", "").strip().lower() == "crew roles"]
    assert len(t) == 1
    return t[0]


def _ok(b):
    lines = b.split("\n")
    return all(ln.startswith("- ") and ln[2:].strip() for ln in lines)


class TestTemplate:
    def test_43_briefings_all_bullets(self, crew_roles):
        bs = [i for i in crew_roles["items"] if i.get("briefing")]
        assert len(bs) == 43, len(bs)
        bad = [i["label"] for i in bs if not _ok(i["briefing"])]
        assert not bad, bad

    def test_radio_operator_exact(self, crew_roles):
        r = [i for i in crew_roles["items"] if _role_key(i.get("label", "")) == "radio operator"]
        assert r and r[0]["briefing"] == RADIO
        assert len(r[0]["briefing"].split("\n")) == 6

    def test_template_matches_seed(self, crew_roles):
        mism = [i["label"] for i in crew_roles["items"] if i.get("briefing") and _role_key(i["label"]) in SAFETY_BRIEFINGS
                and SAFETY_BRIEFINGS[_role_key(i["label"])] != i["briefing"]]
        print("template != seed:", mism)

    def test_one_bullet_per_sentence(self, crew_roles):
        # no line should contain a second sentence start (". X") or "; "
        import re
        multi = [(i["label"], ln) for i in crew_roles["items"] if i.get("briefing") for ln in i["briefing"].split("\n")
                 if re.search(r"[.!?;]\s+[A-Z'\"(‘“]", ln)]
        print("lines with multiple sentences:", multi)
        assert not multi


class TestSeed:
    def test_seed_43_keys_bulleted(self):
        assert len(SAFETY_BRIEFINGS) == 43
        assert all(_ok(v) for v in SAFETY_BRIEFINGS.values())

    def test_as_bullets_idempotent(self):
        assert all(as_bullets(v) == v for v in SAFETY_BRIEFINGS.values())


class TestMigration:
    def test_migration_recorded_once(self, db):
        assert db.migrations.count_documents({"_id": "role_briefing_bullets_v2"}) == 1

    def test_restart_log_ran_once(self):
        import glob
        n = 0
        for f in glob.glob("/var/log/supervisor/backend*.log"):
            n += open(f, errors="ignore").read().count("Role briefings as bullets")
        print("migration log lines:", n)
        assert n <= 2  # v1 + v2 ran in preview; prod runs v2 only


class TestHashes:
    def test_hash_same_paragraph_and_bullets(self):
        for v in SAFETY_BRIEFINGS.values():
            para = _flat(v)
            assert brief_hash(para) == brief_hash(v)
            assert as_bullets(para) == v  # words preserved round trip

    def test_brief_read_old_method(self):
        for v in SAFETY_BRIEFINGS.values():
            para = _flat(v)
            old = hashlib.sha256(para.strip().encode()).hexdigest()[:16]
            assert brief_read(old, v), v[:40]
            assert brief_read(old, para)
            assert not brief_read("", v)
            assert not brief_read("deadbeefdeadbeef", v)


class TestBoats:
    def test_boat_defaults_bulleted(self, db):
        defaults = {_flat(v) for v in SAFETY_BRIEFINGS.values()}
        untouched_para, custom = [], 0
        from templates import CREW_ROLES_NAME
        for b in db.user_boats.find({"registry.name": {"$regex": r"^\s*crew roles\s*$", "$options": "i"}}, {"registry": 1, "data": 1, "user_id": 1}):
            lid = next((r["id"] for r in b.get("registry") or [] if CREW_ROLES_NAME.match(str(r.get("name", "")))), None)
            for i in (b.get("data") or {}).get(lid) or []:
                br = i.get("briefing")
                if not br:
                    continue
                if _flat(br) in defaults:
                    if as_bullets(br) != br:
                        untouched_para.append((b.get("user_id"), i.get("label")))
                else:
                    custom += 1
        print("custom briefings left:", custom)
        assert not untouched_para, untouched_para[:10]
