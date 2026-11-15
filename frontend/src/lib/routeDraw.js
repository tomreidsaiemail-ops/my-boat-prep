import L from "leaflet";
import { alongLine, milesText } from "@/lib/tripStops";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pin = (n, picked, kind) => L.divIcon({ className: "", html: `<span class="route-pin${kind}${picked ? " route-pin-picked" : ""}">${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const tag = (cls, text, style = "") => L.divIcon({ className: "", html: `<span class="${cls}"${style ? ` style="${style}"` : ""}>${esc(text)}</span>`, iconSize: [0, 0] });

// A label on the leg's line, close to the stop it arrives at, nudged off the line (above it on screen).
const nearStop = (m, line, cls, text, interactive) => {
  const { at, from, to } = alongLine(line, 0.85);
  const p = m.latLngToContainerPoint(from);
  const q = m.latLngToContainerPoint(to);
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  let [nx, ny] = [-(q.y - p.y) / len, (q.x - p.x) / len];
  if (ny > 0) [nx, ny] = [-nx, -ny];
  const style = `transform: translate(calc(-50% + ${Math.round(nx * 20)}px), calc(-50% + ${Math.round(ny * 20)}px))`;
  return L.marker(at, { icon: tag(cls, text, style), interactive, zIndexOffset: 400 });
};

// Planned route: dashed leg lines, miles, a label before each stop and numbered pins. stops: [{ name, pos, type }].
export const drawRoute = (m, g, { stops, lines, miles = [], tagFor, onTag, pick = -1, onPin }) => {
  lines.forEach((ln, k) => {
    if (!ln) return;
    L.polyline(ln, { color: "#0f172a", weight: 3, dashArray: "8 6", interactive: false }).addTo(g);
    if (miles[k] != null) L.marker(alongLine(ln, 0.35).at, { icon: tag("stop-miles", milesText(miles[k])), interactive: false }).addTo(g);
    const t = tagFor(stops[k + 1]);
    if (t) { const mk = nearStop(m, ln, t.cls, t.text, !!onTag); if (onTag) mk.on("click", () => onTag(stops[k + 1])); mk.addTo(g); }
  });
  stops.forEach((s, i) => {
    if (!s?.pos) return;
    const kind = i === 0 ? " route-pin-start" : i === stops.length - 1 ? " route-pin-end" : "";
    const mk = L.marker([s.pos.lat, s.pos.lon], { icon: pin(i + 1, i === pick, kind), title: s.name, zIndexOffset: 600 }).bindTooltip(esc(`${i + 1}. ${s.name}`));
    if (onPin) mk.on("click", () => onPin(i));
    mk.addTo(g);
  });
};
