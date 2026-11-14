import { useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { stampTicks } from "@/components/boat/TickBadge";
import { stamp } from "@/components/boat/departure/LogCopy";
import { logBlock } from "@/components/boat/departure/DepartureCheck";
import { departureDecision } from "@/components/boat/navigator/DepartureLogDialog";
import { arrivalSummary, arrivalUsage, departureSummary, passagePlan } from "@/lib/telemetry";
import { DEFAULT_TRIP, tripBoat } from "@/lib/trips";
import { ARRIVE_KINDS, arrivalTicks, foldTrip } from "@/lib/tripFold";
import { LEG_KINDS, headingItems, legIds, legTrip, levelsBlock, pickTrip, routeTrips, shorePlan, tankSummary, today, tripIssue, tripLine, tripTimes } from "@/lib/allDone";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const tracked = (boatId, t) => window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boatId, tracking: t } }));
// Skipped items are unticked, ready for the next departure.
const tickAll = (list, by, skip = new Set()) => stampTicks(list, list.map((i) => ({ ...i, checked: !skip.has(i.id) })), by);
// Arriving at Destination keeps its interim departure items (When leaving berth...) for the next leg.
const arriveSkip = (listId, list) => (listId === "arrivingDest" ? legIds(list) : new Set());
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
  const setShore = (step, contacts) => setPlan((p) => (p?.kind === "depart" ? { ...p, contacts, checking: false, steps: p.steps.map((s) => (s.id === "shore" ? { id: "shore", ...step } : s)) } : p));

  const openDepart = () => {
    const b = state.boat || {};
    const d = b.depart || {};
    const trips = routeTrips(state.registry, b);
    const trip = pickTrip(trips, b.route_trip, b.route_trip_day);
    if (!trip) return;
    const list = state.data.leavingDock || [];
    const w = tripBoat(b, trip.id).weather || {};
    const photos = (w.photos || []).length;
    const ticked = list.filter((i) => i.checked).length;
    const askShore = online;
    const steps = [
      { id: "tick", text: `Tick all ${plural(list.length, "Leaving the Dock item")}${ticked ? ` (${ticked} already ticked)` : ""}` },
      statusStep(d, departureSummary(b, d, passagePlan(b, d), ""), "Tank and battery status", tankSummary(d.levels)),
      { id: "route", text: `Log the route plan: ${tripLine(trip)}\n${tripTimes(trip).join("\n")}${w.why?.trim() ? `\nWhy we're going: ${w.why.trim()}` : ""}${photos ? `\nWith ${plural(photos, "weather and routing photo")}` : ""}` },
      { id: "underway", text: `Show Underway on Route Plan: ${trip.name}` },
      { id: "shore", ...(!online ? { tone: "warn", text: "No signal, so position sharing and the route plan can't be shared with shore contacts now" }
        : { tone: "info", text: "Checking your shore contacts..." }) },
    ];
    const blocked = tripIssue(trips, trip) || levelsBlock(b, d.levels) || logBlock(b, d);
    setPlan({ kind: "depart", trip, blocked, steps, contacts: 0, checking: !blocked && askShore });
    if (!blocked && askShore) {
      api.get(`/boats/${boatId}/shore`, { timeout: 10000 }).then(({ data }) => {
        const n = (data.contacts || []).length;
        const who = plural(n, "shore contact");
        setShore(!n ? { tone: "info", text: "No shore contact set up, so position sharing stays off" }
          : { text: `${trackingOn ? "Position sharing is already on. Show" : "Turn on position sharing and show"} the route plan on the page of your ${who}` }, n);
      }).catch(() => setShore({ tone: "warn", text: "Couldn't check your shore contacts, so position sharing stays as it is" }, 0));
    }
  };

  const openArrive = (listId, listName) => {
    const b = state.boat || {};
    const a = b.arrive || {};
    const u = b.underway || {};
    const list = state.data[listId] || [];
    const sig = arrivalSummary(b, b.depart || {}, a, arrivalUsage(b, b.depart || {}, a), "", listName);
    const stop = listId === "arrivingDest";
    const legs = b.legs?.[u.trip_id] || [];
    const fold = listId === "returningDock" && legs.some((l) => l.logs?.length);
    const choices = stop ? ARRIVE_KINDS.map((k) => {
      const n = arrivalTicks(list, k.key).size;
      return { ...k, text: `Ticks ${plural(n, "item")}: the ones for every arrival, plus everything under ${k.heading.replace(/^if/, "If")}` };
    }) : null;
    const steps = [
      { id: "tick", text: stop ? "Pick how you arrived below. The If... and When leaving... groups for other arrivals and departures are unticked, ready for next time" : `Tick all ${plural(list.length, `${listName} item`)}` },
      statusStep(a, sig, "Arrival levels and what was used", tankSummary(a.levels)),
      { id: "route", text: `Log your arrival${u.line ? `: ${u.line}` : ""}` },
      ...(u.trip_id ? [{ id: "underway", text: `Clear Underway from ${u.name}` }] : []),
      ...(fold ? [{ id: "fold", text: `Fold this trip's ${plural(legs.length, "leg")} and their Ship's Log entries into one tidy trip entry` }] : []),
      { id: "shore", ...(!trackingOn ? { tone: "info", text: "Position sharing isn't on, so no shore contact message is sent" }
        : online ? { text: "Tell your shore contacts you arrived safely and stop sharing your position" }
          : { tone: "warn", text: "No signal, so shore contacts can't be told yet. Tap Arrived safely in Crew > Shore Contacts when you have signal." }) },
    ];
    setPlan({ kind: "arrive", listId, listName, blocked: levelsBlock(b, a.levels), steps, choices });
  };

  const depart = async () => {
    const { trip, contacts } = plan;
    const line = tripLine(trip);
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const [log, dep] = putLog(s.data.shipsLog || [], d, departureSummary(b, d, passagePlan(b, d), stamp()), departureSummary(b, d, passagePlan(b, d), ""));
      const entry = { ...departureDecision(tripBoat(b, trip.id)), id: Date.now() + 1, label: `Departed, all checks done - Route Plan: ${trip.name} - ${line}. ${tripTimes(trip).join(", ")} - ${stamp()}` };
      const weather = trip.id === DEFAULT_TRIP ? { weather: markLogged(b.weather) }
        : { trips: { ...(b.trips || {}), [trip.id]: { ...(b.trips?.[trip.id] || {}), weather: markLogged(b.trips?.[trip.id]?.weather) } } };
      // Leaving Dock starts the trip's legs afresh; each later stop and departure is added to them.
      const leg = { id: entry.id, kind: "dock", start: trip.start, dest: trip.dest, depart_at: trip.departAt, finish_at: trip.finishAt, why: trip.why, at: new Date().toISOString(), logs: [dep.log_id, entry.id] };
      const boat = { ...b, ...weather, depart: { ...dep, trip_id: trip.id }, route_trip: trip.id, route_trip_day: today(), legs: { ...(b.legs || {}), [trip.id]: [leg] },
        underway: { trip_id: trip.id, name: trip.name, line, at: new Date().toISOString() } };
      return { ...s, boat, data: { ...s.data, leavingDock: tickAll(s.data.leavingDock || [], tickedBy), shipsLog: [...log, entry] } };
    });
    toast.success(`Underway on ${trip.name}. Departure logged in the Ship's Log`);
    if (contacts && online) {
      setBusy(true);
      try {
        if (!trackingOn) {
          const { data } = await api.put(`/boats/${boatId}/shore/tracking`, { on: true });
          tracked(boatId, { on: data.on, trip_id: data.trip_id });
        }
        await api.put(`/boats/${boatId}/shore/plan`, { text: shorePlan(trip).slice(0, 1500) });
        toast.success("Sharing your position and route plan with shore contacts");
      } catch (e) { toast.error(apiError(e, "Couldn't share with your shore contacts")); }
      setBusy(false);
    }
    setPlan(null);
  };

  const arrive = async (how) => {
    const { listId, listName } = plan;
    const kind = ARRIVE_KINDS.find((k) => k.key === how);
    const folded = plan.steps.some((x) => x.id === "fold");
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const a = b.arrive || {};
      const use = arrivalUsage(b, d, a);
      const [log, arr] = putLog(s.data.shipsLog || [], a, arrivalSummary(b, d, a, use, stamp(), listName), arrivalSummary(b, d, a, use, "", listName), { log_list: listName });
      const u = b.underway || {};
      const entry = { id: Date.now() + 1, checked: false, label: `Arrived, all ${kind ? "arrival " : ""}checks done${kind ? `, ${kind.done}` : ""} (${listName})${u.line ? ` - ${u.line}` : ""} - ${stamp()}` };
      // The arrival closes the trip's latest leg, so each voyage and arrival is kept with the overall trip.
      let legs = b.legs?.[u.trip_id] || [];
      const last = legs[legs.length - 1];
      if (last && !last.arrived_at) {
        legs = [...legs.slice(0, -1), { ...last, arrived_at: new Date().toISOString(), arrived_list: listName, arrival: kind?.key || "dock", logs: [...(last.logs || []), arr.log_id, entry.id] }];
      }
      let shipsLog = [...log, entry];
      let keep = legs;
      const trip = listId === "returningDock" && legs.length ? foldTrip(shipsLog, legs, u.name || "Route Plan", stamp()) : null;
      if (trip) { shipsLog = [...shipsLog.filter((i) => !trip.ids.has(i.id)), trip.entry]; keep = []; }
      const list = s.data[listId] || [];
      const ticks = kind ? stampTicks(list, list.map((i) => ({ ...i, checked: arrivalTicks(list, kind.key).has(i.id) })), tickedBy) : tickAll(list, tickedBy, arriveSkip(listId, list));
      return { ...s, boat: { ...b, ...(u.trip_id ? { legs: { ...(b.legs || {}), [u.trip_id]: keep } } : {}), arrive: arr, underway: {} }, data: { ...s.data, [listId]: ticks, shipsLog } };
    });
    toast.success(folded ? "Trip folded into one Ship's Log entry" : "Arrival logged in the Ship's Log");
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

  // New departure... on Arriving at Destination: today's leg is appended to the Route Plan, its heading's items ticked and logged.
  const interimTrip = () => {
    const b = state.boat || {};
    const trips = routeTrips(state.registry, b);
    return trips.find((t) => t.id === b.underway?.trip_id) || pickTrip(trips, b.route_trip, b.route_trip_day);
  };
  const interimDepart = async (kind, leg) => {
    const trip = interimTrip();
    if (!trip) { toast.error("Add a Route Planning list first"); return false; }
    const k = LEG_KINDS.find((x) => x.key === kind);
    const lt = legTrip(trip, leg);
    const w = leg.weather || {};
    const ticked = headingItems(state.data.arrivingDest || [], k.heading).length;
    mutate((s) => {
      const b = s.boat;
      const list = s.data.arrivingDest || [];
      const ids = new Set(headingItems(list, k.heading));
      const entry = { ...departureDecision({ ...b, route_start: lt.start, route_dest: lt.dest, weather: w }), id: Date.now(),
        label: `Interim departure, ${k.label} - Route Plan: ${trip.name} - ${tripLine(lt)}. ${tripTimes(lt).join(", ")} - ${stamp()}` };
      const rec = { id: entry.id, kind, start: lt.start, dest: lt.dest, depart_at: w.depart_at || "", event_name: w.event_name || "", event_at: w.event_at || "",
        finish_at: w.finish_at || "", meetup: w.meetup || "", why: w.why || "", advice: String(w.advice || "").slice(0, 2000),
        photos: (w.photos || []).map((p) => ({ id: p.id, note: p.note || "", at: p.at })), at: new Date().toISOString(), logs: [entry.id] };
      const legs = { ...(b.legs || {}), [trip.id]: [...(b.legs?.[trip.id] || []), rec] };
      const underway = { trip_id: trip.id, name: trip.name, line: tripLine(lt), at: new Date().toISOString(), leg: kind };
      // A fresh Arrival status check for the next anchorage, berth or mooring.
      return { ...s, boat: { ...b, legs, underway, arrive: {} }, data: { ...s.data, arrivingDest: stampTicks(list, list.map((i) => (ids.has(i.id) ? { ...i, checked: true } : i)), tickedBy), shipsLog: [...(s.data.shipsLog || []), entry] } };
    });
    toast.success(`${k.label}: ${plural(ticked, "item")} ticked. Underway on ${trip.name}, logged in the Ship's Log`);
    if (online) {
      try {
        const { data: shore } = await api.get(`/boats/${boatId}/shore`, { timeout: 10000 });
        if ((shore.contacts || []).length) {
          if (!trackingOn) {
            const { data } = await api.put(`/boats/${boatId}/shore/tracking`, { on: true });
            tracked(boatId, { on: data.on, trip_id: data.trip_id });
          }
          await api.put(`/boats/${boatId}/shore/plan`, { text: shorePlan(lt).slice(0, 1500) });
          toast.success("Sharing your position and today's plan with shore contacts");
        }
      } catch (e) { toast.error(apiError(e, "Couldn't share with your shore contacts")); }
    }
    return true;
  };

  return { plan, busy, openDepart, openArrive, interimTrip, interimDepart, confirm: (how) => (plan?.kind === "depart" ? depart() : arrive(how)), close: () => setPlan(null) };
}
