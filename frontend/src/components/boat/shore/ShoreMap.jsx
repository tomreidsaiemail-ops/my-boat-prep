import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { drawRoute } from "@/lib/routeDraw";
import { lineNm } from "@/lib/tripStops";
import { arriveType } from "@/components/boat/navigator/ArriveType";

const when = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const NAMES = { mayDay: "MAYDAY", panPan: "PAN-PAN" };

// Where the boat stopped (e.g. tied up at a dock): a navy pin with an anchor.
const DOCK = L.divIcon({
  className: "shore-dock-marker",
  html: '<div data-testid="shore-map-dock-marker" style="width:28px;height:28px;border-radius:50%;background:#0f2a4a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// The boat at its last recorded position: a little white boat on orange.
const BOAT = L.divIcon({
  className: "shore-boat-marker",
  html: '<div data-testid="shore-map-boat-marker" style="width:32px;height:32px;border-radius:50%;background:#f97316;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center">'
    + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z"/><path d="M21 14 10 2 3 14h18Z"/><path d="M10 2v16"/></svg></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// TLOG: where the boat was when it logged a transit, an arrow turned to the bearing it took to the transit, and that bearing.
const tlogIcon = (deg) => L.divIcon({
  className: "shore-tlog-marker",
  html: `<div data-testid="shore-map-tlog-marker" style="position:relative;width:48px;height:48px">`
    + `<svg width="48" height="48" viewBox="0 0 48 48" style="transform:rotate(${deg}deg)"><line x1="24" y1="24" x2="24" y2="9" stroke="#0f2a4a" stroke-width="3"/><path d="M24 1 L32 14 L24 10 L16 14 Z" fill="#f59e0b" stroke="#0f2a4a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="24" cy="24" r="5.5" fill="#0f2a4a" stroke="#fff" stroke-width="2"/></svg>`
    + `<span style="position:absolute;left:50%;top:44px;transform:translateX(-50%);white-space:nowrap;background:#fde68a;border:2px solid #f59e0b;color:#0f2a4a;border-radius:9999px;padding:0 6px;font:800 11px/16px system-ui,sans-serif">TLOG ${String(deg).padStart(3, "0")}°</span></div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const drawTlog = (g, t) => {
  const spots = [[t.boat.lat, t.boat.lon]];
  if (t.mark) {
    spots.push([t.mark.lat, t.mark.lon]);
    L.polyline(spots, { color: "#f59e0b", weight: 3, dashArray: "6 6" }).addTo(g);
    L.circleMarker([t.mark.lat, t.mark.lon], { radius: 7, color: "#0f2a4a", weight: 3, fillColor: "#fde68a", fillOpacity: 1 })
      .bindTooltip(t.name || "Transit", { permanent: true, direction: "top", offset: [0, -8] }).addTo(g);
  }
  L.marker(spots[0], { icon: tlogIcon(t.bearing ?? 0), zIndexOffset: 3000 }).bindTooltip(`${t.name ? `${t.name} ` : ""}logged here · ${when(t.at)}`).addTo(g);
  return spots;
};

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

// The boat's path this trip (navy line), where it started (white dot) and its last recorded position (a little boat).
// route: the skipper's planned route (stops and leg lines), drawn under the boat's path with an arrival label before each stop.
// tlog: a transit pass to show ("Show me on the map"), drawn as a TLOG mark and zoomed to.
export const ShoreMap = ({ points, alert, route, tlog = null, endLabel = "Last position", className = "h-[60vh] min-h-[320px]" }) => {
  const box = useRef(null);
  const routeLayer = useRef(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const map = useRef(null);
  const layer = useRef(null);
  const alertLayer = useRef(null);
  const tlogLayer = useRef(null);
  const fitted = useRef(false);
  const fittedAlert = useRef("");

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([-36.84, 174.76], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    routeLayer.current = L.layerGroup().addTo(m);
    m.on("zoomend", () => drawPlan());
    layer.current = L.layerGroup().addTo(m);
    alertLayer.current = L.layerGroup().addTo(m);
    tlogLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    fitted.current = false;
    fittedAlert.current = "";
    return () => m.remove();
  }, []);

  const drawPlan = () => {
    const g = routeLayer.current;
    const r = routeRef.current;
    if (!g || !map.current) return;
    g.clearLayers();
    if (!r?.stops?.length) return;
    const stops = r.stops.map((s) => (s ? { name: s.name, type: s.type, pos: { lat: s.lat, lon: s.lon } } : { name: "" }));
    const lines = r.lines || [];
    drawRoute(map.current, g, { stops, lines, miles: lines.map((ln) => (ln ? lineNm(ln) : null)),
      tagFor: (s) => { const t = arriveType(s?.type); return t && { cls: "stop-arrive", text: `Arrive · ${t.label}` }; } });
  };
  useEffect(() => {
    drawPlan();
    const pts = (route?.stops || []).filter(Boolean).map((s) => [s.lat, s.lon]);
    if (!fitted.current && !points.length && pts.length) { fitted.current = true; map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 13 }); }
  }, [JSON.stringify(route)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (!points.length) return;
    const line = points.map((p) => [p.lat, p.lon]);
    L.polyline(line, { color: "#0f2a4a", weight: 4, opacity: 0.85 }).addTo(g);
    const first = points[0];
    const now = points[points.length - 1];
    points.filter((p) => p.kind === "stop" && p !== now).forEach((p) => L.marker([p.lat, p.lon], { icon: DOCK }).bindTooltip(`Stopped here · ${when(p.at)}`).addTo(g));
    L.circleMarker([first.lat, first.lon], { radius: 6, color: "#0f2a4a", weight: 2, fillColor: "#fff", fillOpacity: 1 }).bindTooltip(`Start · ${when(first.at)}`).addTo(g);
    L.marker([now.lat, now.lon], { icon: BOAT, zIndexOffset: 1000 })
      .bindTooltip(`${now.kind === "stop" ? "Stopped here" : endLabel} · ${when(now.at)}`, { permanent: true, direction: "top", offset: [0, -16] }).addTo(g);
    if (!fitted.current) {
      fitted.current = true;
      const all = [...line, ...(routeRef.current?.stops || []).filter(Boolean).map((x) => [x.lat, x.lon])];
      if (all.length > 1) map.current.fitBounds(all, { padding: [30, 30], maxZoom: 14 });
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

  useEffect(() => {
    const g = tlogLayer.current;
    g.clearLayers();
    if (!tlog?.boat) return;
    const spots = drawTlog(g, tlog);
    fitted.current = true;
    if (spots.length > 1) map.current.fitBounds(spots, { padding: [70, 70], maxZoom: 14 });
    else map.current.setView(spots[0], 13);
  }, [tlog?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className={`${className} isolate w-full overflow-hidden rounded-xl border-2 border-[var(--navy)]`} data-testid="shore-map" />;
};
