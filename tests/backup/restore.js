const lines = fs.readFileSync('/app/tests/backup/weather_backup_181.json','utf8').trim().split('\n').map(JSON.parse);
for (const b of lines) {
  const r = db.user_boats.updateOne({owner_id:b.owner_id, boat_id:"main"}, {$set:{"boat.weather":b.boat.weather,"boat.route_start":b.boat.route_start,"boat.route_dest":b.boat.route_dest}});
  print(b.owner_id, r.modifiedCount);
}
db.user_boats.find({owner_id:{$in:["test-user-pro","test-admin-1"]},boat_id:"main"},{owner_id:1,"boat.route_start":1,"boat.weather.legs":1,"boat.weather.start_pos":1}).forEach(d=>print(JSON.stringify(d)));
