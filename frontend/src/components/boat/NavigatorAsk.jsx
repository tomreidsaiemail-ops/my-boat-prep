import { useRef, useState } from "react";
import { Anchor, ClipboardCheck, Compass, Flag, Loader2, Pencil, UserCog, Users, X, Zap } from "lucide-react";
import { openList } from "@/lib/trips";
import { toast } from "sonner";
import { EDIT_NAME, QUICK_NAME, QuickPlanDialog } from "@/components/boat/navigator/QuickPlanDialog";
import { ReplaceWarning } from "@/components/boat/navigator/QuickPlanPanels";
import { api, apiError } from "@/lib/api";
import { CoastGuardReport, coastGuardReport } from "@/components/boat/CoastGuardReport";
import { WeatherPhotos } from "@/components/boat/navigator/WeatherPhotos";
import { NavigatorIntro, NavigatorReminders, TripTiming, WhyGoing } from "@/components/boat/navigator/NavigatorExtras";
import { stamp } from "@/components/boat/departure/LogCopy";
import { PlannedLegs } from "@/components/boat/navigator/PlannedLegs";
import { FoldHeader } from "@/components/boat/navigator/FoldHeader";
import { HopBubble } from "@/components/boat/navigator/HopBubble";
import { RouteBubble } from "@/components/boat/navigator/PlannedRouteView";
import { returnsToStart } from "@/lib/tripStops";

const routeText = (start, dest) => [start.trim(), dest.trim()].filter(Boolean).join(" to ");

const AnswerCard = ({ result, boat, left, onClose }) => (
  <div className="flex flex-col gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2" data-testid="navigator-answer-card">
    <div className="flex items-center gap-2">
      <span className="flex flex-1 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"><Compass className="h-4 w-4" /> The Magic Marine Navigator suggests</span>
      <button type="button" className="icon-btn h-8 w-8" aria-label="Close answer" onClick={onClose} data-testid="navigator-answer-close-btn"><X className="h-4 w-4" /></button>
    </div>
    {result.tides_missing?.length > 0 && (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-tides-missing">
        Live tide data isn't available for {result.tides_missing.join(" and ")}. No tide times are given for it. Check the official tide tables before you sail.
      </p>
    )}
    <p className="whitespace-pre-line text-sm" data-testid="navigator-answer-text">{result.answer}</p>
    <CoastGuardReport text={coastGuardReport(boat, result.start, result.dest, result)} />
    {left !== null && <span className="text-xs text-[var(--muted)]" data-testid="navigator-asks-left">{left} Magic generations left</span>}
  </div>
);

const RouteField = ({ id, label, value, onChange, placeholder }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <label htmlFor={id} className="field-label">{label}</label>
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder={placeholder}
      className="field-input text-base normal-case tracking-normal" data-testid={`${id}-input`} />
  </div>
);

// interim: the New departure window on Arriving at Destination (today's leg of the trip). timesNote: shown under its times.
export const NavigatorAsk = ({ boat, onChange, onWeather, items, online, locked, onUpgrade, boatId, interim, timesNote, legNo = 1, onLeaving, onArriving }) => {
  const start = boat.route_start || "";
  const dest = boat.route_dest || "";
  const auto = useRef(routeText(start, dest));
  const [question, setQuestion] = useState(auto.current);
  const [state, setState] = useState({ busy: false, error: "", result: null, left: null });
  // Both start closed to keep Route Planning short.
  const [askOpen, setAskOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [quick, setQuick] = useState(false);
  const [sure, setSure] = useState(0);
  const w = boat.weather || {};
  const hasRoute = !!(start || dest || w.start_pos || w.dest_pos || (w.legs || []).length);
  const draft = hasRoute && !!w.trip_draft;
  // Return trip: ticked once START and DESTINATION are in. Only a 2-leg trip whose Leg 2 ends at START is one, and that can't be unticked.
  const legsNow = w.legs || [];
  const isReturn = returnsToStart([{ route_start: start }, ...legsNow]);
  const canReturn = !!(start.trim() && dest.trim());
  const ret = canReturn && (isReturn || (!legsNow.length && w.return_trip !== false));
  // Route Planning as the draft's legs, with any name or time changes made here.
  const current = () => [{ id: "plan", route_start: start, route_dest: dest, depart_at: w.depart_at || "", finish_at: w.finish_at || "", arrive_type: w.arrive_type || "",
    start_pos: w.start_pos || null, dest_pos: w.dest_pos || null, path: w.path ?? null }, ...(w.legs || [])];
  // The draft's first leg is the Route Plan (START, DESTINATION, times, pins); the rest become its planned legs.
  const putLegs = ([first, ...rest], extra = {}) => {
    onChange("route_start", first.route_start);
    onChange("route_dest", first.route_dest);
    const next = routeText(first.route_start, first.route_dest);
    setQuestion((q) => (q.startsWith(auto.current) ? next + q.slice(auto.current.length) : q || next).slice(0, 1024));
    auto.current = next;
    onWeather({ ...extra, ...(isReturn && !rest.length ? { return_trip: false } : {}), depart_at: first.depart_at, finish_at: first.finish_at,
      start_pos: first.start_pos, dest_pos: first.dest_pos, path: first.path, arrive_type: first.arrive_type || "", legs: rest.map(({ start_pos, ...l }) => l) });
  };
  const applyQuick = ([first, ...rest], fresh) => {
    putLegs([first, ...rest], { ...(fresh ? { event_name: QUICK_NAME, event_at: first.depart_at } : {}), trip_draft: true });
    toast.success(`${fresh ? QUICK_NAME : "Draft Plan"}: ${rest.length + 1} ${rest.length ? "legs" : "leg"} ${fresh ? "added to" : "updated in"} Route Planning`);
  };

  // Keep the route at the front of the question, leaving anything the skipper added after it.
  const setRoute = (key, value) => {
    onChange(key, value);
    const next = routeText(key === "route_start" ? value : start, key === "route_dest" ? value : dest);
    const prev = auto.current;
    setQuestion((q) => (q.startsWith(prev) ? next + q.slice(prev.length) : q || next).slice(0, 1024));
    auto.current = next;
    setState((s) => ({ ...s, error: "" }));
  };

  const ask = () => {
    if (locked) { onUpgrade(); return; }
    if (!start.trim() || !dest.trim()) { setState((s) => ({ ...s, error: "Add a START and a DESTINATION first. The Magic Marine Navigator needs both to suggest a route." })); return; }
    if (!online) { setState((s) => ({ ...s, error: "The Magic Marine Navigator needs a signal" })); return; }
    setState({ busy: true, error: "", result: null, left: null });
    const details = { boat_type: boat.boat_type, units: boat.units, loa: boat.loa, beam: boat.beam, draft: boat.draft, mast_height: boat.mast_height,
      pob: boat.pob, children: boat.children, trip_days: boat.trip_days };
    const route = { start: start.trim(), dest: dest.trim() };
    api.post("/ai/navigator-ask", { question: question.trim(), start: route.start, destination: route.dest, boat: details, items: items.slice(0, 150),
      start_pos: w.start_pos || null, dest_pos: w.dest_pos || null, depart_at: w.depart_at || "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "" }, { timeout: 90000 })
      .then(({ data }) => {
        setState((s) => ({ ...s, busy: false, result: { ...data, ...route }, left: data.asks_left }));
        // Kept for the Departure decision in the Ship's Log.
        onWeather({ advice: String(data.answer || "").slice(0, 6000), advice_at: stamp() });
      })
      .catch((e) => setState((s) => ({ ...s, busy: false, error: apiError(e, "The Magic Marine Navigator couldn't answer right now. Please try again.") })));
  };

  return (
    <div className="flex flex-col gap-2" data-testid="navigator-ask-panel">
      {!interim && (
        <div className="flex flex-wrap items-center gap-2" data-testid="route-hops">
          {onLeaving && <HopBubble icon={Anchor} label="Leaving Dock" onClick={onLeaving} departAt={boat.weather?.depart_at} testId="route-leaving-dock" />}
          {onArriving && <HopBubble icon={Flag} label="Arriving" onClick={onArriving} testId="route-arriving" />}
          <RouteBubble testId="route-view" start={start.trim()} dest={dest.trim()} weather={w} onChange={onWeather} />
        </div>
      )}
      {!interim && (
        <div className="flex flex-wrap items-center gap-2" data-testid="route-crew-hops">
          <HopBubble icon={Users} label="Crew" tone="crew" onClick={() => window.dispatchEvent(new Event("mbp:open-crew"))} testId="route-crew" />
          <HopBubble icon={ClipboardCheck} label="Prep" tone="crew" onClick={() => openList("crewPrep")} testId="route-prep" />
          <HopBubble icon={UserCog} label="Roles" tone="crew" onClick={() => window.dispatchEvent(new CustomEvent("mbp:crew-roles", { detail: { hop: true } }))} testId="route-roles" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <h3 className="shrink-0 font-display text-base font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid="route-leg-1-heading">Leg {legNo}</h3>
        {!interim && !sure && (
          <button type="button" onClick={() => (draft ? setQuick({}) : ret ? setQuick({ seed: true }) : hasRoute ? setSure(1) : setQuick({}))} className="btn-ghost h-11 min-w-0 flex-1 justify-center gap-1.5 !border-amber-500 font-extrabold" data-testid="quick-plan-btn">
            {draft ? <Pencil className="h-4 w-4 shrink-0 text-amber-500" /> : <Zap className="h-4 w-4 shrink-0 text-amber-500" />} <span className="truncate">{draft ? EDIT_NAME : QUICK_NAME}...</span>
          </button>
        )}
      </div>
      {!interim && sure > 0 && <ReplaceWarning step={sure} onYes={() => (sure === 1 ? setSure(2) : (setSure(0), setQuick({})))} onNo={() => setSure(0)} />}
      {quick && <QuickPlanDialog open onClose={() => setQuick(false)} onApply={applyQuick} draft={draft ? current() : null} select={quick.select ?? null} add={quick.add ?? null} ret={ret}
        seed={quick.seed ? { legs: [{ ...current()[0], start_pos: null, dest_pos: null, path: null }], back: isReturn ? legsNow[0] : null } : null} />}
      <div className="flex gap-2">
        <RouteField id="route-start" label="START" value={start} onChange={(v) => setRoute("route_start", v)} placeholder="e.g. Mana" />
        <RouteField id="route-dest" label="DESTINATION" value={dest} onChange={(v) => setRoute("route_dest", v)} placeholder="e.g. Picton" />
        {!interim && (
          <label className={`flex shrink-0 flex-col items-center gap-1 ${!canReturn || legsNow.length ? "opacity-60" : "cursor-pointer"}`} data-testid="return-trip"
            title={isReturn ? "Leg 2 comes back to START, so this is a return trip" : legsNow.length ? "Only a 2-leg trip that comes back to START is a return trip" : canReturn ? "" : "Enter the START and DESTINATION first"}>
            <span className="field-label text-center leading-tight">Return<br />trip</span>
            <span className="flex h-11 items-center">
              <input type="checkbox" className="h-6 w-6 accent-[var(--navy)]" checked={ret} disabled={!canReturn || legsNow.length > 0}
                onChange={(e) => onWeather({ return_trip: e.target.checked })} data-testid="return-trip-checkbox" />
            </span>
          </label>
        )}
      </div>
      <FoldHeader open={askOpen || state.busy || !!state.result} onToggle={() => setAskOpen((o) => !o)} icon={Compass} testId="navigator-ask-toggle">Ask the Magic Marine Navigator</FoldHeader>
      {(askOpen || state.busy || !!state.result) && (<>
      <label htmlFor="navigator-question" className="sr-only">ASK THE MAGIC MARINE NAVIGATOR</label>
      <NavigatorIntro online={online} />
      <div className="flex items-start gap-2">
        <textarea id="navigator-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1024} rows={question ? 3 : 1} style={{ height: question ? 84 : 44, paddingTop: 10, paddingBottom: 6 }}
          placeholder="e.g. Mana to Picton Via Queen Charlotte Sound" className="field-input min-w-0 flex-1 resize-none leading-snug placeholder-shown:overflow-hidden placeholder-shown:text-ellipsis placeholder-shown:whitespace-nowrap" data-testid="navigator-question-input" />
        <button type="button" className="btn-solid h-11 shrink-0 px-4" onClick={ask} disabled={state.busy} data-testid="navigator-ask-btn">
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask..."}
        </button>
      </div>
      {state.busy && <p className="flex items-center gap-2 text-sm font-semibold" data-testid="navigator-loading"><Loader2 className="h-4 w-4 animate-spin" /> The Magic Marine Navigator is plotting...</p>}
      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-error">{state.error}</p>}
      {state.result && <AnswerCard result={state.result} boat={boat} left={state.left} onClose={() => setState((s) => ({ ...s, result: null }))} />}
      </>)}
      <WeatherPhotos boat={boat} onPatch={onWeather} online={online} boatId={boatId} open={photosOpen} onToggle={() => setPhotosOpen((o) => !o)} />
      {photosOpen && <NavigatorReminders />}
      <WhyGoing value={boat.weather?.why || ""} onChange={(v) => onWeather({ why: v })} hint={interim ? "Logged in the Ship's Log with the photos when you tap Leave Berth, Weigh Anchor or Leave Mooring." : undefined} />
      <TripTiming weather={boat.weather || {}} onChange={onWeather} interim={interim} note={timesNote} start={start} dest={dest} />
      {!interim && <PlannedLegs start={start.trim()} dest={dest.trim()} weather={boat.weather || {}} onChange={onWeather} onLegs={putLegs} onDraft={draft ? (select, add = null) => setQuick({ select, add }) : undefined} />}
    </div>
  );
};
