import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const when = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const NAMES = { mayDay: "MAYDAY", panPan: "PAN-PAN" };

// An active Mayday / Pan-Pan: red where it was pressed; when that's over 100 m away, the last reported position too.
const drawAlert = (g, a) => {
  const at = a.pos || a.last;
  if (!at) return [];
  const spots = [[at.lat, at.lon]];
  if (a.pos && a.last && !a.near) {
    spots.push([a.last.lat, a.last.lon]);
    L.polyline(spots, { color: "#dc2626", weight: 2, dashArray: "6 6" }).addTo(g);
    L.circleMarker([a.last.lat, a.last.lon], { radius: 8, color: "#0f2a4a", weight: 3, fillColor: "#fbbf24", fillOpacity: 1 })
      .bindTooltip(`Last reported · ${when(a.last.at)}`, { permanent: true, direction: "auto" }).addTo(g);
  }
  L.circleMarker([at.lat, at.lon], { radius: 26, color: "#dc2626", weight: 2, fillColor: "#dc2626", fillOpacity: 0.2, className: "shore-alert-pulse" }).addTo(g);
  L.circleMarker([at.lat, at.lon], { radius: 12, color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 })
    .bindTooltip(`${NAMES[a.kind]} pressed ${a.pos ? "here" : "(last reported position)"} · ${when(a.at)}`, { permanent: true, direction: "auto", className: "shore-alert-tip" }).addTo(g);
  return spots;
};

// The boat's path this trip (navy line), where it started (white dot) and where it is now (orange dot).
export const ShoreMap = ({ points, alert, endLabel = "Now", className = "h-[60vh] min-h-[320px]" }) => {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const alertLayer = useRef(null);
  const fitted = useRef(false);
  const fittedAlert = useRef("");

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([-36.84, 174.76], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    alertLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    fitted.current = false;
    fittedAlert.current = "";
    return () => m.remove();
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (!points.length) return;
    const line = points.map((p) => [p.lat, p.lon]);
    L.polyline(line, { color: "#0f2a4a", weight: 4, opacity: 0.85 }).addTo(g);
    const first = points[0];
    const now = points[points.length - 1];
    L.circleMarker([first.lat, first.lon], { radius: 6, color: "#0f2a4a", weight: 2, fillColor: "#fff", fillOpacity: 1 }).bindTooltip(`Start · ${when(first.at)}`).addTo(g);
    L.circleMarker([now.lat, now.lon], { radius: 10, color: "#fff", weight: 3, fillColor: "#f97316", fillOpacity: 1 }).bindTooltip(`${endLabel} · ${when(now.at)}`, { permanent: false }).addTo(g);
    if (!fitted.current) {
      fitted.current = true;
      if (line.length > 1) map.current.fitBounds(line, { padding: [30, 30], maxZoom: 14 });
      else map.current.setView(line[0], 13);
    }
  }, [points, endLabel]);

  useEffect(() => {
    const g = alertLayer.current;
    g.clearLayers();
    if (alert?.state !== "active") return;
    const spots = drawAlert(g, alert);
    if (!spots.length || fittedAlert.current === alert.alert_id) return;
    fittedAlert.current = alert.alert_id;
    fitted.current = true;
    if (spots.length > 1) map.current.fitBounds(spots, { padding: [90, 90], maxZoom: 15 });
    else map.current.setView(spots[0], 14);
  }, [alert]);

  return <div ref={box} className={`${className} w-full overflow-hidden rounded-xl border-2 border-[var(--navy)]`} data-testid="shore-map" />;
};
