# Helper: configure test-admin-1/main Route Plan scenarios for iteration_168 (restore from /tmp/admin_main_bak_168.json after)
import sys
import json
from datetime import date, timedelta, datetime, timezone
from pymongo import MongoClient

db = MongoClient("mongodb://localhost:27017")["test_database"]
KEY = {"owner_id": "test-admin-1", "boat_id": "main"}
T = date.today()
Y, TM = T - timedelta(days=1), T + timedelta(days=1)


def w(day, t="10:00", dep=None):
    out = {"event_at": f"{day}T{t}" if day else "", "depart_at": f"{dep or day}T{t}" if (dep or day) else ""}
    return out


def setup(sc):
    d = db.user_boats.find_one(KEY)
    reg = [r for r in d["registry"] if not r["id"].startswith("custom_TEST")]
    i = next(k for k, r in enumerate(reg) if r["id"] == "routeHazards")
    reg[i + 1:i + 1] = [{"id": "custom_TESTa", "name": "Route Planning TESTa"}, {"id": "custom_TESTb", "name": "Route Planning TESTb"}]
    data = d["data"]
    data.setdefault("custom_TESTa", [])
    data.setdefault("custom_TESTb", [])
    b = d["boat"]
    base = b.get("weather") or {}
    if sc == "A":  # only TESTa today
        ws = (w(str(Y)), w(str(T)), w(str(TM)))
    elif sc == "B":  # all three start today; TESTb departs earliest 07:30, TESTa 08:00, default 09:00
        ws = ({"event_at": f"{T}T06:00", "depart_at": f"{T}T09:00"}, {"event_at": f"{T}T06:00", "depart_at": f"{T}T08:00"}, {"event_at": f"{T}T06:00", "depart_at": f"{T}T07:30"})
    elif sc == "C":  # none today
        ws = (w(str(Y)), w(str(TM)), {})
    elif sc == "D":  # TESTa today, default no start, TESTb tomorrow
        ws = ({}, w(str(T)), w(str(TM)))
    elif sc == "F":  # fallback: no event_at, depart_at today on TESTb only
        ws = (w(str(Y)), w(str(TM)), {"depart_at": f"{T}T11:00"})
    b["weather"] = {**{k: v for k, v in base.items() if k not in ("event_at", "depart_at")}, **ws[0]}
    b["trips"] = {"custom_TESTa": {"route_start": "TEST Mana", "route_dest": "TEST Picton", "weather": ws[1]},
                  "custom_TESTb": {"route_start": "TEST Kapiti", "route_dest": "TEST Nelson", "weather": ws[2]}}
    b["vessel"], b["callsign"] = "TEST_Vessel", "TESTCS"
    b["underway"] = {}
    b["depart"] = {}
    rt = sys.argv[2] if len(sys.argv) > 2 else ""
    b["route_trip"] = rt
    b["route_trip_day"] = sys.argv[3] if len(sys.argv) > 3 else ""
    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    db.user_boats.update_one(KEY, {"$set": {"registry": reg, "data": data, "boat": b, "updated_at": now}})
    print(json.dumps({"today": str(T), "sc": sc, "weather": b["weather"], "trips": b["trips"], "rt": rt, "rtd": b["route_trip_day"]}))


if __name__ == "__main__":
    if sys.argv[1] == "show":
        b = db.user_boats.find_one(KEY)["boat"]
        print(json.dumps({k: b.get(k) for k in ("route_trip", "route_trip_day", "underway")}, default=str))
    else:
        setup(sys.argv[1])
