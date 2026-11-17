import { useEffect, useLayoutEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, RefreshCw, X } from "lucide-react";
import useGps from "@/hooks/useGps";
import { api } from "@/lib/api";
import { drawRoute } from "@/lib/routeDraw";
import { legLines, legMiles, milesText, stopsOf } from "@/lib/tripStops";
import { arriveType } from "@/components/boat/navigator/ArriveType";

const BOAT = L.divIcon({ className: "", html: '<span class="boat-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
const HANDLE = L.divIcon({ className: "", html: '<span class="route-handle"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
const GHOST = L.divIcon({ className: "", html: '<span class="route-handle route-handle-ghost"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
const fixOf = (gps) => (gps.status === "ok" ? [gps.lat, gps.lon] : gps.last?.lat != null ? [gps.last.lat, gps.last.lon] : null);
const r5 = (ll) => [+ll.lat.toFixed(5), +ll.lng.toFixed(5)];
const same = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;

// popup: shown beside its spot on the map (above it, else below, else as near as fits), kept inside the map.
const MapPopup = ({ at, box, children }) => {
  const ref = useRef(null);
  const [h, setH] = useState(0);
  // Re-measured every render (the name can wrap); an unchanged height doesn't render again.
  useLayoutEffect(() => { setH(ref.current?.offsetHeight || 0); }); // eslint-disable-line react-hooks/exhaustive-deps
  const [w, bh] = [box?.clientWidth || 0, box?.clientHeight || 0];
  let top = at.y - 16 - h;
  if (top < 4) top = at.y + 16;
  if (top + h > bh - 4) top = Math.max(4, bh - 4 - h);
  return (
    <div ref={ref} className="absolute z-[1100]" style={{ left: Math.min(Math.max(at.x, 132), Math.max(132, w - 132)), top, transform: "translateX(-50%)", visibility: h ? "visible" : "hidden" }} data-testid="stops-map-popup">
      {children}
    </div>
  );
};

// Drag a bend to move it, drag a faint middle handle (or tap the line) to add one, double-tap a bend to remove it. Crowded handles wait for a closer zoom.
const drawHandles = (m, g, lines, setBends) => lines.forEach((ln, k) => {
  if (!ln) return;
  const bends = ln.slice(1, -1);
  const px = ln.map((p) => m.latLngToContainerPoint(p));
  const gap = (i, j) => Math.hypot(px[i].x - px[j].x, px[i].y - px[j].y);
  let lastAt = 0;
  bends.forEach((p, j) => {
    if (gap(j + 1, lastAt) < 22 || gap(j + 1, ln.length - 1) < 22) return;
    lastAt = j + 1;
    L.marker(p, { icon: HANDLE, draggable: true, zIndexOffset: 500, title: "Drag to shape the route" })
      .on("dragend", (e) => setBends(k, bends.map((x, n) => (n === j ? r5(e.target.getLatLng()) : x))))
      .on("dblclick", () => setBends(k, bends.filter((_, n) => n !== j))).addTo(g);
  });
  ln.slice(1).forEach((p, j) => {
    if (gap(j, j + 1) < 44 || bends.length >= 78) return;
    L.marker([(ln[j][0] + p[0]) / 2, (ln[j][1] + p[1]) / 2], { icon: GHOST, draggable: true, zIndexOffset: 450, title: "Drag to add a bend" })
      .on("dragend", (e) => { const next = [...bends]; next.splice(j, 0, r5(e.target.getLatLng())); setBends(k, next); }).addTo(g);
  });
});

// Map tab: pick a stop, tap the map to drop its pin; each leg is drawn over the water and can be shaped with handles.
// quick (Quick Trip Plan Draft): the next stop without a pin is always the one a tap drops, and the stop list is hidden.
// onPinTap / mark (quick): a tapped pin is handed back, and the marked pin is highlighted. overlay: drawn over the map.
export const StopsMap = ({ legs, onPlace, onPath, onRedraw, onPrepare = () => {}, quick = false, paused = false, onPinTap = () => {}, mark = null, popup = null, overlay = null }) => {
  const gps = useGps();
  const stops = stopsOf(legs);
  const lines = legLines(legs);
  const miles = legMiles(legs);
  // No stop is picked once all are pinned, so a stray tap can't move one.
  const [pick, setPick] = useState(() => stops.findIndex((s) => !s.pos));
  const [drawing, setDrawing] = useState(0);
  const [, setMoved] = useState(0); // re-renders the popup as the map pans and zooms
  // Which parts of each leg cross land, keyed by the leg's line so an old answer never colours a changed line.
  const [land, setLand] = useState({});
  const landOf = lines.map((ln) => (ln ? land[JSON.stringify(ln)] : undefined));
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const boat = useRef(null);
  const pending = useRef(new Set());
  const live = useRef({});
  const draw = () => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    drawRoute(map.current, g, { stops, lines, miles, land: landOf, badges: quick, pick: quick && mark !== null ? mark : pick, onPin: quick ? (i) => live.current.onPinTap(i) : setPick, onPinDrag: (i, pos) => live.current.onPlace(i, pos), onTag: (s) => live.current.onPrepare(arriveType(s.type)),
      tagFor: (s) => { const t = arriveType(s?.type); return t && { cls: "stop-prepare", text: t.prep }; },
      // A tap on a line adds a bend there to drag, unless a stop is waiting for its pin (then the map tap drops it).
      onLineTap: pick < 0 ? (k, j, ll) => { const bends = lines[k].slice(1, -1); if (bends.length >= 78) return; const next = [...bends]; next.splice(j, 0, r5(ll)); live.current.onPath(k, next); } : null });
    drawHandles(map.current, g, lines, (k, pts) => live.current.onPath(k, pts));
  };
  live.current = { pick, stops, onPlace, onPath, onPrepare, onPinTap, draw };

  useEffect(() => {
    const m = L.map(el.current, { doubleClickZoom: false });
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
    m.on("zoomend", () => live.current.draw());
    m.on("move zoom", () => setMoved((n) => n + 1));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    live.current.draw();
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => { clearTimeout(t); m.remove(); map.current = null; layer.current = null; boat.current = null; };
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

  useEffect(() => { draw(); }, [legs, pick, mark]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = stops.findIndex((s) => !s.pos);
  useEffect(() => { if (quick) setPick(paused ? -1 : open); }, [quick, paused, open, stops.length]);

  // Legs are straight rhumb lines between pins and the skipper's waypoints; each line is checked for crossing land (shown red).
  useEffect(() => {
    if (!navigator.onLine) return;
    lines.forEach((ln) => {
      const key = ln && JSON.stringify(ln);
      if (!ln || land[key] || pending.current.has(key)) return;
      pending.current.add(key);
      setDrawing((n) => n + 1);
      api.post("/sea-check", { line: ln }, { timeout: 45000 }).then(({ data }) => setLand((x) => ({ ...x, [key]: data.land })))
        .catch(() => {}).finally(() => { pending.current.delete(key); setDrawing((n) => n - 1); });
    });
  }, [legs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { draw(); }, [land]); // eslint-disable-line react-hooks/exhaustive-deps
  const onLand = landOf.some((f) => f?.some(Boolean));

  return (
    <div className="flex flex-col gap-2" data-testid="stops-map">
      <div className="relative isolate h-[48dvh] overflow-hidden rounded-md border border-[var(--line)]">
        <div ref={el} className="h-full w-full" data-testid="stops-map-canvas" />
        {overlay}
        {popup && map.current && <MapPopup at={map.current.latLngToContainerPoint([popup.pos.lat, popup.pos.lon])} box={el.current}>{popup.node}</MapPopup>}
        {drawing > 0 && <span className="absolute bottom-2 left-2 z-[500] flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--navy)] shadow" data-testid="stops-map-drawing"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the route stays on the water...</span>}
      </div>
      {!quick && <p className="text-xs text-[var(--muted)]" data-testid="stops-map-hint">{pick < 0 ? "Tap a stop below to drop or move its pin." : "Tap the map to drop the picked stop's pin."} Drag a pin to move a stop. Tap a line, or drag a faint handle on it, to add a waypoint, drag a white one to move it, double-tap to remove it. Not for navigation.</p>}
      {onLand && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="stops-map-land-warning">Red parts of the route cross land. Tap the red part to add a handle, then drag it out over the water to put a kink in the line.</p>}
      {!quick && <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm" onClick={onRedraw} disabled={drawing > 0 || !lines.some(Boolean)} data-testid="stops-map-redraw-btn"><RefreshCw className="h-4 w-4" /> Straighten all legs</button>}
      {!quick && <ol className="flex flex-col gap-1.5">
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
      </ol>}
    </div>
  );
};
