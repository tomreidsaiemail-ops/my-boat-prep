# RCA — Leave hop bubble not highlighted on Trip Planning list (trip "routeHazards")

App: myboatprep.com (deployment gemini-prototype). Read-only production DB check. DB: `gemini-prototype-test_database`, collection `user_boats`.

## Target document
Matched exactly one owner boat (excluding `model_vessel`) whose `boat.weather.depart_at` starts with `2026-11-26T13:01`.

- `_id`: 6aee96fae86ea2fc56a40b8b
- `boat_id`: **main**
- `boat.underway`: `{}`  (empty — no `trip_id`)
- `boat.trip_ended`: `""`  (empty string)
- `boat.route_trip`: `"routeHazards"`
- `boat.route_trip_day`: `"2026-11-26"`
- `boat.weather.depart_at`: `"2026-11-26T13:01"`
- `boat.weather.finish_at`: `"2026-11-26T15:01"`

## boat.legs.routeHazards — count: 1
Entry 1:
- id: `1795643629037`
- kind: `"dock"`
- start: `"Mana Marina"`
- dest: `"Mana Island / Te Mana-o-Kupe-ki-te-Moana-nui-a-Kiwa"`
- at: `"2026-11-25T21:53:49.036Z"`
- depart_at: `"2026-11-26T10:53"`
- arrived_at: `"2026-11-25T23:00:14.850Z"`

(This leg also carries `actual_finish_at`, `arrival:"mooring"`, `arrived_list:"Arriving at Destination"`, `logs:[...]` — i.e. it is a previously-logged/completed hop.)

## Which condition hides the Leave highlight
The highlight is hidden when `departed(tripId)` is true OR `boat.trip_ended === tripId`.

- `boat.trip_ended === "routeHazards"` → `"" === "routeHazards"` → **false** (not the Archive-Trip path).
- `departed()` clause (a-i): `boat.underway.trip_id === "routeHazards"` → underway is `{}`, trip_id undefined → **false**.
- `departed()` clause (a-ii): any entry in `boat.legs["routeHazards"]` has `at >= (boat.weather.depart_at - 24h)` → **TRUE**.

### Arithmetic
- `depart_at` = `2026-11-26T13:01` (naive local → NZDT UTC+13) = `2026-11-26T00:01Z`.
- `depart_at - 24h` = `2026-11-25T00:01Z` (= 2026-11-25 13:01 NZ).
- Leg `at` = `2026-11-25T21:53:49.036Z` (= 2026-11-26 10:53 NZ).
- `21:53:49Z (Nov 25) >= 00:01Z (Nov 25)` → within the window → clause true.

**Root cause:** `departed("routeHazards")` resolves to **true via condition (a), the second clause** — the single `routeHazards` leg (the already-logged/arrived "dock" hop id 1795643629037, logged on 25 Nov) has an `at` timestamp that falls inside the 24h-before-departure window. That makes the planner treat the trip as already departed, so the "Leave" bubble is not yellow, "(today)" is absent, and the "Next step, switch to Leaving Dock…" line is suppressed.

## Why preview works but prod doesn't
Code is identical in both. The difference is DATA: this production boat doc carries a stale/completed leg in `boat.legs.routeHazards` whose `at` lands in the departure window. Preview presumably has no such leg, so `departed()` stays false and the highlight shows.

## Suggested fixes
1. (Data) Clear/remove the stale completed leg entry (id `1795643629037`, `arrived_at` 2026-11-25T23:00) from `boat.legs.routeHazards` so no leg's `at` falls within 24h before `depart_at`. This restores the Leave highlight. Owner action via DB Manager.
2. (Code, optional) The `departed()` heuristic treats any logged leg within a 24h window as "departed" regardless of whether it belongs to the current planned departure. E1 could tighten clause (a-ii) so a pre-existing/arrived leg from a prior session doesn't trip the current trip's departure state.
