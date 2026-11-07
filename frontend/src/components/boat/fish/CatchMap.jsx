import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronRight, Fish, MapPinOff } from "lucide-react";
import { API } from "@/lib/api";
import { localWhen } from "@/lib/timeAgo";

const COLOUR = { fish: "#F28C28", shellfish: "#7E3FBF" };
const kindOf = (c) => (c.report.kind === "shellfish" ? "shellfish" : "fish");
const placed = (c) => c.lat != null && c.lon != null;
const name = (c) => c.report.species.common_name;

const SpeciesFilter = ({ catches, value, onChange }) => {
  const counts = catches.reduce((m, c) => m.set(name(c), (m.get(name(c)) || 0) + 1), new Map());
  const chip = (on) => `rounded-full border-[1.5px] px-3 py-1 text-xs font-bold [transition:background-color_.15s] ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white hover:bg-slate-50"}`;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="catch-map-filter">
      <button type="button" className={chip(!value)} onClick={() => onChange("")} data-testid="catch-map-filter-all">All ({catches.length})</button>
      {[...counts].sort((a, b) => b[1] - a[1]).map(([n, k], i) => (
        <button key={n} type="button" className={chip(value === n)} onClick={() => onChange(value === n ? "" : n)} data-testid={`catch-map-filter-${i}`}>{n} ({k})</button>
      ))}
    </div>
  );
};

const Selected = ({ c, imperial, onOpen }) => (
  <button type="button" onClick={() => onOpen(c)} className="flex w-full items-center gap-3 rounded-lg border-[1.5px] border-[var(--navy)] bg-white px-3 py-2 text-left hover:bg-slate-50" data-testid="catch-map-selected">
    {c.has_photo ? <img src={`${API}/me/catches/${c.catch_id}/photo`} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
      : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-sky-50"><Fish className="h-6 w-6" /></span>}
    <span className="min-w-0 flex-1">
      <span className="block truncate font-bold">{name(c)}</span>
      <span className="block truncate text-xs text-[var(--muted)]">{[c.report.size.length_cm && (imperial ? `${(c.report.size.length_cm / 2.54).toFixed(1)} in` : `${c.report.size.length_cm} cm`), c.report.size.weight_kg && (imperial ? `${(c.report.size.weight_kg * 2.20462).toFixed(1)} lb` : `${c.report.size.weight_kg} kg`), c.report.place.name].filter(Boolean).join(" · ")}</span>
      <span className="block text-xs text-[var(--muted)]">{localWhen(c.created_at)}</span>
    </span>
    <span className="flex shrink-0 items-center text-xs font-bold">Full report <ChevronRight className="h-4 w-4" /></span>
  </button>
);

// Every catch with a GPS position as a pin: orange for fish, purple for shellfish.
export const CatchMap = ({ catches, imperial, onOpen }) => {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [species, setSpecies] = useState("");
  const [picked, setPicked] = useState(null);
  const onMap = useMemo(() => catches.filter(placed), [catches]);
  const shown = useMemo(() => onMap.filter((c) => !species || name(c) === species), [onMap, species]);

  useEffect(() => {
    if (!onMap.length) return undefined;
    const m = L.map(el.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenSeaMap" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; };
  }, [onMap.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current.clearLayers();
    shown.forEach((c) => L.circleMarker([c.lat, c.lon], { radius: 9, color: "#fff", weight: 2, fillColor: COLOUR[kindOf(c)], fillOpacity: 0.95 })
      .bindTooltip(`${name(c)} · ${new Date(c.created_at).toLocaleDateString()}`).on("click", () => setPicked(c)).addTo(layer.current));
    if (shown.length) m.fitBounds(shown.map((c) => [c.lat, c.lon]), { padding: [30, 30], maxZoom: 13 });
    setPicked((p) => (p && shown.includes(p) ? p : null));
  }, [shown]);

  const missing = catches.length - onMap.length;
  if (!catches.length) return <p className="rounded-md border-[1.5px] border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]" data-testid="catch-map-empty">No catches yet. Photo your first catch and it will be pinned here.</p>;
  return (
    <div className="flex flex-col gap-2" data-testid="catch-map">
      {onMap.length > 0 ? <>
        <SpeciesFilter catches={onMap} value={species} onChange={setSpecies} />
        <div className="relative isolate h-72 w-full overflow-hidden rounded-md border border-[var(--line)] sm:h-80" data-testid="catch-map-canvas"><div ref={el} className="h-full w-full" /></div>
        <p className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]" data-testid="catch-map-legend">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: COLOUR.fish }} /> Fish</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: COLOUR.shellfish }} /> Shellfish and other seafood</span>
          <span>Tap a pin to see the catch.</span>
        </p>
        {picked && <Selected c={picked} imperial={imperial} onOpen={onOpen} />}
      </> : <p className="rounded-md border-[1.5px] border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]" data-testid="catch-map-no-gps">None of your catches have a GPS position yet. Allow location on this phone when you photo your next catch.</p>}
      {missing > 0 && onMap.length > 0 && <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]" data-testid="catch-map-missing"><MapPinOff className="h-3.5 w-3.5" /> {missing} {missing === 1 ? "catch has" : "catches have"} no GPS position, so {missing === 1 ? "it's" : "they're"} not on the map. {missing === 1 ? "It's" : "They're"} still in the Catch log.</p>}
    </div>
  );
};
