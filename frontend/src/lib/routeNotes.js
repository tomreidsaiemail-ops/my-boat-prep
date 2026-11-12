export const MEETUP_DEFAULT = "Pier X, Berth YYY, be onboard no later than ONE HOUR before DEPARTURE, as that is when the crew briefing will begin.";
export const ROUTE_NOTE = "These planning details and more are on the Route Planning list when you log into My Boat Prep.";

export const when = (v) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v || "")) {
    try { return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${v}T12:00`)); } catch { return v; }
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v || "")) return "";
  try { return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)); } catch { return v; }
};

// Suggested "Planned voyage or race notes" for crew invites, built from the Route Planning answers.
export const routeNotes = (boat = {}) => {
  const w = boat.weather || {};
  const t = (s) => String(s || "").trim();
  const event = [t(w.event_name), when(w.event_at)].filter(Boolean).join(", ");
  const lines = [
    t(boat.route_start) && `Start: ${t(boat.route_start)}`,
    t(boat.route_dest) && `Destination: ${t(boat.route_dest)}`,
    t(w.why) && `Why we're going: ${t(w.why)}`,
    when(w.depart_at) && `Departure: ${when(w.depart_at)}`,
    event && `Event or trip: ${event}`,
    when(w.finish_at) && `Estimated finish: ${when(w.finish_at)}`,
  ].filter(Boolean);
  if (!lines.length) return "";
  const meet = t(w.meetup ?? MEETUP_DEFAULT);
  const body = [...lines, meet && `Meet up: ${meet}`].filter(Boolean).join("\n");
  return `${body.slice(0, 1000 - ROUTE_NOTE.length - 2)}\n\n${ROUTE_NOTE}`;
};
