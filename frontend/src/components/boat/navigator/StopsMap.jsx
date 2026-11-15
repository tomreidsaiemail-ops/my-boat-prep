import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, X } from "lucide-react";
import useGps from "@/hooks/useGps";
import { legMiles, milesText, stopsOf, toward } from "@/lib/tripStops";
import { arriveType } from "@/components/boat/navigator/ArriveType";

const pin = (n, picked, kind) => L.divIcon({ className: "", html: `<span class="route-pin${kind}${picked ? " route-pin-picked" : ""}">${n}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const tag = (cls, text) => L.divIcon({ className: "", html: `<span class="${cls}">${text}</span>`, iconSize: [0, 0] });
const BOAT = L.divIcon({ className: "", html: '<span class="boat-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
const fixOf = (gps) => (gps.status === "ok" ? [gps.lat, gps.lon] : gps.last?.lat != null ? [gps.last.lat, gps.last.lon] : null);

// Map tab: pick a stop, tap the map to drop its pin; dashed line, miles and a Prepare to... box before each stop.
export const StopsMap = ({ legs, onPlace, onPrepare }) => {
  const gps = useGps();
  const stops = stopsOf(legs);
  const miles = legMiles(legs);
  // No stop is picked once all are pinned, so a stray tap can't move one.
  const [pick, setPick] = useState(() => stops.findIndex((s) => !s.pos));
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const boat = useRef(null);
  const live = useRef({});
  live.current = { pick, stops, onPlace, onPrepare };

  useEffect(() => {
    const m = L.map(el.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    const fix = fixOf(gps);
    const placed = live.current.stops.filter((s) => s.pos).map((s) => [s.pos.lat, s.pos.lon]);
    // Pins already down: open on them; otherwise on this phone's GPS.
    if (placed.length > 1) m.fitBounds(placed, { padding: [48, 48], maxZoom: 13 }); else if (fix) m.setView(fix, 11); else if (placed.length) m.setView(placed[0], 11); else m.setView([-41.2, 174.8], 6);
    m.on("click", (e) => {
      const { pick: i, stops: s, onPlace: place } = live.current;
      if (i < 0) return;
      place(i, { lat: +e.latlng.lat.toFixed(5), lon: +e.latlng.lng.toFixed(5) });
      setPick(s.findIndex((x, k) => k !== i && !x.pos));
    });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => { clearTimeout(t); m.remove(); map.current = null; boat.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The first live fix centres the map, unless pins are already down.
  const centred = useRef(gps.status === "ok");
  useEffect(() => {
    const m = map.current;
    if (!m || gps.status !== "ok") return;
    const ll = [gps.lat, gps.lon];
    if (!centred.current && !stops.some((s) => s.pos)) m.setView(ll, 11);
    centred.current = true;
    if (boat.current) boat.current.setLatLng(ll); else boat.current = L.marker(ll, { icon: BOAT, title: "Your boat", interactive: false }).addTo(m);
  }, [gps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    stops.forEach((s, i) => {
      if (i > 0 && s.pos && stops[i - 1].pos) {
        const a = stops[i - 1].pos;
        L.polyline([[a.lat, a.lon], [s.pos.lat, s.pos.lon]], { color: "#0f172a", weight: 3, dashArray: "8 6", interactive: false }).addTo(g);
        L.marker(toward(a, s.pos, 0.5), { icon: tag("stop-miles", milesText(miles[i - 1])), interactive: false }).addTo(g);
        const t = arriveType(s.type);
        if (t) L.marker([s.pos.lat, s.pos.lon], { icon: tag("stop-prepare", t.prep), title: t.prep, zIndexOffset: 500 }).on("click", () => live.current.onPrepare(t.list)).addTo(g);
      }
      if (s.pos) L.marker([s.pos.lat, s.pos.lon], { icon: pin(i + 1, i === pick, i === 0 ? " route-pin-start" : i === stops.length - 1 ? " route-pin-end" : ""), title: s.name })
        .bindTooltip(`${i + 1}. ${s.name}`).on("click", () => setPick(i)).addTo(g);
    });
  }, [legs, pick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-2" data-testid="stops-map">
      <div className="relative isolate h-[48dvh] overflow-hidden rounded-md border border-[var(--line)]"><div ref={el} className="h-full w-full" data-testid="stops-map-canvas" /></div>
      <p className="text-xs text-[var(--muted)]" data-testid="stops-map-hint">{pick < 0 ? "Tap a stop below to drop or move its pin." : "Tap the map to drop the picked stop's pin."} Miles are straight lines, not for navigation.</p>
      <ol className="flex flex-col gap-1.5">
        {stops.map((s, i) => (
          <li key={i} className="flex items-center gap-1">
            <button type="button" onClick={() => setPick(pick === i ? -1 : i)} aria-pressed={pick === i}
              className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border-2 px-2 py-1.5 text-left text-sm [transition:background-color_.15s] ${pick === i ? "border-amber-500 bg-amber-50" : "border-[var(--line)] bg-white"}`} data-testid={`stops-map-stop-${i}`}>
              <span className={`route-pin shrink-0 ${i === 0 ? "route-pin-start" : i === stops.length - 1 ? "route-pin-end" : ""}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 break-words font-bold">{s.name}</span>
              <span className="shrink-0 text-xs font-semibold text-[var(--muted)]" data-testid={`stops-map-stop-${i}-status`}>
                {s.pos ? <>{i > 0 && milesText(miles[i - 1])} <MapPin className="inline h-3.5 w-3.5 text-emerald-700" /></> : pick === i ? "Tap the map" : "No pin"}
              </span>
            </button>
            {pick === i && s.pos && <button type="button" className="icon-btn shrink-0" aria-label={`Clear the pin for ${s.name}`} onClick={() => onPlace(i, null)} data-testid={`stops-map-clear-${i}`}><X className="h-4 w-4" /></button>}
          </li>
        ))}
      </ol>
    </div>
  );
};
