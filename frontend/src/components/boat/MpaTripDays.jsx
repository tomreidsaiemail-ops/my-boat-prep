import { tripMeals } from "@/lib/mpa";

const short = (v) => { try { return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(v)); } catch { return v; } };

// Trip duration typed in by the skipper.
export const MpaDaysField = ({ value, days, onChange }) => (
  <label className={`rounded-md border-[1.5px] px-3 py-2 ${days ? "border-[var(--line)]" : "border-amber-400 bg-amber-50"}`} data-testid="mpa-days">
    <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Trip duration</span>
    <span className="flex items-center gap-1.5">
      <input type="number" inputMode="numeric" min={1} max={365} value={value} placeholder="1" onChange={(e) => onChange(e.target.value)}
        className="h-8 w-16 rounded border-[1.5px] border-[var(--line)] bg-white px-2 text-sm font-bold" aria-label="Trip duration in days" data-testid="mpa-days-input" />
      <span className="text-sm font-bold">{days === 1 ? "day" : "days"}</span>
    </span>
    {!days && <span className="block text-xs font-semibold text-amber-900" data-testid="mpa-days-unset">Not set, using 1 day</span>}
  </label>
);

// Pick a planned trip: its days fill Trip duration and its breakfasts, lunches and dinners are counted.
export const MpaTripPicker = ({ trips, tripId, onPick }) => {
  const trip = trips.find((t) => t.id === tripId);
  const m = trip && tripMeals(trip.departAt, trip.endAt);
  return (
    <div className="flex flex-col gap-1.5" data-testid="mpa-trip">
      <label className="field-label" htmlFor="mpa-trip-select">Work it out from a trip</label>
      <select id="mpa-trip-select" value={tripId} onChange={(e) => onPick(e.target.value)} className="field-input" data-testid="mpa-trip-select">
        <option value="">Pick a trip...</option>
        {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {m && <>
        <p className="text-sm font-bold text-[var(--navy)]" data-testid="mpa-trip-meals">
          Breakfasts ({m.breakfast}) · Lunches ({m.lunch}) · Dinners ({m.dinner})
        </p>
        <p className="text-xs text-[var(--muted)]" data-testid="mpa-trip-window">
          {short(trip.departAt)} to {short(trip.endAt)}, {m.days} {m.days === 1 ? "day" : "days"}. Counted at breakfast 8am, lunch 12:30pm and dinner 6:30pm.
        </p>
      </>}
    </div>
  );
};
