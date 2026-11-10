import { routeNotes } from "@/lib/routeNotes";

// Each Route Planning list (the original and its copies) is a trip with its own details, crew and replies.
export const DEFAULT_TRIP = "routeHazards";
export const isTripList = (l) => !!l && (l.id === DEFAULT_TRIP || !!l.trip || /^route planning\b/i.test(l.name || ""));
export const tripLists = (registry = []) => registry.filter(isTripList).map((l) => ({ id: l.id, name: l.name }));
export const tripBoat = (boat = {}, id) => {
  if (id === DEFAULT_TRIP) return boat;
  const t = boat.trips?.[id] || {};
  return { ...boat, route_start: t.route_start || "", route_dest: t.route_dest || "", weather: t.weather || {} };
};
export const tripsWithPlans = (state) => tripLists(state?.registry || []).map((t) => ({ ...t, plan: routeNotes(tripBoat(state?.boat || {}, t.id)) }));
export const openList = (id) => window.dispatchEvent(new CustomEvent("mbp:open-list", { detail: id }));
