import { DEFAULT_TRIP, tripBoat, tripLists } from "@/lib/trips";

export const statLine = (s = {}) => [`${s.ticked || 0}/${s.total || 0} ticked`, `${s.crew || 0} crew`, s.points ? `${s.distance_nm} nm tracked` : "no GPS path"].join(" · ");
const SNOOZE_KEY = "mbp_trip_done_snooze";
const today = () => new Date().toLocaleDateString("en-CA");
const day = (v, t) => (v && v.length === 10 ? `${v}T${t}` : v);
const iso = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null; };

export const tripDetails = (boat, id) => (id === DEFAULT_TRIP
  ? { route_start: boat.route_start || "", route_dest: boat.route_dest || "", weather: boat.weather || {} }
  : boat.trips?.[id] || {});

const withDetails = (boat, id, d) => {
  if (id === DEFAULT_TRIP) return { ...boat, route_start: d.route_start || "", route_dest: d.route_dest || "", weather: d.weather || {} };
  const { [id]: _old, ...rest } = boat.trips || {}; // eslint-disable-line no-unused-vars
  return { ...boat, trips: Object.keys(d).length ? { ...rest, [id]: d } : rest };
};

export const archivePayload = (s, id) => {
  const list = s.registry.find((l) => l.id === id) || { name: "Route Planning" };
  const w = tripBoat(s.boat, id).weather || {};
  return { trip_id: id, name: list.name, description: list.description || "", items: s.data[id] || [], details: tripDetails(s.boat, id),
    depart_at: w.depart_at || "", finish_at: w.finish_at || "", window: { start: iso(day(w.depart_at, "00:00")), end: iso(day(w.finish_at, "23:59")) } };
};

// Clean slate: every tick, date, route and weather note on the trip is cleared (crew are taken off on the server).
export const resetTrip = (s, id) => ({
  ...s, boat: withDetails(s.boat, id, {}),
  data: { ...s.data, [id]: (s.data[id] || []).map(({ checked_by: _c, ...i }) => ({ ...i, checked: false })) }, // eslint-disable-line no-unused-vars
});

const filled = (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.values(v).some(filled) : !!String(v ?? "").trim());
const blankTrip = (s, id) => !(s.data[id] || []).some((i) => i.checked) && !filled(tripDetails(s.boat, id));

// Back into the same list when it's gone or still a clean slate; otherwise into a new copy so the current voyage isn't overwritten.
export const restoreTarget = (s, a) => {
  const list = s.registry.find((l) => l.id === a.trip_id);
  if (!list) return { id: a.trip_id, name: a.name, add: true };
  if (blankTrip(s, a.trip_id)) return { id: a.trip_id, name: list.name };
  return { id: `custom_${Date.now()}`, name: `${a.name} (restored)`.slice(0, 200), add: true };
};

export const restoreTrip = (s, r, to) => ({
  ...s,
  registry: to.add ? [...s.registry, { id: to.id, name: to.name, isSystem: to.id === DEFAULT_TRIP, ...(to.id === DEFAULT_TRIP ? {} : { trip: true }), ...(r.description ? { description: r.description } : {}) }] : s.registry,
  deleted_lists: (s.deleted_lists || []).filter((x) => x !== to.id),
  list_hidden: (s.list_hidden || []).filter((x) => x !== to.id),
  data: { ...s.data, [to.id]: r.items || [] },
  boat: withDetails(s.boat, to.id, r.details || {}),
});

const snoozes = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}"); } catch { return {}; } };
export const snoozeTrip = (boatKey, id) => localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...snoozes(), [`${boatKey}:${id}`]: today() }));

// The first trip whose estimated finish has passed and that wasn't put off today.
export const finishedTrip = (s, boatKey) => {
  const off = snoozes();
  return tripLists(s.registry).map((t) => ({ ...t, finish: tripBoat(s.boat, t.id).weather?.finish_at || "" }))
    .find((t) => iso(t.finish) && new Date(t.finish.length === 10 ? `${t.finish}T23:59` : t.finish) < new Date() && off[`${boatKey}:${t.id}`] !== today()) || null;
};
