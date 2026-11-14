import { batteriesOf, batteryName, isLow } from "@/lib/telemetry";
import { DEFAULT_TRIP, tripBoat, tripLists } from "@/lib/trips";

const TANKS = [["fuel", "Fuel"], ["gas", "LPG"], ["water", "Water"]];
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ""); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ""; };
export const dmyt = (v) => [dmy(v), (v || "").slice(11, 16)].filter(Boolean).join(" ");

export const missingLevels = (boat, levels = {}) => [...TANKS, ...batteriesOf(boat).map((b) => [`bat_${b.id}`, batteryName(b)])]
  .filter(([k]) => !levels[k]).map(([, n]) => n);
export const levelsBlock = (boat, levels) => { const m = missingLevels(boat, levels); return m.length ? `Pick a level for ${m.join(", ")} first.` : ""; };

// "Adequate Fuel, LPG, Water." with any tank at 1/4 or empty called out as low.
export const tankSummary = (levels = {}) => {
  const low = TANKS.filter(([k]) => isLow(levels[k])).map(([, n]) => n);
  const ok = TANKS.filter(([k]) => levels[k] && !isLow(levels[k])).map(([, n]) => n);
  return [low.length && `Low ${low.join(", ")}.`, ok.length && `Adequate ${ok.join(", ")}.`].filter(Boolean).join(" ");
};

export const routeTrips = (registry, boat) => tripLists(registry).map((t) => {
  const b = tripBoat(boat, t.id);
  const w = b.weather || {};
  const startAt = w.depart_at || "";
  return { id: t.id, name: t.name, event: String(w.event_name || "").trim(), start: String(b.route_start || "").trim(), dest: String(b.route_dest || "").trim(),
    from: dmy(w.depart_at), to: dmy(w.finish_at), startDay: startAt.slice(0, 10), startOn: dmy(startAt), departAt: w.depart_at || "", finishAt: w.finish_at || "", why: String(w.why || "").trim() };
});

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Route Plans departing today, earliest Departure time first.
const todays = (trips) => trips.filter((t) => t.startDay === today()).sort((a, b) => (a.departAt || "~").localeCompare(b.departAt || "~"));

// The skipper's pick holds for the day it was made; otherwise today's earliest departure.
export const pickTrip = (trips, id, day) => (day === today() && trips.find((t) => t.id === id))
  || todays(trips)[0] || trips.find((t) => t.id === DEFAULT_TRIP) || trips[0] || null;

export const tripIssue = (trips, trip) => {
  if (!trip || trip.startDay === today()) return "";
  const first = todays(trips)[0];
  if (!first) return "No Route Plan starts today. Set today's DEPARTURE DATE in Route Planning before you depart.";
  return `${trip.name} ${trip.startOn ? `departs ${trip.startOn}, not today` : "has no Departure date"}. Pick ${first.name} or change its Departure date before you depart.`;
};

// "Trip Name Mana-Picton, 1/1/2027 - 10/1/2027"
export const tripLine = (t) => {
  const head = [t.event || t.name, [t.start, t.dest].filter(Boolean).join("-")].filter(Boolean).join(" ");
  return [head, [t.from, t.to].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
};

export const tripTimes = (t) => [`Departure: ${dmyt(t.departAt) || "not set"}`, `Estimated arrival: ${dmyt(t.finishAt) || "not set"}`];

// What the shore contact page shows after DEPART.
export const shorePlan = (t) => [`Route Plan: ${t.name}`, tripLine(t), ...tripTimes(t), t.why && `Why we're going: ${t.why}`].filter(Boolean).join("\n");

// Arriving at Destination holds interim departures under these headings; ARRIVED leaves them unticked.
export const LEG_KINDS = [
  { key: "berth", label: "Leave Berth", heading: "leaving berth" },
  { key: "anchor", label: "Weigh Anchor", heading: "weighing anchor" },
  { key: "mooring", label: "Leave Mooring", heading: "leaving mooring" },
];
const nested = (i) => i.indent || (i.level || 0) > 1;
// The heading item whose name matches, and every indented item under it.
export const headingItems = (list, phrase) => {
  const at = list.findIndex((i) => !nested(i) && String(i.label || "").toLowerCase().includes(phrase));
  if (at < 0) return [];
  const end = list.findIndex((i, n) => n > at && !nested(i));
  return list.slice(at, end < 0 ? list.length : end).map((i) => i.id);
};
export const legIds = (list) => new Set(LEG_KINDS.flatMap((k) => headingItems(list, k.heading)));

const pad = (n) => String(n).padStart(2, "0");
export const nowLocal = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Today's leg shown like a Route Plan, under the plan it belongs to.
export const legTrip = (trip, leg) => {
  const w = leg.weather || {};
  return { id: trip.id, name: trip.name, event: String(w.event_name || "").trim(), start: String(leg.route_start || "").trim(), dest: String(leg.route_dest || "").trim(),
    from: dmy(w.depart_at), to: dmy(w.finish_at), departAt: w.depart_at || "", finishAt: w.finish_at || "", why: String(w.why || "").trim() };
};
