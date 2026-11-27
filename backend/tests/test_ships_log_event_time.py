# Ship's Log event time: log_when / render_items(log=True) / email HTML + PDF, and the ships_log_prompt_v1 migration.
import os
import sys
import asyncio
import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ship_log import log_when, render_items, build_email_html, build_pdf, _logged_at  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
CTX = {"vessel": "V", "callsign": "ZM1", "position": "P", "local_date": "28 Nov 2026", "pob": 2, "mmsi": ""}


class TestLogWhen:
    def test_same_times_event_only(self):
        it = {"id": 1764300000000, "label": "Dolphins", "logged_at": "2026-11-28T01:00:00.000Z", "event_at": "2026-11-28T01:00:00.000Z"}
        assert log_when(it) == "Event: Sat 28 Nov 2026, 1:00 AM"

    def test_moved_event_shows_entry_made(self):
        it = {"label": "x", "logged_at": "2026-11-28T01:00:00.000Z", "event_at": "2026-11-27T22:30:00.000Z"}
        assert log_when(it, "Pacific/Auckland") == "Event: Sat 28 Nov 2026, 11:30 AM · Entry made: Sat 28 Nov 2026, 2:00 PM"

    def test_bad_tz_falls_back_to_utc(self):
        it = {"label": "x", "logged_at": "2026-11-28T01:00:00.000Z"}
        assert log_when(it, "Not/AZone") == "Event: Sat 28 Nov 2026, 1:00 AM"

    def test_ts_and_numeric_ids(self):
        assert log_when({"ts": "2026-11-04T07:53:24.343980+00:00"}).startswith("Event: Wed 4 Nov 2026, 7:53 AM")
        assert _logged_at({"id": 1764291600000}).startswith("2025-11-28") or _logged_at({"id": 1764291600000})
        assert _logged_at({"id": 1764291600000 * 1000 + 123}) == _logged_at({"id": 1764291600000})

    def test_no_time_for_folders_prompt_small_ids(self):
        assert log_when({"id": 1764291600000, "folder": True}) == ""
        assert log_when({"id": 1, "dynamic": "logPrompt", "label": "Record any noteworthy event, or observation"}) == ""
        assert log_when({"id": 2, "label": "Fuel"}) == ""
        assert log_when({"id": True}) == ""

    def test_garbage_event_at(self):
        assert log_when({"logged_at": "nonsense"}) == ""


class TestRender:
    items = [
        {"id": 1, "dynamic": "logPrompt", "label": "Record any noteworthy event, or observation"},
        {"id": 1764291600000, "folder": True, "label": "Passage"},
        {"id": 1764291600001, "in": 1764291600000, "label": "Stopped for an hour to observe dolphins",
         "logged_at": "2026-11-28T01:00:00.000Z", "event_at": "2026-11-27T23:00:00.000Z"},
    ]

    def test_render_log_flag(self):
        r = render_items(self.items, {**CTX, "tz": "UTC"}, log=True)
        assert r[0]["label"] == "Record any noteworthy event, or observation" and "when" not in r[0]
        assert "when" not in r[1]
        assert r[2]["when"] == "Event: Fri 27 Nov 2026, 11:00 PM · Entry made: Sat 28 Nov 2026, 1:00 AM"

    def test_render_without_log_flag(self):
        assert all("when" not in i for i in render_items(self.items, CTX))

    def test_email_and_pdf(self):
        r = render_items(self.items, {**CTX, "tz": "UTC"}, log=True)
        log = {**CTX, "skipper": "S", "boat_type": "", "lists": [{"name": "Ship's Log", "items": r}]}
        html = build_email_html(log, "https://x/y.pdf", "My Boat Prep")
        assert "Event: Fri 27 Nov 2026, 11:00 PM · Entry made: Sat 28 Nov 2026, 1:00 AM" in html
        assert "Departed" not in html
        pdf = build_pdf(log)
        assert pdf[:4] == b"%PDF" and len(pdf) > 1000


class TestMigration:
    def test_no_old_template_lines_left(self):
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

        async def run():
            db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            return (await db.user_boats.count_documents({"data.shipsLog.dynamic": "logDate"}),
                    await db.list_templates.count_documents({"items.dynamic": "logDate"}),
                    await db.migrations.find_one({"_id": "ships_log_prompt_v1"}))
        boats, tpls, mig = asyncio.run(run())
        assert boats == 0 and tpls == 0 and mig


class TestApi:
    def test_pro_boat_has_prompt(self):
        r = requests.get(f"{BASE_URL}/api/me/boat", cookies={"session_token": "test_session_pro_1"}, timeout=30)
        assert r.status_code == 200
        log = r.json()["data"]["shipsLog"]
        assert any(i.get("dynamic") == "logPrompt" and i["label"] == "Record any noteworthy event, or observation" for i in log)
        assert not any(i.get("dynamic") == "logDate" for i in log)

    def test_email_log_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/me/email-log", json={"local_date": "28 Nov 2026"}, timeout=30)
        assert r.status_code in (401, 403)
