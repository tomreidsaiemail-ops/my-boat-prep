import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { stampTicks } from "@/components/boat/TickBadge";
import { stamp } from "@/components/boat/departure/LogCopy";
import { logBlock } from "@/components/boat/departure/DepartureCheck";
import { departureDecision } from "@/components/boat/navigator/DepartureLogDialog";
import { arrivalSummary, arrivalUsage, departureSummary, passagePlan } from "@/lib/telemetry";
import { DEFAULT_TRIP, tripBoat } from "@/lib/trips";
import { levelsBlock, pickTrip, routeTrips, tankSummary, tripLine } from "@/lib/allDone";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const tracked = (boatId, t) => window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boatId, tracking: t } }));
const tickAll = (list, by) => stampTicks(list, list.map((i) => ({ ...i, checked: true })), by);
const markLogged = (w = {}) => ({ ...w, photos: (w.photos || []).map((p) => ({ ...p, logged: true })) });

// Adds the status entry, or updates the one already copied when it changed since.
const putLog = (log, d, text, sig, extra = {}) => {
  if (!d.log_id || !log.some((i) => i.id === d.log_id)) { const id = Date.now(); return [[...log, { id, label: text.slice(0, 2000), checked: false }], { ...d, log_id: id, log_sig: sig, ...extra }]; }
  if (d.log_sig === sig) return [log, d];
  return [log.map((i) => (i.id === d.log_id ? { ...i, label: text.slice(0, 2000) } : i)), { ...d, log_sig: sig, ...extra }];
};
const statusStep = (d, sig, what, summary) => {
  const done = d.log_id && d.log_sig === sig;
  return { id: "status", text: `${done ? `${what} is already in the Ship's Log` : `${d.log_id ? "Update" : "Copy"} the ${what.toLowerCase()} into the Ship's Log`}${summary ? `: ${summary}` : ""}` };
};

// DEPART, ALL CHECKS DONE and ARRIVED, ALL CHECKS DONE: one confirm window, then ticks, logs, Underway and shore contacts.
export default function useAllDone({ state, mutate, tickedBy, online, boatId, trackingOn }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const setShore = (step, contacts) => setPlan((p) => (p?.kind === "depart" ? { ...p, contacts, steps: p.steps.map((s) => (s.id === "shore" ? { id: "shore", ...step } : s)) } : p));

  const openDepart = () => {
    const b = state.boat || {};
    const d = b.depart || {};
    const trip = pickTrip(routeTrips(state.registry, b), b.route_trip);
    if (!trip) return;
    const list = state.data.leavingDock || [];
    const w = tripBoat(b, trip.id).weather || {};
    const photos = (w.photos || []).length;
    const ticked = list.filter((i) => i.checked).length;
    const askShore = online && !trackingOn;
    const steps = [
      { id: "tick", text: `Tick all ${plural(list.length, "Leaving the Dock item")}${ticked ? ` (${ticked} already ticked)` : ""}` },
      statusStep(d, departureSummary(b, d, passagePlan(b, d), ""), "Tank and battery status", tankSummary(d.levels)),
      { id: "route", text: `Log the route plan: ${tripLine(trip)}${w.why?.trim() ? `\nWhy we're going: ${w.why.trim()}` : ""}${photos ? `\nWith ${plural(photos, "weather and routing photo")}` : ""}` },
      { id: "underway", text: `Show Underway on ${trip.name}` },
      { id: "shore", ...(trackingOn ? { tone: "info", text: "Position sharing with shore contacts is already on" }
        : !online ? { tone: "warn", text: "No signal, so position sharing with shore contacts can't be turned on now" }
          : { tone: "info", text: "Checking your shore contacts..." }) },
    ];
    const blocked = levelsBlock(b, d.levels) || logBlock(b, d);
    setPlan({ kind: "depart", trip, blocked, steps, contacts: 0 });
    if (!blocked && askShore) {
      api.get(`/boats/${boatId}/shore`, { timeout: 10000 }).then(({ data }) => {
        const n = (data.contacts || []).length;
        setShore(n ? { text: `Turn on position sharing with your ${plural(n, "shore contact")}` } : { tone: "info", text: "No shore contact set up, so position sharing stays off" }, n);
      }).catch(() => setShore({ tone: "warn", text: "Couldn't check your shore contacts, so position sharing stays as it is" }, 0));
    }
  };

  const openArrive = (listId, listName) => {
    const b = state.boat || {};
    const a = b.arrive || {};
    const u = b.underway || {};
    const list = state.data[listId] || [];
    const sig = arrivalSummary(b, b.depart || {}, a, arrivalUsage(b, b.depart || {}, a), "", listName);
    const steps = [
      { id: "tick", text: `Tick all ${plural(list.length, `${listName} item`)}` },
      statusStep(a, sig, "Arrival levels and what was used", tankSummary(a.levels)),
      { id: "route", text: `Log your arrival${u.line ? `: ${u.line}` : ""}` },
      ...(u.trip_id ? [{ id: "underway", text: `Clear Underway from ${u.name}` }] : []),
      { id: "shore", ...(!trackingOn ? { tone: "info", text: "Position sharing isn't on, so no shore contact message is sent" }
        : online ? { text: "Tell your shore contacts you arrived safely and stop sharing your position" }
          : { tone: "warn", text: "No signal, so shore contacts can't be told yet. Tap Arrived safely in Crew > Shore Contacts when you have signal." }) },
    ];
    setPlan({ kind: "arrive", listId, listName, blocked: levelsBlock(b, a.levels), steps });
  };

  const depart = async () => {
    const { trip, contacts } = plan;
    const line = tripLine(trip);
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const [log, dep] = putLog(s.data.shipsLog || [], d, departureSummary(b, d, passagePlan(b, d), stamp()), departureSummary(b, d, passagePlan(b, d), ""));
      const entry = { ...departureDecision(tripBoat(b, trip.id)), id: Date.now() + 1, label: `Departed, all checks done - ${line} - ${stamp()}` };
      const weather = trip.id === DEFAULT_TRIP ? { weather: markLogged(b.weather) }
        : { trips: { ...(b.trips || {}), [trip.id]: { ...(b.trips?.[trip.id] || {}), weather: markLogged(b.trips?.[trip.id]?.weather) } } };
      const boat = { ...b, ...weather, depart: { ...dep, trip_id: trip.id }, route_trip: trip.id, underway: { trip_id: trip.id, name: trip.name, line, at: new Date().toISOString() } };
      return { ...s, boat, data: { ...s.data, leavingDock: tickAll(s.data.leavingDock || [], tickedBy), shipsLog: [...log, entry] } };
    });
    toast.success(`Underway on ${trip.name}. Departure logged in the Ship's Log`);
    if (contacts && online && !trackingOn) {
      setBusy(true);
      try {
        const { data } = await api.put(`/boats/${boatId}/shore/tracking`, { on: true });
        tracked(boatId, { on: data.on, trip_id: data.trip_id });
        toast.success("Sharing your position with shore contacts");
      } catch (e) { toast.error(apiError(e, "Couldn't turn on position sharing")); }
      setBusy(false);
    }
    setPlan(null);
  };

  const arrive = async () => {
    const { listId, listName } = plan;
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const a = b.arrive || {};
      const use = arrivalUsage(b, d, a);
      const [log, arr] = putLog(s.data.shipsLog || [], a, arrivalSummary(b, d, a, use, stamp(), listName), arrivalSummary(b, d, a, use, "", listName), { log_list: listName });
      const u = b.underway || {};
      const entry = { id: Date.now() + 1, checked: false, label: `Arrived, all checks done (${listName})${u.line ? ` - ${u.line}` : ""} - ${stamp()}` };
      return { ...s, boat: { ...b, arrive: arr, underway: {} }, data: { ...s.data, [listId]: tickAll(s.data[listId] || [], tickedBy), shipsLog: [...log, entry] } };
    });
    toast.success("Arrival logged in the Ship's Log");
    if (trackingOn && online) {
      setBusy(true);
      try {
        const { data } = await api.post(`/boats/${boatId}/shore/arrived`);
        tracked(boatId, { on: false, trip_id: data.trip_id });
        toast.success(data.told ? `${data.emailed ? "Emailed" : "Couldn't email, but told"} ${plural(data.told, "shore contact")} you arrived safely.` : "Trip finished. Add a shore contact to tell someone next time.");
      } catch (e) { toast.error(apiError(e, "Couldn't tell your shore contacts")); }
      setBusy(false);
    }
    setPlan(null);
  };

  return { plan, busy, openDepart, openArrive, confirm: () => (plan?.kind === "depart" ? depart() : arrive()), close: () => setPlan(null) };
}
