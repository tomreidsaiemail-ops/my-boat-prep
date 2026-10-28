# Tests: additional boat details (children, mmsi, units, dims, trip_days) + ship_log MMSI/children wording
import os
import sys
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"session_token": "test_session_pro_1"}
BOAT_ID = "TEST_bt_extra"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _state(boat):
    return {"boat": {"vessel": "TEST Vessel", "skipper": "Sk", "callsign": "ZM1", **boat},
            "registry": [{"id": "myTodo", "name": "My To Do List", "isSystem": True}], "data": {"myTodo": []},
            "updated_at": datetime.now(timezone.utc).isoformat()}


def _put(boat):
    return requests.put(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO, json=_state(boat))


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    requests.delete(f"{BASE_URL}/api/me/boats/{BOAT_ID}", cookies=PRO)


# PUT/GET persistence of new boat fields
class TestAdditionalDetails:
    def test_put_get_all_fields(self):
        boat = {"boat_type": "Yacht - Sloop", "pob": 4, "children": 2, "mmsi": "512345678", "units": "ft",
                "loa": "36.5", "beam": "11,25", "draft": "6", "mast_height": "52.75", "trip_days": 14}
        r = _put(boat)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/me/boat", params={"boat_id": BOAT_ID}, cookies=PRO)
        assert g.status_code == 200
        b = g.json()["boat"]
        assert b["children"] == 2 and b["mmsi"] == "512345678" and b["units"] == "ft"
        assert b["loa"] == "36.5" and b["beam"] == "11.25" and b["draft"] == "6" and b["mast_height"] == "52.75"
        assert b["trip_days"] == 14 and b["pob"] == 4

    def test_defaults(self):
        r = _put({})
        assert r.status_code == 200, r.text
        b = r.json()["boat"]
        assert b["children"] == 0 and b["mmsi"] == "" and b["units"] == "m"
        assert b["loa"] == "" and b["trip_days"] == 0

    @pytest.mark.parametrize("val,exp", [(-5, 0), (5000, 999), ("abc", 0), (None, 0), ("7", 7)])
    def test_children_trip_clamp(self, val, exp):
        r = _put({"children": val, "trip_days": val, "pob": 999})
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["children"] == min(exp, 998)
        assert r.json()["boat"]["trip_days"] == min(exp, 365)

    def test_mmsi_digits_only(self):
        r = _put({"mmsi": "51-23 45abc6789012"})
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["mmsi"] == "512345678"

    @pytest.mark.parametrize("u,exp", [("yards", "m"), ("", "m"), (None, "m"), ("ft", "ft"), ("m", "m")])
    def test_units(self, u, exp):
        r = _put({"units": u})
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["units"] == exp

    @pytest.mark.parametrize("v,exp", [("abc", ""), ("12.345", ""), ("12345", ""), ("-3", ""), ("12,5", "12.5"), (12.5, "12.5"), ("", "")])
    def test_dimensions(self, v, exp):
        r = _put({"loa": v})
        assert r.status_code == 200, r.text
        assert r.json()["boat"]["loa"] == exp


# ship_log dynamic labels: MMSI + adults/children
class TestShipLogLabels:
    CTX = {"vessel": "V", "callsign": "C", "position": "P", "local_date": "D", "pob": 4, "boat_type": "Yacht - Sloop"}

    def _l(self, dyn, **kw):
        from ship_log import _label
        return _label({"dynamic": dyn, "label": ""}, {**self.CTX, **kw})

    def test_mayday_callsign_mmsi(self):
        assert self._l("maydayCallsign", mmsi="512345678") == "Callsign C, MMSI 512345678"
        assert self._l("maydayCallsign", mmsi="") == "Callsign C"

    def test_panpan_vessel_mmsi(self):
        assert self._l("panPanVessel", mmsi="512345678") == "This is V, V, V. Callsign C, MMSI 512345678"

    def test_pob_children(self):
        assert self._l("pobDescription", children=2).startswith("There are 4 persons on board POB, 2 adults and 2 children. The boat is a white Yacht - Sloop")
        assert self._l("pobDescription", children=0).startswith("There are 4 persons on board POB. The boat is")
        assert "1 adult and 1 child." in self._l("pobDescription", pob=2, children=1)
