import { LEG_KINDS, dmyt, headingItems } from "@/lib/allDone";
import { tripBoat } from "@/lib/trips";

// How each stop on a trip was reached on Arriving at Destination; each ticks its own If... group.
export const ARRIVE_KINDS = [
  { key: "berth", label: "Arrive Berth?", done: "Arrive Berth", heading: "if berthing" },
  { key: "anchor", label: "Drop Anchor?", done: "Drop Anchor", heading: "if anchoring" },
  { key: "mooring", label: "Arrive Mooring?", done: "Arrive Mooring", heading: "if mooring" },
];

// Items outside every If... and When leaving... group apply to all arrivals.
export const generalIds = (list) => {
  const grouped = new Set([...LEG_KINDS, ...ARRIVE_KINDS].flatMap((k) => headingItems(list, k.heading)));
  return list.filter((i) => !grouped.has(i.id)).map((i) => i.id);
};
export const arrivalTicks = (list, key) => new Set([...generalIds(list), ...headingItems(list, ARRIVE_KINDS.find((k) => k.key === key)?.heading || "")]);

const local = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const LEFT = { dock: "Leaving Dock", ...Object.fromEntries(LEG_KINDS.map((k) => [k.key, k.label])) };
const CAME = { dock: "Returning to Dock", ...Object.fromEntries(ARRIVE_KINDS.map((k) => [k.key, k.done])) };

// The current leg's START and DESTINATION, and its departure levels, for arrival checks part way through a trip.
export const legBoat = (b = {}) => {
  const legs = b.legs?.[b.underway?.trip_id] || [];
  const last = legs[legs.length - 1];
  if (last && last.kind !== "dock" && (last.start || last.dest)) return { ...b, route_start: last.start, route_dest: last.dest, ...(last.levels ? { depart: { levels: last.levels } } : {}) };
  // After ARRIVED (no longer underway) the logged arrival keeps the leg it ended.
  const leg = b.arrive?.leg;
  return leg ? { ...b, route_start: leg.start, route_dest: leg.dest, ...(leg.levels ? { depart: { levels: leg.levels } } : {}) } : b;
};

// "Mana Marina to Ship Cove, departure 19/11/2026 09:00": the first words of every departure and arrival log.
export const tripHead = (start, dest, departAt, at = "") => `${[start, dest].filter(Boolean).join(" to ") || "Route not set"}, departure ${dmyt(departAt) || local(at) || "not set"}`;
// The leg being sailed now (or just arrived from).
export const legHead = (b = {}) => {
  const legs = b.legs?.[b.underway?.trip_id || b.route_trip] || [];
  const last = legs[legs.length - 1];
  if (last) return tripHead(last.start, last.dest, last.depart_at, last.at);
  const lb = legBoat(b);
  return tripHead(lb.route_start, lb.route_dest, "");
};

// The next planned Route Planning leg after the legs already sailed on this trip (Leg 1 is the Route Plan itself).
export const nextLeg = (boat, trip) => {
  if (!trip) return null;
  const tb = tripBoat(boat, trip.id);
  const w = tb.weather || {};
  const planned = [{ route_start: tb.route_start, route_dest: tb.route_dest, depart_at: w.depart_at, finish_at: w.finish_at, arrive_type: w.arrive_type }, ...(w.legs || [])];
  const n = (boat.legs?.[trip.id] || []).length;
  const leg = planned[n];
  return leg && (leg.route_start || leg.route_dest) ? { ...leg, n: n + 1 } : null;
};

// A Ship's Log entry typed during a trip (underway, or stopped between legs) is kept with the latest leg, so it is folded with the trip.
export const withTripLog = (b, id) => {
  const t = b.underway?.trip_id || b.route_trip;
  const legs = b.legs?.[t] || [];
  if (!legs.length) return b;
  const last = legs[legs.length - 1];
  return { ...b, legs: { ...b.legs, [t]: [...legs.slice(0, -1), { ...last, logs: [...(last.logs || []), id] }] } };
};

const legLine = (l, n) => {
  const route = [l.start, l.dest].filter(Boolean).join(" to ") || "Route not set";
  // The Departure the skipper entered for the leg, else when DEPART was tapped.
  const left = `departed ${dmyt(l.depart_at) || local(l.at) || "?"}${LEFT[l.kind] ? ` (${LEFT[l.kind]})` : ""}`;
  const came = l.arrived_at ? `, arrived ${dmyt(l.actual_finish_at) || local(l.arrived_at)} (${CAME[l.arrival] || l.arrived_list || "arrived"})` : "";
  return `Leg ${n + 1}: ${route}, ${left}${came}.${l.why ? ` Why: ${l.why}` : ""}`;
};

// Returning to Dock: every leg's Ship's Log entries become one tidy trip entry (nothing is lost; the old entries sit in its detail).
export const foldTrip = (log, legs, tripName, when) => {
  const ids = new Set(legs.flatMap((l) => l.logs || []));
  const folded = log.filter((i) => ids.has(i.id));
  if (!folded.length) return null;
  const first = legs[0] || {}, last = legs[legs.length - 1] || {};
  const route = [first.start, last.dest].filter(Boolean).join(" to ");
  const dates = [...new Set([(dmyt(first.depart_at) || local(first.at)).split(" ")[0], (dmyt(last.actual_finish_at) || local(last.arrived_at || "")).split(" ")[0]].filter(Boolean))].join(" - ");
  const photos = folded.flatMap((i) => i.weather_photos || []);
  const detail = [...legs.map(legLine), "", "Ship's Log entries folded into this trip:", ...folded.map((i) => `- ${i.label}${i.detail ? `\n${i.detail}` : ""}`)].join("\n");
  return {
    ids,
    entry: { id: Date.now() + 2, checked: false, label: `${tripHead(first.start, last.dest, first.depart_at, first.at)} - Trip - Route Plan: ${tripName}${route ? ` - ${route}` : ""}${dates ? `, ${dates}` : ""} - ${legs.length} leg${legs.length === 1 ? "" : "s"} - ${when}`,
      detail, ...(photos.length ? { weather_photos: photos } : {}) },
  };
};

// A status check counts as logged only while its Ship's Log entry is still there.
export const liveLog = (b, log = []) => {
  const keep = (d = {}) => (d.log_id && !log.some((i) => i.id === d.log_id) ? { ...d, log_id: null, log_sig: "" } : d);
  return { ...b, depart: keep(b.depart), arrive: keep(b.arrive) };
};
