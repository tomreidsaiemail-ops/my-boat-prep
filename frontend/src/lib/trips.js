import { routeNotes, when } from "@/lib/routeNotes";

// Each Route Planning list (the original and its copies) is a trip with its own details, crew and replies.
export const DEFAULT_TRIP = "routeHazards";
export const isTripList = (l) => !!l && (l.id === DEFAULT_TRIP || !!l.trip || /^(route|trip) planning\b/i.test(l.name || ""));
export const tripLists = (registry = []) => registry.filter(isTripList).map((l) => ({ id: l.id, name: l.name }));
export const tripBoat = (boat = {}, id) => {
  if (id === DEFAULT_TRIP) return boat;
  const t = boat.trips?.[id] || {};
  return { ...boat, route_start: t.route_start || "", route_dest: t.route_dest || "", weather: t.weather || {} };
};
export const tripsWithPlans = (state) => tripLists(state?.registry || []).map((t) => {
  const b = tripBoat(state?.boat || {}, t.id);
  return { ...t, plan: routeNotes(b), event: String(b.weather?.event_name || "").trim(), start: when(b.weather?.event_at || "") };
});
export const openList = (id) => window.dispatchEvent(new CustomEvent("mbp:open-list", { detail: id }));
// Each trip's departure and end of trip (its last planned leg's finish), for trips with both set.
export const tripWindows = (registry = [], boat = {}) => tripLists(registry).map((t) => {
  const w = tripBoat(boat, t.id).weather || {};
  const legs = w.legs || [];
  return { id: t.id, name: t.name, departAt: w.depart_at || "", endAt: legs[legs.length - 1]?.finish_at || w.finish_at || "" };
}).filter((t) => t.departAt.length >= 16 && t.endAt.length >= 16 && t.endAt > t.departAt);
