# Model Vessel "clone on first login": copy creation, per-session recreate, master untouched, images by reference,
# free boat slot, non-skipper exclusions, admin wizard list.
import copy
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
MASTER_UID = "user_91424b2ef989"
SUF = uuid.uuid4().hex[:8]
CREATED_USERS, CREATED_TOKENS = [], []


def master_doc():
    d = db.user_boats.find_one({"owner_id": MASTER_UID, "boat_id": "main"})
    d.pop("_id", None)
    return d


MASTER_BEFORE = copy.deepcopy(master_doc())


def mk_user(tag, **extra):
    uid = f"TEST_mv_{tag}_{SUF}"
    db.users.insert_one({"user_id": uid, "email": f"test.mv.{tag}.{SUF}@example.com", "name": f"TEST {tag}", "picture": "",
                         "role": "free", "created_at": datetime.now(timezone.utc).isoformat(),
                         "tos_accepted_at": datetime.now(timezone.utc).isoformat(), "tos_version": "2026-06-magic50", **extra})
    CREATED_USERS.append(uid)
    return uid


def new_session(uid):
    tok = f"TEST_mv_sess_{uuid.uuid4().hex}"
    db.user_sessions.insert_one({"user_id": uid, "session_token": tok, "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
                                 "created_at": datetime.now(timezone.utc)})
    CREATED_TOKENS.append(tok)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for uid in CREATED_USERS:
        db.user_boats.delete_many({"owner_id": uid})
        db.deleted_boats.delete_many({"owner_id": uid})
        db.item_photos.delete_many({"owner_id": uid})
        db.item_files.delete_many({"owner_id": uid})
        db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_many({"session_token": {"$in": CREATED_TOKENS}})


def payload(vessel):
    return {"boat": {"vessel": vessel}, "registry": [], "data": {}, "updated_at": datetime.now(timezone.utc).isoformat()}


def model_in(resp):
    return [b for b in resp.json()["boats"] if b["boat_id"] == "model_vessel" and not b["crew"]]


# Skipper copy lifecycle (creation, same-session no-recreate, new-session recreate)
class TestCopyLifecycle:
    def test_lifecycle(self):
        uid = mk_user("skip", role="pro")
        s = new_session(uid)
        r = s.get(f"{BASE_URL}/api/me/boats")
        assert r.status_code == 200
        m = model_in(r)
        assert len(m) == 1 and m[0]["model"] is True and m[0]["vessel"] == "Model Vessel"
        # second call doesn't duplicate
        assert len(model_in(s.get(f"{BASE_URL}/api/me/boats"))) == 1
        # need a 2nd boat to be able to delete the model vessel
        r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=payload("TEST own"))
        assert r.status_code == 200, r.text
        r = s.delete(f"{BASE_URL}/api/me/boats/model_vessel")
        assert r.status_code == 200, r.text
        assert model_in(s.get(f"{BASE_URL}/api/me/boats")) == []
        # new session recreates
        s2 = new_session(uid)
        m = model_in(s2.get(f"{BASE_URL}/api/me/boats"))
        assert len(m) == 1 and m[0]["model"]


# Copy content equals master; images by reference; deletes on copy don't touch master
class TestCopyContent:
    def test_content_and_images(self):
        uid = mk_user("content", role="pro")
        s = new_session(uid)
        assert s.get(f"{BASE_URL}/api/me/boats").status_code == 200
        c = db.user_boats.find_one({"owner_id": uid, "boat_id": "model_vessel"}, {"_id": 0})
        m = master_doc()
        assert c["model"] is True and c["crew"] == []
        for f in ("registry", "data", "areas", "zone_maps", "area_photos"):
            assert c.get(f) == m.get(f), f
        assert c["boat"]["shore_email"] == ""
        for f in ("shore", "tracking", "charter", "crew_roles", "log_sent"):
            assert f not in c, f
        assert c["boat"]["vessel"] == "Model Vessel"
        # images by reference
        zm = c["zone_maps"][0]
        r = s.get(f"{BASE_URL}/api/boats/model_vessel/zone-maps/{zm['id']}")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/") and len(r.content) > 100
        ap = c["area_photos"][0]
        r = s.get(f"{BASE_URL}/api/boats/model_vessel/area-photos/{ap['id']}")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/") and len(r.content) > 100
        # delete zone map on copy
        r = s.delete(f"{BASE_URL}/api/boats/model_vessel/zone-maps/{zm['id']}")
        assert r.status_code == 200
        assert zm["id"] not in [z["id"] for z in r.json()["zone_maps"]]
        assert zm["id"] in [z["id"] for z in master_doc()["zone_maps"]]
        # remove the area photo reference on the copy (areas edit through PUT /me/boat)
        st = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "model_vessel"}).json()
        for a in st["areas"]:
            if isinstance(a.get("photo"), dict) and a["photo"].get("id") == ap["id"]:
                a["photo"] = None
            if a.get("photos"):
                a["photos"] = [x for x in a["photos"] if x.get("id") != ap["id"]]
        st["updated_at"] = datetime.now(timezone.utc).isoformat()
        rr = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "model_vessel"}, json=st)
        print("area photo removal PUT", rr.status_code)
        c2 = db.user_boats.find_one({"owner_id": uid, "boat_id": "model_vessel"}, {"_id": 0, "areas": 1})
        refs = [a for a in c2["areas"] if (isinstance(a.get("photo"), dict) and a["photo"].get("id") == ap["id"]) or any(x.get("id") == ap["id"] for x in a.get("photos") or [])]
        print("copy refs to photo after removal:", len(refs))
        mrefs = [a for a in master_doc()["areas"] if (isinstance(a.get("photo"), dict) and a["photo"].get("id") == ap["id"]) or any(x.get("id") == ap["id"] for x in a.get("photos") or [])]
        print("master refs:", len(mrefs))
        assert mrefs
        assert ap["id"] in [p["id"] for p in master_doc()["area_photos"]]


# Free-tier boat slot: Model Vessel doesn't count
class TestFreeSlot:
    def test_free_slot(self):
        # FIRST200 promo makes everyone premium; put this throwaway email on its exception list for the test only.
        import time
        uid = mk_user("free")
        email = f"test.mv.free.{SUF}@example.com"
        db.app_settings.update_one({"key": "first200"}, {"$addToSet": {"exceptions": email}})
        try:
            time.sleep(11)
            self._run(uid)
        finally:
            db.app_settings.update_one({"key": "first200"}, {"$pull": {"exceptions": email}})

    def _run(self, uid):
        s = new_session(uid)
        assert s.get(f"{BASE_URL}/api/auth/me").json().get("premium") is False
        assert len(model_in(s.get(f"{BASE_URL}/api/me/boats"))) == 1
        r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "main"}, json=payload("TEST first"))
        assert r.status_code == 200, r.text
        r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "third1"}, json=payload("TEST third"))
        assert r.status_code == 403, r.text
        # saving to the model vessel itself is fine for free user
        st = s.get(f"{BASE_URL}/api/me/boat", params={"boat_id": "model_vessel"}).json()
        st["updated_at"] = datetime.now(timezone.utc).isoformat()
        r = s.put(f"{BASE_URL}/api/me/boat", params={"boat_id": "model_vessel"}, json=st)
        assert r.status_code == 200, r.text


# Non-skippers get no copy
class TestNoCopy:
    def test_shore_only(self):
        uid = mk_user("shore", shore_only=True, home="shore")
        s = new_session(uid)
        r = s.get(f"{BASE_URL}/api/me/boats")
        assert r.status_code == 200 and model_in(r) == []
        assert not db.user_boats.find_one({"owner_id": uid, "boat_id": "model_vessel"})

    def test_crew_only(self):
        owner = mk_user("owner", role="pro")
        db.user_boats.insert_one({"owner_id": owner, "boat_id": "main", "boat": {"vessel": "TEST owner boat"}, "crew": [],
                                  "created_at": datetime.now(timezone.utc).isoformat()})
        crew = mk_user("crew")
        db.user_boats.update_one({"owner_id": owner, "boat_id": "main"}, {"$push": {"crew": crew}})
        s = new_session(crew)
        r = s.get(f"{BASE_URL}/api/me/boats")
        assert r.status_code == 200 and model_in(r) == []
        assert any(b["crew"] and b["owner_id"] == owner for b in r.json()["boats"])
        assert not db.user_boats.find_one({"owner_id": crew, "boat_id": "model_vessel"})

    def test_master_user_no_copy(self):
        assert not db.user_boats.find_one({"owner_id": MASTER_UID, "boat_id": "model_vessel"})


# Admin wizard list
class TestWizardList:
    def test_list(self):
        s = requests.Session()
        s.headers.update({"Authorization": "Bearer test_session_pro_1"})
        r = s.get(f"{BASE_URL}/api/admin-lists", params={"prefix": "Admin - Model Vessel"})
        assert r.status_code == 200, r.text
        data = r.json()
        lists = data if isinstance(data, list) else data.get("lists", data)
        w = [l for l in lists if l["name"] == "Admin - Model Vessel - Basic Introduction Walkthrough"]
        assert len(w) == 1 and len(w[0]["items"]) >= 6
        assert not [l for l in lists if "wizard instructions" in l["name"].lower()]
        assert w[0]["items"][0]["label"].startswith("Click on Vessel")


# Master untouched after all of the above (runs last alphabetically by class order in file)
class TestZMasterUnchanged:
    def test_master_unchanged(self):
        assert master_doc() == MASTER_BEFORE
