import L from "leaflet";
import { alongLine, milesText } from "@/lib/tripStops";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pin = (n, picked, kind) => L.divIcon({ className: "", html: `<span class="route-pin${kind}${picked ? " route-pin-picked" : ""}">${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const tag = (cls, text, style = "") => L.divIcon({ className: "", html: `<span class="${cls}"${style ? ` style="${style}"` : ""}>${esc(text)}</span>`, iconSize: [0, 0] });

// A label on the leg's line, close to the stop it arrives at, nudged off the line (above it on screen).
const nearStop = (m, line, cls, text, interactive, taken) => {
  const { at, from, to } = alongLine(line, 0.85);
  const p = m.latLngToContainerPoint(from);
  const q = m.latLngToContainerPoint(to);
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  let [nx, ny] = [-(q.y - p.y) / len, (q.x - p.x) / len];
  if (ny > 0) [nx, ny] = [-nx, -ny];
  const c = m.latLngToContainerPoint(at);
  const [x, y] = [c.x + nx * 20, c.y + ny * 20];
  // Zoomed out, labels that would sit on top of one another wait until there's room.
  if (taken.some((t) => Math.abs(t[0] - x) < 120 && Math.abs(t[1] - y) < 26)) return null;
  taken.push([x, y]);
  const style = `transform: translate(calc(-50% + ${Math.round(nx * 20)}px), calc(-50% + ${Math.round(ny * 20)}px))`;
  return L.marker(at, { icon: tag(cls, text, style), interactive, zIndexOffset: 400 });
};

// Planned route: dashed leg lines, miles, a label before each stop and numbered pins. stops: [{ name, pos, type }].
// land[k][j]: part j of leg k crosses land, drawn solid red. onPinDrag: pins can be dragged.
export const drawRoute = (m, g, { stops, lines, miles = [], land = [], tagFor, onTag, pick = -1, onPin, onPinDrag }) => {
  const taken = [];
  lines.forEach((ln, k) => {
    if (!ln) return;
    L.polyline(ln, { color: "#0f172a", weight: 3, dashArray: "8 6", interactive: false }).addTo(g);
    ln.slice(1).forEach((p, j) => land[k]?.[j] && L.polyline([ln[j], p], { color: "#dc2626", weight: 5, interactive: false }).addTo(g));
    if (miles[k] != null) L.marker(alongLine(ln, 0.35).at, { icon: tag("stop-miles", milesText(miles[k])), interactive: false }).addTo(g);
    const t = tagFor(stops[k + 1]);
    const mk = t && nearStop(m, ln, t.cls, t.text, !!onTag, taken);
    if (mk) { if (onTag) mk.on("click", () => onTag(stops[k + 1])); mk.addTo(g); }
  });
  stops.forEach((s, i) => {
    if (!s?.pos) return;
    const kind = i === 0 ? " route-pin-start" : i === stops.length - 1 ? " route-pin-end" : "";
    const mk = L.marker([s.pos.lat, s.pos.lon], { icon: pin(i + 1, i === pick, kind), title: s.name, zIndexOffset: 600, draggable: !!onPinDrag }).bindTooltip(esc(`${i + 1}. ${s.name}`));
    if (onPin) mk.on("click", () => onPin(i));
    if (onPinDrag) mk.on("dragend", (e) => { const ll = e.target.getLatLng(); onPinDrag(i, { lat: +ll.lat.toFixed(5), lon: +ll.lng.toFixed(5) }); });
    mk.addTo(g);
  });
};
