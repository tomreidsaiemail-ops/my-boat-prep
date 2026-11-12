// Speed and estimated course from the last two positions shared with shore contacts.
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const metres = (a, b) => {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const bearing = (a, b) => {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const ms = (v) => (typeof v === "number" ? v : Date.parse(v));

// Returns { stopped } or { knots, course, point }, or null with fewer than two positions.
export const motion = (points) => {
  if (!points || points.length < 2) return null;
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const m = metres(a, b);
  if (b.kind === "stop" || m < 50) return { stopped: true };
  const hours = (ms(b.at) - ms(a.at)) / 3600000;
  if (!(hours > 0)) return null;
  const course = Math.round(bearing(a, b)) % 360;
  return { knots: m / 1852 / hours, course, point: POINTS[Math.round(course / 22.5) % 16] };
};

export const motionText = (mv) => {
  if (!mv) return "";
  if (mv.stopped) return "Stopped";
  return `${mv.knots.toFixed(1)} kn · estimated course ${String(mv.course).padStart(3, "0")}° (${mv.point})`;
};
