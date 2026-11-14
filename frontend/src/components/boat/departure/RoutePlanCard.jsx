import { Map as MapIcon, Navigation } from "lucide-react";
import { tripLine } from "@/lib/allDone";
import { UnderwayBubble } from "@/components/boat/departure/UnderwayBubble";

// Leaving the Dock: which Route Planning trip this departure uses, its summary and the one-tap DEPART.
export const RoutePlanCard = ({ trips, trip, underway, onPick, onDepart }) => {
  const live = underway?.trip_id && underway.trip_id === trip?.id;
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="route-plan-card">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><MapIcon className="h-4 w-4" /> Route Plan</h3>
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
      {live && <UnderwayBubble underway={underway} testId="route-plan-underway" />}
      <button type="button" className="btn-solid h-14 justify-center gap-2 text-base font-extrabold uppercase tracking-wide" onClick={onDepart} disabled={!trip} data-testid="depart-all-done-btn">
        <Navigation className="h-5 w-5" /> Depart, all checks done
      </button>
    </section>
  );
};
