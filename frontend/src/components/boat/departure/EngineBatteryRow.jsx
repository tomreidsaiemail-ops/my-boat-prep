// The engine battery is always taken as Full, with the alternator watched during the trip.
export const EngineBatteryRow = ({ id, label = "Engine battery" }) => (
  <div className="flex flex-col gap-1" data-testid={`level-${id}`}>
    <span className="text-sm font-extrabold">{label}</span>
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-md border-2 border-emerald-700 bg-emerald-700 px-3 text-sm font-extrabold text-white"
        role="radio" aria-checked="true" aria-label={`${label} Full`} data-testid={`level-${id}-full`}>Full</span>
      <label className="flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
        <input type="checkbox" checked readOnly disabled className="h-5 w-5 accent-green-700" data-testid={`level-${id}-monitor`} />
        Monitor alternator during trip
      </label>
    </div>
  </div>
);

// Home is Additional Boat Details; unticked, the engine battery isn't checked or logged.
export const UsingEngineBattery = ({ on, onChange, testId }) => (
  <label className="flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-green-700" data-testid={testId} />
    Using an engine battery
  </label>
);
