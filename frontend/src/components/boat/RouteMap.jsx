import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Maximize2, Minimize2 } from "lucide-react";

const pin = (n, kind) => L.divIcon({ className: "", html: `<span class="route-pin${kind ? ` route-pin-${kind}` : ""}">${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const BOAT = L.divIcon({ className: "", html: '<span class="boat-dot" data-testid="navigator-map-boat"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
const hasFix = (gps) => gps?.status === "ok" && gps.lat != null;

const MapView = ({ waypoints, gps, big, onToggle, testId }) => {
  const el = useRef(null);
  const map = useRef(null);
  const boat = useRef(null);

  useEffect(() => {
    const m = L.map(el.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    const pts = waypoints.map((w) => [w.lat, w.lon]);
    L.polyline(pts, { color: "#0f172a", weight: 3, dashArray: "8 6" }).addTo(m);
    waypoints.forEach((w, i) => L.marker(pts[i], { icon: pin(i + 1, i === 0 ? "start" : i === pts.length - 1 ? "end" : ""), title: w.name }).bindTooltip(`${i + 1}. ${w.name}`).addTo(m));
    m.fitBounds(pts, { padding: [28, 28] });
    map.current = m;
    return () => { m.remove(); map.current = null; boat.current = null; };
  }, [waypoints]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!hasFix(gps)) { boat.current?.ring.remove(); boat.current?.dot.remove(); boat.current = null; return; }
    const ll = [gps.lat, gps.lon];
    if (!boat.current) {
      boat.current = { ring: L.circle(ll, { radius: gps.acc || 0, color: "#0ea5e9", weight: 1, fillOpacity: 0.12 }).addTo(m), dot: L.marker(ll, { icon: BOAT, title: "Your boat", zIndexOffset: 1000 }).addTo(m) };
    } else {
      boat.current.ring.setLatLng(ll).setRadius(gps.acc || 0);
      boat.current.dot.setLatLng(ll);
    }
  }, [gps, waypoints]);

  const showBoat = () => map.current && hasFix(gps) && map.current.fitBounds(L.latLngBounds([...waypoints.map((w) => [w.lat, w.lon]), [gps.lat, gps.lon]]), { padding: [28, 28] });

  return (
    <div className={`relative isolate overflow-hidden rounded-md border border-[var(--line)] ${big ? "h-full w-full" : "h-64 w-full sm:h-80"}`} data-testid={testId}>
      <div ref={el} className="h-full w-full" />
      <div className="absolute right-2 top-2 z-[500] flex flex-col gap-2">
        <button type="button" className="icon-btn h-10 w-10 bg-white shadow" onClick={onToggle} aria-label={big ? "Close full-screen map" : "Full-screen map"} data-testid={`${testId}-toggle-btn`}>
          {big ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        {hasFix(gps) && (
          <button type="button" className="icon-btn h-10 w-10 bg-white shadow" onClick={showBoat} aria-label="Show my boat on the route" data-testid={`${testId}-locate-btn`}><LocateFixed className="h-5 w-5" /></button>
        )}
      </div>
    </div>
  );
};

export const RouteMap = ({ waypoints, gps }) => {
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return undefined;
    const onKey = (e) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  return (
    <div className="flex flex-col gap-1" data-testid="navigator-route-map">
      <MapView waypoints={waypoints} gps={gps} onToggle={() => setBig(true)} testId="navigator-map" />
      <p className="text-xs text-[var(--muted)]" data-testid="navigator-map-gps">
        {hasFix(gps) ? "Blue dot: your boat, live from this phone's GPS." : "Your boat's position will show once this phone has a GPS fix."} Waypoints are approximate, not for navigation.
      </p>
      {big && createPortal(
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 p-2 sm:p-6" role="dialog" aria-label="Route map" data-testid="navigator-map-overlay">
          <MapView big waypoints={waypoints} gps={gps} onToggle={() => setBig(false)} testId="navigator-map-big" />
        </div>, document.body)}
    </div>
  );
};
