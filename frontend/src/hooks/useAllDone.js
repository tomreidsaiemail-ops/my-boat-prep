import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { stampTicks } from "@/components/boat/TickBadge";
import { stamp } from "@/components/boat/departure/LogCopy";
import { logBlock } from "@/components/boat/departure/DepartureCheck";
import { departureDecision } from "@/components/boat/navigator/DepartureLogDialog";
import { arrivalSummary, arrivalUsage, departureSummary, passagePlan } from "@/lib/telemetry";
import { DEFAULT_TRIP, tripBoat } from "@/lib/trips";
import { ARRIVE_KINDS, arrivalTicks, foldTrip, legBoat, legHead, nextLeg, sailingLeg, tripHead } from "@/lib/tripFold";
import { allLevelsPicked } from "@/components/boat/departure/TankLevels";
import { arriveType } from "@/components/boat/navigator/ArriveType";
import { offsetText, transitBearing, transitFix } from "@/components/boat/departure/TransitDialog";
import { distressPosition } from "@/hooks/useGps";
import { LEG_KINDS, dmyt, headingItems, legIds, legTrip, levelsText, pickTrip, routeTrips, shorePlan, tankSummary, today, tripIssue, tripLine, tripTimes } from "@/lib/allDone";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const tracked = (boatId, t) => window.dispatchEvent(new CustomEvent("mbp:tracking", { detail: { boat_id: boatId, tracking: t } }));
// Skipped items are unticked, ready for the next departure.
const tickAll = (list, by, skip = new Set()) => stampTicks(list, list.map((i) => ({ ...i, checked: !skip.has(i.id) })), by);
// Arriving at Destination keeps its interim departure items (When leaving berth...) for the next leg.
const arriveSkip = (listId, list) => (listId === "arrivingDest" ? legIds(list) : new Set());
const markLogged = (w = {}) => ({ ...w, photos: (w.photos || []).map((p) => ({ ...p, logged: true })) });
// The latest levels recorded: the last confirmed ones, then this leg's departure, then this arrival.
const latestLevels = (b) => ({ ...(b.last_levels || {}), ...(legBoat(b).depart?.levels || {}), ...(b.arrive?.levels || {}) });
// A trip's planned legs (Leg 1 is the Route Plan itself), each with its arrival type.
const plannedOf = (b, id) => { const tb = tripBoat(b, id); const w = tb.weather || {}; return [{ route_dest: tb.route_dest, arrive_type: w.arrive_type || "" }, ...(w.legs || [])]; };
const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

// Adds the status entry, or updates the one already copied when it changed since.
const putLog = (log, d, text, sig, extra = {}) => {
  if (!d.log_id || !log.some((i) => i.id === d.log_id)) { const id = Date.now(); return [[...log, { id, label: text.slice(0, 2000), checked: false }], { ...d, log_id: id, log_sig: sig, ...extra }]; }
  if (d.log_sig === sig) return [log, d];
  return [log.map((i) => (i.id === d.log_id ? { ...i, label: text.slice(0, 2000) } : i)), { ...d, log_sig: sig, ...extra }];
};
const statusStep = (d, sig, what, summary, log = []) => {
  const there = !!d.log_id && log.some((i) => i.id === d.log_id);
  const done = there && d.log_sig === sig;
  return { id: "status", text: `${done ? `${what} is already in the Ship's Log` : `${there ? "Update" : "Copy"} the ${what.toLowerCase()} into the Ship's Log`}${summary ? `: ${summary}` : ""}` };
};

// DEPART, ALL CHECKS DONE and ARRIVED, ALL CHECKS DONE: one confirm window, then ticks, logs, Underway and shore contacts.
export default function useAllDone({ state, mutate, tickedBy, online, boatId, trackingOn }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  // The levels pop-up: { title, levels, arrival, then(levels) }.
  const [ask, setAsk] = useState(null);
  const legLevels = useRef(null);
  const saveLevels = (key, v, keep = true) => mutate((s) => ({ ...s, boat: { ...s.boat, ...(key ? { [key]: { ...(keep ? s.boat[key] || {} : s.boat[key]?.leg ? { leg: s.boat[key].leg } : {}), levels: v } } : {}), last_levels: v } }), { count: false });
  const setShore = (step, contacts) => setPlan((p) => (p?.kind === "depart" ? { ...p, contacts, checking: false, steps: p.steps.map((s) => (s.id === "shore" ? { id: "shore", ...step } : s)) } : p));

  const openDepart = (lv) => {
    const b = state.boat || {};
    // A check already used for an earlier departure isn't reused: the new one starts from the confirmed levels.
    const old = !!b.depart?.trip_id && !b.underway?.trip_id;
    const d = lv ? { ...(old ? {} : b.depart || {}), levels: lv } : b.depart || {};
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
      statusStep(d, departureSummary(b, d, passagePlan(b, d), ""), "Tank and battery status", tankSummary(d.levels), state.data.shipsLog),
      { id: "route", text: `Log the route plan: ${tripLine(trip)}\n${tripTimes(trip).join("\n")}${w.why?.trim() ? `\nWhy we're going: ${w.why.trim()}` : ""}${photos ? `\nWith ${plural(photos, "weather and routing photo")}` : ""}` },
      { id: "underway", text: `Show Underway on Route Plan: ${trip.name}` },
      { id: "shore", ...(!online ? { tone: "warn", text: "No signal, so position sharing and the route plan can't be shared with shore contacts now" }
        : { tone: "info", text: "Checking your shore contacts..." }) },
    ];
    const tripBlock = tripIssue(trips, trip) || (!trip.event && `Enter the Event or Trip name on ${trip.name} before you depart.`);
    if (!tripBlock && ((!lv && old) || !allLevelsPicked(b, d.levels))) {
      setAsk({ title: "Confirm your levels before you depart", levels: { ...latestLevels(b), ...(old ? {} : d.levels || {}) }, then: (v) => { saveLevels("depart", v, !old); openDepart(v); } });
      return;
    }
    const blocked = tripBlock || logBlock(b, d);
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

  const openArrive = (listId, listName, lv) => {
    const b = state.boat || {};
    const a = lv ? { ...(b.arrive || {}), levels: lv } : b.arrive || {};
    if (!allLevelsPicked(b, a.levels)) {
      setAsk({ arrival: true, title: "Confirm your arrival levels", levels: { ...latestLevels(b), ...(a.levels || {}) }, then: (v) => { saveLevels("arrive", v); openArrive(listId, listName, v); } });
      return;
    }
    const u = b.underway || {};
    const list = state.data[listId] || [];
    const lb = legBoat(b);
    const sig = arrivalSummary(lb, lb.depart || {}, a, arrivalUsage(lb, lb.depart || {}, a), "", listName);
    const stop = listId === "arrivingDest";
    const legs = b.legs?.[u.trip_id] || [];
    // Only the last planned leg (or Returning to Dock) offers ending the trip, folding its logs; the skipper can untick it.
    const lastOne = listId === "returningDock" || !nextLeg(b, routeTrips(state.registry, b).find((t) => t.id === u.trip_id));
    const canFold = !!u.trip_id && legs.some((l) => l.logs?.length) && lastOne;
    const endTrip = canFold;
    const choices = stop ? ARRIVE_KINDS.map((k) => {
      const n = arrivalTicks(list, k.key).size;
      return { ...k, text: `Ticks ${plural(n, "item")}: the ones for every arrival, plus everything under ${k.heading.replace(/^if/, "If")}` };
    }) : null;
    const steps = [
      { id: "tick", text: stop ? "Pick how you arrived below. The If... and When leaving... groups for other arrivals and departures are unticked, ready for next time" : `Tick all ${plural(list.length, `${listName} item`)}` },
      statusStep(a, sig, "Arrival levels and what was used", tankSummary(a.levels), state.data.shipsLog),
      { id: "route", text: `Log your arrival${u.line ? `: ${u.line}` : ""}` },
      ...(u.trip_id ? [{ id: "underway", text: `Clear Underway from ${u.name}` }] : []),
      ...(canFold ? [{ id: "fold", text: `Group this trip's Ship's Log entries into a trip folder, with a folder for each of its ${plural(legs.length, "leg")}` }] : []),
      { id: "shore", ...(!trackingOn ? { tone: "info", text: "Position sharing isn't on, so no shore contact message is sent" }
        : online ? { text: "Tell your shore contacts you arrived safely and stop sharing your position" }
          : { tone: "warn", text: "No signal, so shore contacts can't be told yet. Tap Arrived safely in Crew > Shore Contacts when you have signal." }) },
    ];
    // Actual finish starts as the Estimated Finish of this leg, or of the Route Plan.
    const lastLeg = legs[legs.length - 1];
    const est = (lastLeg && lastLeg.kind !== "dock" && lastLeg.finish_at) || routeTrips(state.registry, b).find((t) => t.id === u.trip_id)?.finishAt || "";
    setPlan({ kind: "arrive", listId, listName, blocked: "", steps, choices, finish: est, estimate: est, canFold, endTrip });
  };

  const depart = async () => {
    const { trip, contacts } = plan;
    const line = tripLine(trip);
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const head = tripHead(trip.start, trip.dest, trip.departAt);
      const [log, dep] = putLog(s.data.shipsLog || [], d, `${head} - ${departureSummary(b, d, passagePlan(b, d), stamp())}`, departureSummary(b, d, passagePlan(b, d), ""));
      const entry = { ...departureDecision(tripBoat(b, trip.id)), id: Date.now() + 1, label: `${head} - Departed, all checks done - Route Plan: ${trip.name} - ${line}. ${tripTimes(trip).join(", ")} - ${stamp()}` };
      const weather = trip.id === DEFAULT_TRIP ? { weather: markLogged(b.weather) }
        : { trips: { ...(b.trips || {}), [trip.id]: { ...(b.trips?.[trip.id] || {}), weather: markLogged(b.trips?.[trip.id]?.weather) } } };
      // Leaving Dock starts the trip's legs afresh; each later stop and departure is added to them.
      const leg = { id: entry.id, kind: "dock", start: trip.start, dest: trip.dest, depart_at: trip.departAt, finish_at: trip.finishAt, why: trip.why, at: new Date().toISOString(), logs: [dep.log_id, entry.id] };
      const boat = { ...b, ...weather, arrive: {}, depart: { ...dep, trip_id: trip.id }, last_levels: d.levels || b.last_levels || {}, route_trip: trip.id, route_trip_day: today(), legs: { ...(b.legs || {}), [trip.id]: [leg] }, trip_ended: "",
        underway: { trip_id: trip.id, name: trip.name, event: trip.event || "", line, at: new Date().toISOString() } };
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
    const folded = plan.canFold && plan.endTrip;
    const { finish } = plan;
    mutate((s) => {
      const b = s.boat;
      const d = b.depart || {};
      const a = b.arrive || {};
      const lb = legBoat(b);
      const ld = lb.depart || d;
      const head = legHead(b);
      const use = arrivalUsage(lb, ld, a);
      const [log, logged] = putLog(s.data.shipsLog || [], a, `${head} - ${arrivalSummary(lb, ld, a, use, stamp(), listName)}`, arrivalSummary(lb, ld, a, use, "", listName), { log_list: listName });
      const arr = lb !== b ? { ...logged, leg: { start: lb.route_start, dest: lb.route_dest, ...(lb.depart?.levels ? { levels: lb.depart.levels } : {}) } } : logged;
      const u = b.underway || {};
      const entry = { id: Date.now() + 1, checked: false, label: `${head} - Arrived, all ${kind ? "arrival " : ""}checks done${kind ? `, ${kind.done}` : ""} (${listName})${u.line ? ` - ${u.line}` : ""}. Actual arrival: ${dmyt(finish)} - ${stamp()}` };
      // The arrival closes the trip's latest leg, so each voyage and arrival is kept with the overall trip.
      let legs = b.legs?.[u.trip_id] || [];
      const last = legs[legs.length - 1];
      if (last && !last.arrived_at) {
        legs = [...legs.slice(0, -1), { ...last, arrived_at: new Date().toISOString(), arrived_list: listName, arrival: kind?.key || "dock", actual_finish_at: finish, logs: [...(last.logs || []), arr.log_id, entry.id] }];
      }
      let shipsLog = [...log, entry];
      let keep = legs;
      const trip = folded && legs.length ? foldTrip(shipsLog, legs, [u.name || "Route Plan", u.event].filter(Boolean).join(" - ")) : null;
      // Once folded the status checks start fresh for the next trip, and archiving it is the next step.
      const fresh = trip ? { depart: {}, arrive: {}, trip_ended: u.trip_id } : { arrive: arr };
      if (trip) { shipsLog = trip; keep = []; }
      const list = s.data[listId] || [];
      const ticks = kind ? stampTicks(list, list.map((i) => ({ ...i, checked: arrivalTicks(list, kind.key).has(i.id) })), tickedBy) : tickAll(list, tickedBy, arriveSkip(listId, list));
      // The Route Plan keeps its estimate and shows the latest actual arrival under it.
      const actual = !u.trip_id ? {} : u.trip_id === DEFAULT_TRIP ? { weather: { ...(b.weather || {}), actual_finish_at: finish } }
        : { trips: { ...(b.trips || {}), [u.trip_id]: { ...(b.trips?.[u.trip_id] || {}), weather: { ...(b.trips?.[u.trip_id]?.weather || {}), actual_finish_at: finish } } } };
      return { ...s, boat: { ...b, ...actual, ...(u.trip_id ? { legs: { ...(b.legs || {}), [u.trip_id]: keep } } : {}), ...fresh, underway: {}, last_levels: a.levels || b.last_levels || {} }, data: { ...s.data, [listId]: ticks, shipsLog } };
    });
    toast.success(folded ? "Arrival logged. The trip is grouped in the Ship's Log, with a folder per leg" : "Arrival logged in the Ship's Log");
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
    if (!trip) { toast.error("Add a Trip Planning list first"); return false; }
    const k = LEG_KINDS.find((x) => x.key === kind);
    const lt = legTrip(trip, leg);
    const w = leg.weather || {};
    const ticked = headingItems(state.data.arrivingDest || [], k.heading).length;
    const levels = legLevels.current;
    legLevels.current = null;
    mutate((s) => {
      const b = s.boat;
      const list = s.data.arrivingDest || [];
      const ids = new Set(headingItems(list, k.heading));
      const entry = { ...departureDecision({ ...b, route_start: lt.start, route_dest: lt.dest, weather: w }), id: Date.now(),
        label: `${tripHead(lt.start, lt.dest, w.depart_at)} - Interim departure, ${k.label} - Route Plan: ${trip.name} - ${tripLine(lt)}. ${tripTimes(lt).join(", ")}.${levels ? ` Levels: ${levelsText(b, levels)}.` : ""} - ${stamp()}` };
      const rec = { id: entry.id, kind, start: lt.start, dest: lt.dest, depart_at: w.depart_at || "", event_name: w.event_name || "", event_at: w.event_at || "",
        finish_at: w.finish_at || "", ...(w.actual_finish_at ? { actual_finish_at: w.actual_finish_at } : {}), arrive_type: w.arrive_type || "", meetup: w.meetup || "", why: w.why || "", advice: String(w.advice || "").slice(0, 2000),
        photos: (w.photos || []).map((p) => ({ id: p.id, note: p.note || "", at: p.at })), at: new Date().toISOString(), logs: [entry.id], ...(levels ? { levels } : {}) };
      const legs = { ...(b.legs || {}), [trip.id]: [...(b.legs?.[trip.id] || []), rec] };
      const underway = { trip_id: trip.id, name: trip.name, event: lt.event, line: tripLine(lt), at: new Date().toISOString(), leg: kind };
      // A fresh Arrival status check for the next anchorage, berth or mooring.
      return { ...s, boat: { ...b, legs, underway, arrive: {}, ...(levels ? { last_levels: levels } : {}) }, data: { ...s.data, arrivingDest: stampTicks(list, list.map((i) => (ids.has(i.id) ? { ...i, checked: true } : i)), tickedBy), shipsLog: [...(s.data.shipsLog || []), entry] } };
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

  // A Transiting point: the transit window logs when it was passed (ahead of time or afterwards, with the GPS flagged),
  // closes that leg and sets off on the next one automatically (no checklists, still underway).
  const [transit, setTransit] = useState(null);
  const transitLeg = () => { const l = sailingLeg(state.boat || {}, interimTrip()); return l?.arrive_type === "transit" ? l : null; };
  const openTransit = () => {
    const cur = transitLeg();
    if (cur) setTransit({ pin: cur.n + 1, point: cur.route_dest || `Point ${cur.n + 1}`, pos: cur.dest_pos, next: nextLeg(state.boat || {}, interimTrip()), at: localNow() });
  };
  const passTransit = (gps) => {
    const trip = interimTrip();
    if (!transit || !transitLeg()) { setTransit(null); return; }
    const { pin, point, next, at } = transit;
    const when = new Date(at);
    const off = offsetText(at);
    const pos = `(Transit GPS: ${distressPosition(gps)}${off ? `, ${off} so approximate` : ""})`;
    const side = transitBearing(gps, transit.pos, pin);
    const nextName = next ? `${next.route_dest || "point not set"}, ${arriveType(next.arrive_type)?.label || "type not set"}` : "";
    mutate((s) => {
      const b = s.boat;
      const legs = b.legs?.[trip.id] || [];
      const last = legs[legs.length - 1];
      const entry = { id: Date.now(), checked: false, label: `${legHead(b)} - Passing transit ${pin} ${point} at ${dmyt(at)} - ${side} - Route Plan: ${trip.name}${next ? ` - next stop ${nextName}` : ""} ${pos} - ${stamp()}` };
      const closed = { ...last, arrived_at: when.toISOString(), actual_finish_at: at, arrival: "transit", arrived_list: "Passed", logs: [...(last?.logs || []), entry.id] };
      const rec = next && { id: entry.id + 1, kind: "transit", start: next.route_start || point, dest: next.route_dest || "", depart_at: at, finish_at: next.finish_at || "",
        arrive_type: next.arrive_type || "", at: when.toISOString(), logs: [entry.id + 1] };
      const auto = rec && { id: rec.id, checked: false, label: `${tripHead(rec.start, rec.dest, at)} - Auto departure from transit ${pin} ${point} - Route Plan: ${trip.name} - next stop ${nextName} - ${stamp()}` };
      const underway = rec ? { ...b.underway, line: `${rec.start} to ${rec.dest}` } : b.underway;
      return { ...s, boat: { ...b, legs: { ...(b.legs || {}), [trip.id]: [...legs.slice(0, -1), closed, ...(rec ? [rec] : [])] }, underway },
        data: { ...s.data, shipsLog: [...(s.data.shipsLog || []), entry, ...(auto ? [auto] : [])] } };
    });
    toast.success(`Passing transit ${pin} ${point} logged in the Ship's Log${next ? `. Underway to ${next.route_dest || "the next stop"}` : ""}`);
    setTransit(null);
    // Shore contacts see the passing on their page straight away (no shore contact, or sharing off: nothing to tell).
    if (!online) return;
    const text = `Passed transit ${pin} ${point} at ${dmyt(at)}${off ? ` (${off})` : ""}. ${side}.${next ? ` Next stop ${nextName}.` : ""}`;
    api.post(`/boats/${boatId}/shore/transit`, { text: text.slice(0, 600), name: `Transit ${pin} ${point}`.slice(0, 120), ...(transitFix(gps, transit.pos) || {}) })
      .then(() => toast.success("Your shore contacts can see the transit passing"))
      .catch((e) => { if (e?.response?.status !== 400) toast.error(apiError(e, "Couldn't tell your shore contacts about the transit")); });
  };

  // DEPART: the planned arrival types are confirmed, and any can be changed in the trip plan.
  const departLegs = plan?.kind === "depart" ? plannedOf(state.boat || {}, plan.trip.id) : [];
  const setLegType = (n, key) => {
    const id = plan?.trip?.id;
    if (!id) return;
    mutate((s) => {
      const b = s.boat;
      const w = tripBoat(b, id).weather || {};
      const nw = n === 0 ? { ...w, arrive_type: key } : { ...w, legs: (w.legs || []).map((l, k) => (k === n - 1 ? { ...l, arrive_type: key } : l)) };
      return { ...s, boat: id === DEFAULT_TRIP ? { ...b, weather: nw } : { ...b, trips: { ...(b.trips || {}), [id]: { ...(b.trips?.[id] || {}), weather: nw } } } };
    });
  };

  const setFinish = (v) => setPlan((p) => (p ? { ...p, finish: v } : p));
  const setEndTrip = (v) => setPlan((p) => (p ? { ...p, endTrip: v } : p));
  // Arriving at Destination: New arrival and New departure... start by confirming the latest levels.
  const newArrival = () => setAsk({ arrival: true, title: "New arrival: confirm your levels", levels: latestLevels(state.boat || {}), then: (v) => saveLevels("arrive", v, false) });
  const newDeparture = (open) => setAsk({ title: "New departure: confirm your levels", levels: latestLevels(state.boat || {}), then: (v) => { legLevels.current = v; saveLevels(null, v); open(); } });
  // First words of a departure or arrival status copied by hand into the Ship's Log.
  const head = (kind) => {
    const b = state.boat || {};
    if (kind === "Arrival" || b.underway?.trip_id) return legHead(b);
    const t = pickTrip(routeTrips(state.registry, b), b.route_trip, b.route_trip_day);
    return t ? tripHead(t.start, t.dest, t.departAt) : tripHead(b.route_start, b.route_dest, "");
  };
  const levelsAsk = { ask, confirm: (v) => { const then = ask?.then; setAsk(null); then?.(v); }, close: () => setAsk(null) };
  return { plan, busy, setFinish, setEndTrip, openDepart, openArrive, interimTrip, interimDepart, transitLeg, passTransit, newArrival, newDeparture, head, levelsAsk,
    transit, openTransit, setTransitAt: (v) => setTransit((t) => (t ? { ...t, at: v } : t)), closeTransit: () => setTransit(null), departLegs, setLegType,
    confirm: (how) => (plan?.kind === "depart" ? depart() : arrive(how)), close: () => setPlan(null) };
}
