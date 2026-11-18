// Stop 1 is the Route Plan START; every leg then ends at its DESTINATION (its pin is dest_pos, its drawn bends are path).
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
const llNm = (a, b) => nm({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });

// Each leg's line: its start pin, the bends drawn over the water, its end pin (null until both pins are down).
export const legLines = (legs) => {
  const s = stopsOf(legs);
  return legs.map((l, n) => (s[n].pos && s[n + 1].pos ? [[s[n].pos.lat, s[n].pos.lon], ...(Array.isArray(l.path) ? l.path : []), [s[n + 1].pos.lat, s[n + 1].pos.lon]] : null));
};
export const lineNm = (line) => (line ? line.slice(1).reduce((t, p, i) => t + llNm(line[i], p), 0) : null);
export const legMiles = (legs) => legLines(legs).map(lineNm);
export const milesText = (v) => (v == null ? "" : `${v < 10 ? v.toFixed(1) : Math.round(v)} nm`);

// The point a share f of the way along a line, with the segment it sits on.
export const alongLine = (line, f) => {
  const lens = line.slice(1).map((p, i) => llNm(line[i], p));
  let left = lens.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < lens.length; i += 1) {
    if (left <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, left / lens[i]) : 0;
      const [a, b] = [line[i], line[i + 1]];
      return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], from: a, to: b };
    }
    left -= lens[i];
  }
  return { at: line[0], from: line[0], to: line[0] };
};

// What the shore contact page draws: pinned stops and each leg's line.
export const shoreRoute = (b = {}) => {
  const w = b.weather || {};
  const legs = [{ route_start: b.route_start, route_dest: b.route_dest, start_pos: w.start_pos, dest_pos: w.dest_pos, path: w.path, arrive_type: w.arrive_type }, ...(w.legs || [])];
  const stops = stopsOf(legs);
  if (stops.filter((s) => s.pos).length < 2) return null;
  return { stops: stops.map((s) => (s.pos ? { name: String(s.name).slice(0, 80), lat: s.pos.lat, lon: s.pos.lon, type: s.type || "" } : null)), lines: legLines(legs) };
};

const same = (a, b) => !!(a || "").trim() && (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
// A return trip: two legs, Leg 2's DESTINATION being Leg 1's START (legs: every leg, Leg 1 first).
export const returnsToStart = (legs) => legs.length === 2 && same(legs[1].route_dest, legs[0].route_start);
