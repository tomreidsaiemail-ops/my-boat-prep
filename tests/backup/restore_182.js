const a = JSON.parse(fs.readFileSync('/app/tests/backup/admin_backup_182.json', 'utf8'));
const p = JSON.parse(fs.readFileSync('/app/tests/backup/pro_backup_182.json', 'utf8'));
const now = new Date().toISOString();
print("admin", db.user_boats.updateOne({ owner_id: "test-admin-1", boat_id: "main" }, { $set: {
  "boat.weather": a.boat.weather, "boat.route_start": a.boat.route_start, "boat.route_dest": a.boat.route_dest,
  "boat.vessel": a.boat.vessel, "boat.callsign": a.boat.callsign,
  "data.arrivingDest": a.arrivingDest, "data.returningDock": a.returningDock, "list_ts.arrivingDest": now, updated_at: now,
} }).modifiedCount);
print("pro", db.user_boats.updateOne({ owner_id: "test-user-pro", boat_id: "main" }, { $set: {
  "boat.weather": p.boat.weather, "boat.route_start": p.boat.route_start, "boat.route_dest": p.boat.route_dest, updated_at: now,
} }).modifiedCount);
const d = db.user_boats.findOne({ owner_id: "test-admin-1", boat_id: "main" });
print(JSON.stringify({ w: d.boat.weather, v: d.boat.vessel, c: d.boat.callsign, ad: d.data.arrivingDest.map((i) => i.id) }));
const q = db.user_boats.findOne({ owner_id: "test-user-pro", boat_id: "main" });
print(JSON.stringify({ legs: q.boat.weather.legs, at: q.boat.weather.arrive_type, rs: q.boat.route_start }));
