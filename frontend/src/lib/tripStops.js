// Stop 1 is the Route Plan START; every leg then ends at its DESTINATION (its pin is dest_pos).
export const stopsOf = (legs) => (legs.length
  ? [{ name: legs[0].route_start || "Start", pos: legs[0].start_pos }, ...legs.map((l) => ({ name: l.route_dest || "Destination", pos: l.dest_pos, type: l.arrive_type }))]
  : []);

// Straight-line nautical miles between two pins.
export const nm = (a, b) => {
  if (!a || !b) return null;
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export const legMiles = (legs) => { const s = stopsOf(legs); return legs.map((_, n) => nm(s[n].pos, s[n + 1].pos)); };
export const milesText = (v) => (v == null ? "" : `${v < 10 ? v.toFixed(1) : Math.round(v)} nm`);
export const toward = (a, b, f) => [a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f];
