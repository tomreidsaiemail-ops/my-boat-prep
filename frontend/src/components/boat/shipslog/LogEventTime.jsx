import { eventRange, fmtLog, toLocalInput } from "@/lib/logTime";

// Edit window for a Ship's Log entry: when the event happened; when the entry was made stays fixed. paper: a scanned paper log, any time in the past.
export const LogEventTime = ({ logged, value, onChange, paper = false }) => {
  const [min, max] = eventRange(logged, paper);
  return (
    <div className="flex flex-col gap-1" data-testid="log-event-time">
      <label htmlFor="log-event-at" className="field-label">Date and time of the event</label>
      <input id="log-event-at" type="datetime-local" value={value} min={min ? toLocalInput(min) : undefined} max={toLocalInput(max)} onChange={(e) => onChange(e.target.value)}
        className="field-input" data-testid="log-event-time-input" />
      <p className="text-xs text-[var(--muted)]" data-testid="log-entry-made">
        Entry made <b className="text-[var(--navy)]">{fmtLog(logged)}</b>, which can&apos;t be changed.{" "}
        {paper ? "This is a scanned paper log, so the event can be any time in the past, and no more than 5 days after the entry was made."
          : "The event can be up to a month before that, and no more than 5 days after it."}
      </p>
    </div>
  );
};
