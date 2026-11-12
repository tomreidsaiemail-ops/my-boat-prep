import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const when = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// The boat's path this trip (navy line), where it started (white dot) and where it is now (orange dot).
export const ShoreMap = ({ points, endLabel = "Now", className = "h-[60vh] min-h-[320px]" }) => {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([-36.84, 174.76], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    fitted.current = false;
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

  return <div ref={box} className={`${className} w-full overflow-hidden rounded-xl border-2 border-[var(--navy)]`} data-testid="shore-map" />;
};
