import { batteriesOf, batteryName, isLow } from "@/lib/telemetry";
import { DEFAULT_TRIP, tripBoat, tripLists } from "@/lib/trips";

const TANKS = [["fuel", "fuel"], ["gas", "LPG"], ["water", "Water"]];
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ""); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ""; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const missingLevels = (boat, levels = {}) => [...TANKS.map(([k, n]) => [k, cap(n)]), ...batteriesOf(boat).map((b) => [`bat_${b.id}`, batteryName(b)])]
  .filter(([k]) => !levels[k]).map(([, n]) => n);
export const levelsBlock = (boat, levels) => { const m = missingLevels(boat, levels); return m.length ? `Pick a level for ${m.join(", ")} first.` : ""; };

// "Adequate fuel, LPG, Water." with any tank at 1/4 or empty called out as low.
export const tankSummary = (levels = {}) => {
  const low = TANKS.filter(([k]) => isLow(levels[k])).map(([, n]) => n);
  const ok = TANKS.filter(([k]) => levels[k] && !isLow(levels[k])).map(([, n]) => n);
  return [low.length && `Low ${low.join(", ")}.`, ok.length && `Adequate ${ok.join(", ")}.`].filter(Boolean).join(" ");
};

export const routeTrips = (registry, boat) => tripLists(registry).map((t) => {
  const b = tripBoat(boat, t.id);
  const w = b.weather || {};
  return { id: t.id, name: t.name, event: String(w.event_name || "").trim(), start: String(b.route_start || "").trim(), dest: String(b.route_dest || "").trim(), from: dmy(w.depart_at), to: dmy(w.finish_at) };
});
export const pickTrip = (trips, id) => trips.find((t) => t.id === id) || trips.find((t) => t.id === DEFAULT_TRIP) || trips[0] || null;

// "Trip Name Mana-Picton, 1/1/2027 - 10/1/2027"
export const tripLine = (t) => {
  const head = [t.event || t.name, [t.start, t.dest].filter(Boolean).join("-")].filter(Boolean).join(" ");
  return [head, [t.from, t.to].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
};
