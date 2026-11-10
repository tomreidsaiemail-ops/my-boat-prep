# Crew trips: each Route Planning list (routeHazards + copies) is a trip with own notes/replies; one pending join request at a time.
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO, BETA = "test_session_pro_1", "test_session_beta_1"
TRIP2 = "custom_trip2"


def s(tok):
    x = requests.Session()
    x.cookies.set("session_token", tok)
    return x


class TestCrewTrips:
    created = []

    def test_get_crew_trip_shape(self):
        r = s(PRO).get(f"{BASE_URL}/api/boats/main/crew")
        assert r.status_code == 200
        d = r.json()
        assert "routeHazards" in d["trip_notes"]
        beta = next(m for m in d["crew"] if m["user_id"] == "test-user-beta")
        free = next(m for m in d["crew"] if m["user_id"] == "test-user-free")
        assert TRIP2 in beta["trips"]
        assert free["trips"] == ["routeHazards"]
        assert "routeHazards" in beta["trip_rsvp"]
        inv = [i for i in d["invites"] if i["email"] == "test.user.beta@example.com"]
        assert inv and inv[0]["trip_id"] == "routeHazards" and inv[0]["trip_name"] == "Route Planning"

    def test_invite_already_crew_on_trip(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/main/invites", json={"name": "Beta Crew", "email": "test.user.beta@example.com", "send_email": False, "trip_id": TRIP2, "trip_name": "Route Planning - 2"})
        assert r.status_code == 400
        assert "already crew on Route Planning - 2" in r.json()["detail"]

    def test_409_second_trip_while_pending_and_same_trip_replace(self):
        c = s(PRO)
        em = "test_trip_dup@example.com"
        r1 = c.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST_Dup", "email": em, "send_email": False, "trip_id": "routeHazards", "trip_name": "Route Planning", "notes": "Notes for Route Planning"})
        assert r1.status_code == 200, r1.text
        assert r1.json()["trip_id"] == "routeHazards"
        self.created.append(r1.json()["invite_id"])
        r2 = c.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST_Dup", "email": em, "send_email": False, "trip_id": TRIP2, "trip_name": "Route Planning - 2"})
        assert r2.status_code == 409, r2.text
        assert r2.json()["detail"] == "TEST_Dup has yet to respond to the first join request (Route Planning). Once they join, you can ask them to join another trip."
        r3 = c.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST_Dup", "email": em, "send_email": False, "trip_id": "routeHazards", "trip_name": "Route Planning", "notes": "Notes for Route Planning"})
        assert r3.status_code == 200
        self.created.append(r3.json()["invite_id"])
        invs = [i for i in c.get(f"{BASE_URL}/api/boats/main/crew").json()["invites"] if i["email"] == em]
        assert len(invs) == 1 and invs[0]["invite_id"] == r3.json()["invite_id"]

    def test_invite_trip2_persists_trip_fields(self):
        c = s(PRO)
        em = "test_trip_two@example.com"
        r = c.post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST_Two", "email": em, "send_email": False, "trip_id": TRIP2, "trip_name": "Route Planning - 2", "notes": "Notes for Route Planning - 2"})
        assert r.status_code == 200, r.text
        self.created.append(r.json()["invite_id"])
        inv = next(i for i in c.get(f"{BASE_URL}/api/boats/main/crew").json()["invites"] if i["email"] == em)
        assert inv["trip_id"] == TRIP2 and inv["trip_name"] == "Route Planning - 2"

    def test_bad_trip_id_422(self):
        r = s(PRO).post(f"{BASE_URL}/api/boats/main/invites", json={"name": "TEST_X", "email": "test_x@example.com", "send_email": False, "trip_id": "bad.id$"})
        assert r.status_code == 422

    def test_voyage_notes_per_trip(self):
        c = s(PRO)
        orig = c.get(f"{BASE_URL}/api/boats/main/crew").json()["trip_notes"]
        assert c.put(f"{BASE_URL}/api/boats/main/voyage-notes", json={"notes": "TEST_trip2 notes", "trip_id": TRIP2}).status_code == 200
        tn = c.get(f"{BASE_URL}/api/boats/main/crew").json()["trip_notes"]
        assert tn[TRIP2] == "TEST_trip2 notes" and tn["routeHazards"] == orig["routeHazards"]
        c.put(f"{BASE_URL}/api/boats/main/voyage-notes", json={"notes": orig.get(TRIP2, ""), "trip_id": TRIP2})

    def test_crew_voyage_trips_and_pending_aboard(self):
        b = s(BETA)
        v = b.get(f"{BASE_URL}/api/crew/voyage", params={"owner_id": "test-user-pro", "boat_id": "main"})
        assert v.status_code == 200
        t = {x["trip_id"]: x for x in v.json()["trips"]}
        assert t[TRIP2]["name"] == "Route Planning - 2"
        p = b.get(f"{BASE_URL}/api/crew/pending").json()["invites"]
        mine = [i for i in p if i["vessel"] == "TEST_Kia Ora"]
        assert mine and mine[0]["aboard"] is True and mine[0]["trip_name"] == "Route Planning"

    def test_rsvp_per_trip_and_clear(self):
        b, c = s(BETA), s(PRO)
        r = b.post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": "test-user-pro", "boat_id": "main", "status": "in", "trip_id": TRIP2})
        assert r.status_code == 200
        beta = next(m for m in c.get(f"{BASE_URL}/api/boats/main/crew").json()["crew"] if m["user_id"] == "test-user-beta")
        assert beta["trip_rsvp"][TRIP2] == "in" and beta["trip_rsvp"]["routeHazards"] is None
        assert c.delete(f"{BASE_URL}/api/boats/main/rsvp").status_code == 200
        beta = next(m for m in c.get(f"{BASE_URL}/api/boats/main/crew").json()["crew"] if m["user_id"] == "test-user-beta")
        assert not any(beta["trip_rsvp"].values())

    def test_rsvp_unknown_trip_rejected(self):
        r = s(BETA).post(f"{BASE_URL}/api/crew/rsvp", json={"owner_id": "test-user-pro", "boat_id": "main", "status": "in", "trip_id": "TEST_not_a_trip"})
        assert r.status_code == 400
        s(PRO).delete(f"{BASE_URL}/api/boats/main/rsvp")

    @classmethod
    def teardown_class(cls):
        c = s(PRO)
        for i in cls.created:
            c.delete(f"{BASE_URL}/api/boats/main/invites/{i}")
