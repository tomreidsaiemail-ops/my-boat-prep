import { AlertTriangle, ArrowRight, Map as MapIcon, Navigation } from "lucide-react";
import { dmyt, pickTrip, tripIssue, tripLine } from "@/lib/allDone";
import { UnderwayBubble } from "@/components/boat/departure/UnderwayBubble";
import { NextStep } from "@/components/boat/departure/NextStep";

// Opens the Route Plan list and lands on its Departure or Estimated Finish date.
const goTo = (id, field = "navigator-depart-at") => {
  window.dispatchEvent(new CustomEvent("mbp:open-list", { detail: id }));
  setTimeout(() => {
    document.querySelector(`[data-testid="${field}-field"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(field)?.focus({ preventScroll: true });
  }, 400);
};

const TimeRow = ({ label, value, onGo, testId }) => (
  <div className="flex items-center justify-between gap-2 text-sm" data-testid={testId}>
    <span><span className="text-[var(--muted)]">{label}: </span><b data-testid={`${testId}-value`}>{dmyt(value) || "Not set"}</b></span>
    <button type="button" className="shrink-0 font-bold text-[var(--navy)] underline underline-offset-2" onClick={onGo} data-testid={`${testId}-change`}>{value ? "Change" : "Set"}</button>
  </div>
);

// Leaving the Dock: which Route Planning trip this departure uses, its summary and the one-tap DEPART.
// next: once it's under way, DEPART gives way to the link to the next list ({ label, onClick }).
export const RoutePlanCard = ({ trips, trip, issue, underway, onPick, onDepart, next = null }) => {
  const live = underway?.trip_id && underway.trip_id === trip?.id;
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="route-plan-card">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><MapIcon className="h-4 w-4" /> <span data-testid="route-plan-title">Route Plan{trip ? `: ${trip.name}` : ""}</span></h3>
      {trips.length > 1 ? (
        <label className="flex flex-col gap-1.5"><span className="field-label">Route plan for this departure</span>
          <select value={trip?.id || ""} onChange={(e) => onPick(e.target.value)} className="field-input h-11 text-base normal-case tracking-normal" data-testid="route-plan-select">
            {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      ) : null}
      {trip && (
        <p className="rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold" data-testid="route-plan-summary">
          {tripLine(trip)}
          {!trip.start && !trip.dest && <span className="block text-xs font-normal text-[var(--muted)]" data-testid="route-plan-empty">Add the start and destination on the {trip.name} list.</span>}
        </p>
      )}
      {trip && (
        <div className="flex flex-col gap-1.5 px-1" data-testid="route-plan-times">
          <TimeRow label="Departure" value={trip.departAt} onGo={() => goTo(trip.id)} testId="route-plan-departure" />
          <TimeRow label="Estimated arrival" value={trip.finishAt} onGo={() => goTo(trip.id, "navigator-finish-at")} testId="route-plan-arrival" />
        </div>
      )}
      {issue && (
        <div className="flex flex-col gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="route-plan-warning">
          <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span data-testid="route-plan-warning-text">{issue}</span></p>
          <button type="button" className="flex items-center gap-1 self-start font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => goTo(trip.id)} data-testid="route-plan-goto-departure">
            Set the Departure date in {trip.name} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {live && <UnderwayBubble underway={underway} testId="route-plan-underway" />}
      {live && next ? <NextStep label={next.label} onClick={next.onClick} testId="route-plan-next-step" /> : (
        <button type="button" className="btn-solid h-14 justify-center gap-2 text-base font-extrabold uppercase tracking-wide" onClick={onDepart} disabled={!trip} data-testid="depart-all-done-btn">
          <Navigation className="h-5 w-5" /> Depart, all checks done
        </button>
      )}
    </section>
  );
};

export const DepartRoute = ({ trips, boat, onPick, onDepart, next }) => {
  const trip = pickTrip(trips, boat.route_trip, boat.route_trip_day);
  return <RoutePlanCard trips={trips} trip={trip} issue={tripIssue(trips, trip)} underway={boat.underway} onPick={onPick} onDepart={onDepart} next={next} />;
};
