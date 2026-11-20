# Transfer ownership v2: multiple buyers (pick one), sale Ship's Log entry (tz), unpicked request deleted, handover pack email body.
import os
import re
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SELLER = {"Authorization": "Bearer test_session_pro_1"}
FREE = {"Authorization": "Bearer test_session_free_1"}
BETA = {"Authorization": "Bearer test_session_beta_1"}
BOAT_ID = "tsellmb"
VESSEL = "TEST_SellBoatMB"
BOAT_ID2 = "tsellmb2"
VESSEL2 = "TEST_SellBoatMB2"


async def _db_op(fn):
    cli = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        return await fn(cli[os.environ['DB_NAME']])
    finally:
        cli.close()


async def _make(db, boat_id, vessel):
    src = await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"})
    src.pop("_id")
    src["boat_id"] = boat_id
    src["boat"] = {**src.get("boat", {}), "vessel": vessel}
    src["registry"] = src["registry"] + [{"id": "transferOwnership", "name": "Transfer ownership"}]
    src["data"]["transferOwnership"] = [{"id": 1, "label": "x", "checked": False}]
    src["engine_log"] = [{"date": "2025-01-02", "hours": 120, "engine_type": "Inboard", "items": ["Oil change"], "notes": "TEST"}]
    await db.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": boat_id})
    await db.user_boats.insert_one(src)


async def _setup(db):
    await _make(db, BOAT_ID, VESSEL)
    await _make(db, BOAT_ID2, VESSEL2)


async def _cleanup(db):
    for bid, v in ((BOAT_ID, VESSEL), (BOAT_ID2, VESSEL2)):
        await db.user_boats.delete_many({"owner_id": "test-user-pro", "boat_id": bid})
        await db.user_boats.delete_many({"owner_id": {"$in": ["test-user-free", "test-user-beta"]}, "transferred.vessel": v})
        await db.user_notices.delete_many({"user_id": {"$in": ["test-user-free", "test-user-beta"]}, "text": {"$regex": v}})
        await db.boat_transfers.delete_many({"seller_id": "test-user-pro", "boat_id": bid})
        await db.ownership_requests.delete_many({"boat_key": v.lower()})


@pytest.fixture(scope="module", autouse=True)
def boats():
    asyncio.run(_db_op(_cleanup))
    asyncio.run(_db_op(_setup))
    yield
    asyncio.run(_db_op(_cleanup))


def _sell(boat_id, **extra):
    return requests.post(f"{BASE_URL}/api/ownership/sell", headers=SELLER, params={"boat_id": boat_id},
                         json={"checklist_received": True, "exported": True, **extra}, timeout=60)


class TestMultiBuyer:
    def test_two_requests_status(self):
        for h in (FREE, BETA):
            r = requests.post(f"{BASE_URL}/api/ownership/requests", headers=h, json={"boat_name": VESSEL, "owner_email": "test.user.pro@example.com"})
            assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/ownership/status", headers=SELLER, params={"boat_id": BOAT_ID})
        assert r.status_code == 200
        reqs = r.json()["requests"]
        assert len(reqs) == 2
        assert set(reqs[0].keys()) == {"request_id", "buyer_name", "buyer_email", "created_at"}
        assert {x["buyer_email"] for x in reqs} == {"test.user.free@example.com", "test.user.beta@example.com"}
        assert reqs[0]["created_at"] <= reqs[1]["created_at"]
        pytest.reqs = {x["buyer_email"]: x["request_id"] for x in reqs}

    def test_sell_no_pick_409(self):
        r = _sell(BOAT_ID)
        assert r.status_code == 409
        assert "Pick the new owner first" in r.json()["detail"]

    def test_sell_bogus_pick_409(self):
        r = _sell(BOAT_ID, request_id="0" * 32)
        assert r.status_code == 409

    def test_sell_bad_request_id_422(self):
        r = _sell(BOAT_ID, request_id="nothex")
        assert r.status_code == 422

    def test_sell_with_pick_nz(self):
        rid_beta = pytest.reqs["test.user.beta@example.com"]
        rid_free = pytest.reqs["test.user.free@example.com"]
        r = _sell(BOAT_ID, request_id=rid_beta, tz="Pacific/Auckland")
        assert r.status_code == 200, r.text
        assert r.json()["buyer_email"] == "test.user.beta@example.com"

        async def check(db):
            assert await db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": BOAT_ID}) is None
            assert await db.user_boats.find_one({"owner_id": "test-user-free", "transferred.vessel": VESSEL}) is None
            b = await db.user_boats.find_one({"owner_id": "test-user-beta", "transferred.vessel": VESSEL})
            assert b
            last = b["data"]["shipsLog"][-1]["label"]
            assert await db.ownership_requests.find_one({"request_id": rid_free}) is None  # deleted
            done = await db.ownership_requests.find_one({"request_id": rid_beta})
            assert done and done["status"] == "done"
            return last
        last = asyncio.run(_db_op(check))
        print("LAST LOG:", last)
        assert last.startswith("Boat sold to new owner on ")
        assert re.match(r"^Boat sold to new owner on [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$", last), last
        assert "Test" not in last and "@" not in last

    def test_unpicked_buyer_has_no_request(self):
        rows = requests.get(f"{BASE_URL}/api/ownership/requests", headers=FREE).json()["requests"]
        assert not [x for x in rows if x["boat_name"].strip().lower() == VESSEL.lower()]

    def test_single_request_no_pick(self):
        r = requests.post(f"{BASE_URL}/api/ownership/requests", headers=FREE, json={"boat_name": VESSEL2, "owner_email": "test.user.pro@example.com"})
        assert r.status_code == 200
        r = _sell(BOAT_ID2, tz="Bogus/Zone")  # invalid tz falls back to UTC, no 500
        assert r.status_code == 200, r.text
        assert r.json()["buyer_email"] == "test.user.free@example.com"

        async def check(db):
            b = await db.user_boats.find_one({"owner_id": "test-user-free", "transferred.vessel": VESSEL2})
            return b["data"]["shipsLog"][-1]["label"]
        assert asyncio.run(_db_op(check)).startswith("Boat sold to new owner on ")


class TestHandoverPack:
    def test_pack_order(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from handover import handover_pack
        import db as dbmod

        async def go():
            # rebind motor client to this loop
            cli = AsyncIOMotorClient(os.environ['MONGO_URL'])
            dbmod.db = cli[os.environ['DB_NAME']]
            import handover
            handover.db = dbmod.db
            doc = await dbmod.db.user_boats.find_one({"owner_id": "test-user-pro", "boat_id": "main"}, {"_id": 0})
            doc = {**doc, "engine_log": [{"date": "2025-01-02", "hours": 120, "items": ["Oil change"]}]}
            out = await handover_pack(doc, "Seller", "Mon 5 Jan 2026, 10:00", "https://x")
            cli.close()
            return out
        subject, body = asyncio.run(go())
        assert subject.startswith("Welcome aboard ")
        i_glance, i_zones, i_maint = body.find("At a glance"), body.find("Zones and cupboards"), body.find("Maintenance history")
        assert 0 < i_glance < i_zones < i_maint
        for k in ("Zones", "Cupboards", "Boxes and folders", "Items in the inventory", "Maintenance log entries", "Maintenance lists", "Ship&#x27;s Log entries"):
            assert k in body
        assert "Engine service log (1)" in body
        assert "Mon 5 Jan 2026, 10:00" in body
