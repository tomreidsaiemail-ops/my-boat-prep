const now = new Date().toISOString();
const it = (id, label, indent) => ({ id, label, checked: false, flagged: false, ...(indent ? { indent: 1 } : {}) });
const arriving = [
  it(101, "TEST Brief crew"),
  it(102, "If anchoring"), it(103, "TEST Anchor ready", 1), it(104, "TEST Check depth", 1),
  it(105, "If berthing"), it(106, "TEST Fenders out", 1),
  it(107, "If mooring"), it(108, "TEST Boat hook for buoy", 1),
  it(109, "When leaving berth"), it(110, "TEST Single up lines", 1),
  it(111, "TEST Close trip report"),
];
const weather = {
  depart_at: "2026-12-20T09:30", finish_at: "2026-12-20T11:00", event_at: "2026-12-20T09:30", arrive_type: "anchor",
  start_pos: { lat: -41.28, lon: 174.78 }, dest_pos: { lat: -41.25, lon: 174.86 },
  legs: [
    { id: 9001, route_start: "TEST Anchorage", route_dest: "TEST Marina", depart_at: "2026-12-20T12:00", finish_at: "2026-12-20T13:00", arrive_type: "berth", dest_pos: { lat: -41.20, lon: 174.90 } },
    { id: 9002, route_start: "TEST Marina", route_dest: "TEST Buoy Bay", depart_at: "2026-12-21T09:00", finish_at: "2026-12-21T10:00", arrive_type: "mooring", dest_pos: { lat: -41.15, lon: 174.85 } },
    { id: 9003, route_start: "TEST Buoy Bay", route_dest: "TEST Home Dock", depart_at: "2026-12-22T09:00", finish_at: "2026-12-22T11:00", arrive_type: "dock", dest_pos: { lat: -41.27, lon: 174.79 } },
  ],
};
const r = db.user_boats.updateOne({ owner_id: "test-admin-1", boat_id: "main" }, { $set: {
  "data.arrivingDest": arriving, "list_ts.arrivingDest": now,
  "boat.weather": weather, "boat.route_start": "TEST Home Dock", "boat.route_dest": "TEST Anchorage",
  "boat.vessel": "TEST_Vessel", "boat.callsign": "TEST_CS",
  updated_at: now,
} });
print("seeded", r.modifiedCount);
