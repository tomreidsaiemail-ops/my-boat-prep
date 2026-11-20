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
const LEFT = { dock: "Leaving Dock", transit: "Transiting", ...Object.fromEntries(LEG_KINDS.map((k) => [k.key, k.label])) };
const CAME = { dock: "Returning to Dock", transit: "Passed", ...Object.fromEntries(ARRIVE_KINDS.map((k) => [k.key, k.done])) };

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

// The planned leg being sailed now (underway), with its number; a Transiting one gets a "Passed" button.
export const sailingLeg = (boat, trip) => {
  const n = (boat.legs?.[trip?.id] || []).length;
  if (!trip || !n || boat.underway?.trip_id !== trip.id) return null;
  const tb = tripBoat(boat, trip.id);
  const w = tb.weather || {};
  const leg = [{ route_start: tb.route_start, route_dest: tb.route_dest, arrive_type: w.arrive_type }, ...(w.legs || [])][n - 1];
  return leg ? { ...leg, n } : null;
};

// A Ship's Log entry typed during a trip (underway, or stopped between legs) is kept with the latest leg, so it is folded with the trip.
export const withTripLog = (b, id) => {
  const t = b.underway?.trip_id || b.route_trip;
  const legs = b.legs?.[t] || [];
  if (!legs.length) return b;
  const last = legs[legs.length - 1];
  return { ...b, legs: { ...b.legs, [t]: [...legs.slice(0, -1), { ...last, logs: [...(last.logs || []), id] }] } };
};

const day = (v, iso) => (/^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : iso ? (local(iso).split(" ")[0] || "").split("/").reverse().map((x) => x.padStart(2, "0")).join("-") : "");

// End of trip: the trip's Ship's Log entries stay as they are, grouped like Group Passage into one trip folder
// holding a folder per leg (e.g. "Leg 1: Mana Marina to Tawa Bay, departure 18/11/2026 06:00").
export const foldTrip = (log, legs, tripName) => {
  const owner = new Map();
  legs.forEach((l, n) => (l.logs || []).forEach((id) => owner.set(id, n)));
  const members = log.filter((i) => owner.has(i.id) && !i.in && !i.folder);
  if (!members.length) return null;
  const base = Date.now() + 10;
  const first = legs[0] || {}, last = legs[legs.length - 1] || {};
  const range = (a, b) => ({ from: day(a.depart_at, a.at), to: day(b.actual_finish_at, b.arrived_at) || day(a.depart_at, a.at) });
  const span = range(first, last);
  // "Trip: Depart Mana Marina, Away 2 days, Return Mana Marina": every calendar day counts; Arrive when it ends somewhere else.
  const days = span.from && span.to ? Math.max(1, Math.round((new Date(`${span.to}T12:00`) - new Date(`${span.from}T12:00`)) / 864e5) + 1) : 1;
  const home = (first.start || "").trim().toLowerCase() === (last.dest || "").trim().toLowerCase();
  const trip = { id: base, folder: "passage", trip: true, open: false, checked: false, src: first.start || "", dst: last.dest || "", ...span,
    label: `Trip: Depart ${(first.start || "").trim() || "?"}, Away ${days} day${days === 1 ? "" : "s"}, ${home ? "Return" : "Arrive"} ${(last.dest || "").trim() || "?"}, departure ${dmyt(first.depart_at) || local(first.at) || "not set"} - ${tripName} - ${legs.length} leg${legs.length === 1 ? "" : "s"}` };
  const legFolders = legs.map((l, n) => ({ id: base + 1 + n, in: base, folder: "passage", open: false, checked: false, src: l.start || "", dst: l.dest || "", ...range(l, l),
    label: `Leg ${n + 1}: ${tripHead(l.start, l.dest, l.depart_at, l.at)}` })).filter((f, n) => members.some((m) => owner.get(m.id) === n));
  const ids = new Set(members.map((m) => m.id));
  const at = log.findIndex((i) => ids.has(i.id));
  const moved = log.map((i) => (ids.has(i.id) ? { ...i, in: base + 1 + owner.get(i.id) } : i));
  return [...moved.slice(0, at), trip, ...legFolders, ...moved.slice(at)];
};

// A status check counts as logged only while its Ship's Log entry is still there.
export const liveLog = (b, log = []) => {
  const keep = (d = {}) => (d.log_id && !log.some((i) => i.id === d.log_id) ? { ...d, log_id: null, log_sig: "" } : d);
  return { ...b, depart: keep(b.depart), arrive: keep(b.arrive) };
};
