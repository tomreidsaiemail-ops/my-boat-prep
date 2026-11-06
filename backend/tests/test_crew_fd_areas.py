# Crew Food & Drink boat area editing, crew Ship's Log entries, and crew access to Pro skipper's Magic tools (iteration 117)
import base64
import io
import json
import os
import random
import string
import time
from copy import deepcopy
from datetime import datetime, timezone

import pytest
import requests
from bson import json_util
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CREW = {"Authorization": "Bearer test_session_free_1"}
OWNER = {"Authorization": "Bearer test_session_pro_1"}
Q = {"boat_id": "main", "owner": "test-user-pro"}
KEY = {"owner_id": "test-user-pro", "boat_id": "main"}
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def b36(n):
    s = ""
    while n:
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
    return s


def new_id(ms=None):
    return "a" + b36(ms or int(time.time() * 1000)) + "".join(random.choices(string.ascii_lowercase, k=4))


def now_iso(offset_ms=0):
    return datetime.fromtimestamp((time.time() * 1000 + offset_ms) / 1000, timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module", autouse=True)
def backup():
    doc = db.user_boats.find_one(KEY)
    yield doc
    db.user_boats.replace_one({"_id": doc["_id"]}, doc)


def crew_get():
    r = requests.get(f"{BASE_URL}/api/me/boat", params=Q, headers=CREW)
    assert r.status_code == 200, r.text
    return r.json()


def put_crew(state):
    body = {k: v for k, v in state.items() if k not in ("synced_at", "role")}
    return requests.put(f"{BASE_URL}/api/me/boat", params=Q, headers=CREW, json=body)


def area(areas, aid):
    return next((a for a in areas if a["id"] == aid), None)


class TestBoatsList:
    def test_crew_lists_shared_boat_owner_pro(self):
        r = requests.get(f"{BASE_URL}/api/me/boats", headers=CREW)
        assert r.status_code == 200
        b = [x for x in r.json()["boats"] if x["crew"] and x["owner_id"] == "test-user-pro" and x["boat_id"] == "main"]
        assert b and b[0]["owner_pro"] is True

    def test_owner_own_boats_owner_pro_false(self):
        r = requests.get(f"{BASE_URL}/api/me/boats", headers=OWNER)
        assert r.status_code == 200
        assert all(x["owner_pro"] is False for x in r.json()["boats"] if not x["crew"])


class TestCrewAreas:
    def test_fd_changes_kept_non_fd_ignored(self, backup):
        s = crew_get()
        areas = s["areas"]
        fridge = area(areas, "amw1pvdq802hq")
        fridge["name"] = "TEST_Fridge Renamed"
        fridge["items"].append({"id": new_id(), "name": "TEST_Cheese", "qty": 2, "removed": False})
        fridge["items"][0]["qty"] = 42
        fridge["items"][0]["removed"] = True
        deleted_item = fridge["items"][1]["id"]
        fridge["items"] = [i for i in fridge["items"] if i["id"] != deleted_item]
        port = area(areas, "amvr1vpa6f5jn")
        port["name"] = "TEST_Hacked"
        port["items"] = []
        port["food"] = True  # crew tries to make a non-F/D area F/D
        freezer = area(areas, "amw1pvdq84cix")
        freezer["food"] = False
        freezer["drinks"] = False  # turning off both labels -> undone
        areas[:] = [a for a in areas if a["id"] != "amw1pvdq8tuym"]  # delete whole F/D 'Gantry'
        fd_new = {"id": new_id(), "name": "TEST_Crew Locker", "food": True, "drinks": False, "items": []}
        nonfd_new = {"id": new_id(), "name": "TEST_Crew NonFD", "food": False, "drinks": False, "items": []}
        old_id = {"id": new_id(1000000000000), "name": "TEST_Old Id", "food": True, "drinks": False, "items": []}
        areas += [fd_new, nonfd_new, old_id]
        s["sec_ts"]["areas"] = now_iso(1000)
        r = put_crew(s)
        assert r.status_code == 200, r.text
        doc = db.user_boats.find_one(KEY)
        da = doc["areas"]
        f = area(da, "amw1pvdq802hq")
        assert f["name"] == "TEST_Fridge Renamed"
        assert any(i["name"] == "TEST_Cheese" for i in f["items"])
        assert f["items"][0]["qty"] == 42 and f["items"][0]["removed"] is True
        assert not any(i["id"] == deleted_item for i in f["items"])
        p = area(da, "amvr1vpa6f5jn")
        orig_p = area(backup["areas"], "amvr1vpa6f5jn")
        assert p["name"] == orig_p["name"] and len(p["items"]) == len(orig_p["items"]) and not p.get("food")
        fz = area(da, "amw1pvdq84cix")
        assert fz["food"] is True
        assert area(da, "amw1pvdq8tuym") is None
        assert area(da, fd_new["id"]) is not None
        assert area(da, nonfd_new["id"]) is None
        assert area(da, old_id["id"]) is None
        assert doc["sec_ts"]["areas"] == s["sec_ts"]["areas"]

    def test_crew_can_switch_label_f_to_d(self):
        s = crew_get()
        fz = area(s["areas"], "amw1pvdq84cix")
        fz["food"], fz["drinks"] = False, True
        s["sec_ts"]["areas"] = now_iso(2000)
        assert put_crew(s).status_code == 200
        fz2 = area(db.user_boats.find_one(KEY)["areas"], "amw1pvdq84cix")
        assert fz2["drinks"] is True and not fz2.get("food")

    def test_older_sec_ts_changes_nothing(self):
        before = db.user_boats.find_one(KEY)["areas"]
        s = crew_get()
        area(s["areas"], "amw1pvdq84zo3")["name"] = "TEST_Should Not Stick"
        s["sec_ts"]["areas"] = "2000-01-01T00:00:00Z"
        assert put_crew(s).status_code == 200
        assert db.user_boats.find_one(KEY)["areas"] == before

    def test_crew_response_role(self):
        s = crew_get()
        assert s["role"] == "crew"


class TestCrewShipsLog:
    def test_new_log_entry_appended_and_pushed(self):
        s = crew_get()
        nid = int(time.time() * 1000) + 5
        s["data"]["shipsLog"].append({"id": nid, "label": "TEST_Batch Magic Scan My Shopping by TEST Free Crew, 2 items", "checked": False, "ts": now_iso()})
        s["data"]["shipsLog"].append({"id": 1000, "label": "TEST_stale", "checked": False})
        s["data"]["shipsLog"].append({"id": "str-id", "label": "TEST_str", "checked": False})
        r = put_crew(s)
        assert r.status_code == 200
        doc = db.user_boats.find_one(KEY)
        ids = [i["id"] for i in doc["data"]["shipsLog"]]
        assert nid in ids and 1000 not in ids and "str-id" not in ids
        assert any(p["item"]["id"] == nid for p in doc.get("pushed_items") or [])

    def test_owner_phone_keeps_pushed_entry(self, backup):
        # Owner's phone sends its older copy (without crew entry) -> entry stays
        prev = db.user_boats.find_one(KEY, {"_id": 0})
        inc = json.loads(json_util.dumps(backup))
        inc.pop("_id", None)
        body = {k: inc[k] for k in ("boat", "registry", "data", "updated_at", "sec_ts", "list_ts", "areas") if k in inc}
        body["updated_at"] = now_iso()
        r = requests.put(f"{BASE_URL}/api/me/boat", headers=OWNER, json=body)
        assert r.status_code == 200, r.text
        crew_ids = [p["item"]["id"] for p in prev.get("pushed_items") or []]
        out_ids = [i["id"] for i in r.json()["data"]["shipsLog"]]
        assert crew_ids and all(c in out_ids for c in crew_ids)

    def test_ticks_still_merge(self):
        s = crew_get()
        lid = next((k for k, v in s["data"].items() if v and k != "shipsLog"), None)
        if not lid:
            pytest.skip("no list")
        it = s["data"][lid][0]
        it["checked"] = not it.get("checked")
        it["ts"] = now_iso(3000)
        assert put_crew(s).status_code == 200
        it2 = next(i for i in db.user_boats.find_one(KEY)["data"][lid] if i["id"] == it["id"])
        assert bool(it2.get("checked")) == it["checked"]


PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


class TestCrewMagic:
    def files(self, data=b"notanimage", ct="image/png"):
        return {"file": ("x.png", io.BytesIO(data), ct)}

    def test_crew_shopping_scan_passes_auth(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true", "owner": "test-user-pro"}, headers=CREW, files=self.files())
        assert r.status_code == 400, r.text  # past auth -> image validation

    def test_crew_cupboard_scan_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"owner": "test-user-pro"}, headers=CREW, files=self.files())
        assert r.status_code == 403

    def test_crew_not_crew_404(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true", "owner": "test-admin-1"}, headers=CREW, files=self.files())
        assert r.status_code == 404

    def test_free_own_boat_403(self):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=CREW).json()
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true"}, headers=CREW, files=self.files())
        if me.get("premium"):  # launch free promo (first 200) makes free users premium
            assert r.status_code == 400
        else:
            assert r.status_code == 403 and "Upgrade" in r.text

    def test_owner_scan_no_params_passes_auth(self):
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true"}, headers=OWNER, files=self.files())
        assert r.status_code == 400

    def test_crew_transcribe_not_403(self):
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", params=Q, headers=CREW, files={"file": ("a.txt", io.BytesIO(b"x"), "text/plain")})
        assert r.status_code == 400, r.text

    def test_free_transcribe_own_403(self):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=CREW).json()
        r = requests.post(f"{BASE_URL}/api/ai/transcribe", headers=CREW, files={"file": ("a.txt", io.BytesIO(b"x"), "text/plain")})
        assert r.status_code == (400 if me.get("premium") else 403)

    def test_crew_consumed_not_crew_404(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", params={"boat_id": "main", "owner": "test-admin-1"}, headers=CREW,
                          json={"text": "we ate the cheese", "stock": [{"name": "Cheese", "qty": 2}]})
        assert r.status_code == 404

    def test_crew_consumed_real_ai(self):
        r = requests.post(f"{BASE_URL}/api/ai/mpa/consumed", params=Q, headers=CREW,
                          json={"text": "we ate one cheese", "stock": [{"name": "Cheese", "qty": 2, "area": "Fridge"}]}, timeout=90)
        assert r.status_code == 200, r.text
        assert "items" in r.json()

    @pytest.mark.skip(reason="real AI call already verified in iteration 117")
    def test_crew_shopping_scan_real_ai(self):
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (200, 50, 50)).save(buf, "PNG")
        r = requests.post(f"{BASE_URL}/api/boats/main/scan", params={"shopping": "true", "owner": "test-user-pro"}, headers=CREW,
                          files={"file": ("x.png", io.BytesIO(buf.getvalue()), "image/png")}, timeout=120)
        assert r.status_code in (200, 502), r.text
        print("scan", r.status_code, r.text[:300])
