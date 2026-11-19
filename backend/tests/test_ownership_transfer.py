# Transfer ownership: buyer request, checklist, status, sell (409/400/200), buyer copy contents, notices, 410 guard.
import os
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SELLER = {"Authorization": "Bearer test_session_pro_1"}
BUYER = {"Authorization": "Bearer test_session_free_1"}
BOAT_ID = "tsellapi"
VESSEL = "TEST_SellBoatAPI"
REDACTED = "XXXXXXXXXX"


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


async def _db_op(fn):
    cli = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        return await fn(cli[os.environ['DB_NAME']])
    finally:
        cli.close()


async def _make_boat(db):
    src = await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
    src.pop("_id")
    src["boat_id"] = BOAT_ID
    src["boat"] = {**src.get("boat", {}), "vessel": VESSEL}
    src["registry"] = src["registry"] + [{"id": "custom_cprep1", "name": "Crew Prep - TEST Free Crew"},
                                         {"id": "transferOwnership", "name": "Transfer ownership"},
                                         {"id": "custom_tripx", "name": "Route Planning - 9", "trip": True}]
    data = src["data"]
    data["custom_cprep1"] = [{"id": 1, "label": "x", "checked": False}]
    data["transferOwnership"] = [{"id": 1, "label": "x", "checked": False}]
    data["custom_tripx"] = [{"id": 1, "label": "x", "checked": False}]
    data["shipsLog"] = (data.get("shipsLog") or []) + [{"id": 999001, "label": "TEST Free Crew took the helm, Beta Crew cooked", "checked": False}]
    data["routeHazards"] = [{**i, "checked": True} for i in data.get("routeHazards") or []] or [{"id": 1, "label": "h", "checked": True}]
    src["areas"] = (src.get("areas") or []) + [
        {"id": "tbox_infridge", "name": "TEST_Box In Fridge", "parent_id": "amw1pvdq802hq", "items": [{"id": "bi1", "name": "TEST_Opener"}]},
        {"id": "tcup_nav", "name": "TEST_Nav Station", "items": [{"id": "n1", "name": "TEST_Dividers"}]},
    ]
    await db.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": BOAT_ID})
    await db.user_boats.insert_one(src)


async def _cleanup(db):
    await db.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": BOAT_ID})
    await db.user_boats.delete_many({"owner_id": "test-user-free", "transferred.vessel": VESSEL})
    await db.user_notices.delete_many({"user_id": "test-user-free", "text": {"$regex": VESSEL}})
    await db.boat_transfers.delete_many({"vessel_key": VESSEL.lower()})
    await db.ownership_requests.delete_many({"boat_key": VESSEL.lower()})


@pytest.fixture(scope="module", autouse=True)
def seller_boat():
    asyncio.run(_db_op(_cleanup))
    asyncio.run(_db_op(_make_boat))
    yield
    asyncio.run(_db_op(_cleanup))


class TestOwnership:
    def test_checklist(self):
        r = requests.get(f"{BASE_URL}/api/ownership/checklist", headers=SELLER)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 14, items
        assert all(isinstance(i, str) and i for i in items)

    def test_request_own_email_400(self):
        r = requests.post(f"{BASE_URL}/api/ownership/requests", headers=BUYER, json={"boat_name": VESSEL, "owner_email": "test.user.free@example.com"})
        assert r.status_code == 400

    def test_request_bad_email_422(self):
        r = requests.post(f"{BASE_URL}/api/ownership/requests", headers=BUYER, json={"boat_name": VESSEL, "owner_email": "nope"})
        assert r.status_code == 422

    def test_sell_without_request_409(self):
        r = requests.post(f"{BASE_URL}/api/ownership/sell", headers=SELLER, params={"boat_id": BOAT_ID}, json={"checklist_received": True, "exported": True})
        assert r.status_code == 409, r.text

    def test_status_none(self):
        r = requests.get(f"{BASE_URL}/api/ownership/status", headers=SELLER, params={"boat_id": BOAT_ID})
        assert r.status_code == 200 and r.json()["request"] is None

    def test_request_and_list(self):
        # case/space-insensitive name, gmail-ish email case
        r = requests.post(f"{BASE_URL}/api/ownership/requests", headers=BUYER, json={"boat_name": "  test_sellboatapi ", "owner_email": "Test.User.Pro@Example.com"})
        assert r.status_code == 200 and r.json()["ok"] is True
        r2 = requests.post(f"{BASE_URL}/api/ownership/requests", headers=BUYER, json={"boat_name": VESSEL, "owner_email": "test.user.pro@example.com"})
        assert r2.status_code == 200
        rows = requests.get(f"{BASE_URL}/api/ownership/requests", headers=BUYER).json()["requests"]
        mine = [x for x in rows if x["boat_name"].strip().lower() == VESSEL.lower()]
        assert len(mine) == 1, mine  # upsert, no duplicate
        assert mine[0]["status"] == "pending"

    def test_status_shows_request(self):
        r = requests.get(f"{BASE_URL}/api/ownership/status", headers=SELLER, params={"boat_id": BOAT_ID})
        req = r.json()["request"]
        assert req and req["buyer_email"] == "test.user.free@example.com"

    def test_status_other_user_404(self):
        r = requests.get(f"{BASE_URL}/api/ownership/status", headers=BUYER, params={"boat_id": BOAT_ID})
        assert r.status_code in (403, 404)

    def test_sell_without_ticks_400(self):
        for body in ({"checklist_received": False, "exported": True}, {"checklist_received": True, "exported": False}):
            r = requests.post(f"{BASE_URL}/api/ownership/sell", headers=SELLER, params={"boat_id": BOAT_ID}, json=body)
            assert r.status_code == 400

    def test_sell_and_buyer_copy(self):
        r = requests.post(f"{BASE_URL}/api/ownership/sell", headers=SELLER, params={"boat_id": BOAT_ID}, json={"checklist_received": True, "exported": True}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["buyer_email"] == "test.user.free@example.com"

        async def check(db):
            assert await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": BOAT_ID}) is None
            b = await db.user_boats.find_one({"owner_id": "test-user-free", "transferred.vessel": VESSEL})
            assert b, "buyer boat missing"
            assert b["boat"]["vessel"] == VESSEL
            assert b["crew"] == []
            assert not b.get("crew_names") and not b.get("shore") and not b.get("crew_roles")
            ids = [l["id"] for l in b["registry"]]
            names = [l.get("name", "") for l in b["registry"]]
            assert "transferOwnership" not in ids and "transferOwnership" not in b["data"]
            assert not any(n.lower().startswith("crew prep -") for n in names)
            assert not any(l.get("trip") for l in b["registry"])
            assert all(not i.get("checked") for i in b["data"].get("routeHazards") or [])
            log = " ".join(str(i.get("label")) for i in b["data"].get("shipsLog") or [])
            assert "TEST Free Crew" not in log and "Beta Crew" not in log and REDACTED in log
            areas = {a["id"]: a for a in b["areas"]}
            assert areas["amw1pvdq802hq"]["items"] == []  # Fridge (food)
            assert areas["test_gantry1"]["items"] == []  # drinks flag
            assert areas["tbox_infridge"]["items"] == []  # box inside F&D
            assert len(areas["tcup_nav"]["items"]) == 1  # non-F&D kept
            assert len(areas["amvr1vpa6f5jn"]["items"]) >= 1
            return b["boat_id"]
        new_id = asyncio.run(_db_op(check))
        pytest.new_id = new_id

    def test_buyer_sees_boat_in_boats_list(self):
        r = requests.get(f"{BASE_URL}/api/me/boats", headers=BUYER)
        if r.status_code == 404:
            pytest.skip("no /api/me/boats")
        assert r.status_code == 200
        assert pytest.new_id in r.text

    def test_notices(self):
        r = requests.get(f"{BASE_URL}/api/me/notices", headers=BUYER)
        assert r.status_code == 200
        ns = [n for n in r.json()["notices"] if VESSEL in n["text"]]
        assert len(ns) == 1 and ns[0]["boat_id"] == pytest.new_id
        nid = ns[0]["notice_id"]
        assert requests.post(f"{BASE_URL}/api/me/notices/{nid}/seen", headers=BUYER).status_code == 200
        ns2 = [n for n in requests.get(f"{BASE_URL}/api/me/notices", headers=BUYER).json()["notices"] if VESSEL in n["text"]]
        assert ns2 == []

    def test_request_done(self):
        rows = requests.get(f"{BASE_URL}/api/ownership/requests", headers=BUYER).json()["requests"]
        mine = [x for x in rows if x["boat_name"].strip().lower() == VESSEL.lower()]
        assert mine and mine[0]["status"] == "done"

    def test_seller_resync_410(self):
        r = requests.get(f"{BASE_URL}/api/me/boat", headers=SELLER, params={"boat_id": "main"})
        assert r.status_code == 200
        body = r.json()
        body["boat"]["vessel"] = VESSEL
        r2 = requests.put(f"{BASE_URL}/api/me/boat", headers=SELLER, params={"boat_id": BOAT_ID}, json=body)
        assert r2.status_code == 410, r2.status_code
        async def gone(db):
            return await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": BOAT_ID})
        assert asyncio.run(_db_op(gone)) is None
