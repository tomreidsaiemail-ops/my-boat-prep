import useAdminLists from "@/hooks/useAdminLists";
import { AlertTriangle, BellRing } from "lucide-react";

// Paragraphs come from the private admin list "Admin - Help Panel - MMN Routing Guidance" (cached for offline use).
const GUIDANCE = "admin - help panel - mmn routing guidance";

export const NavigatorIntro = ({ online }) => {
  const items = useAdminLists("Admin - Help Panel - ", online).find((l) => l.name.toLowerCase().replace(/\s+/g, " ").trim() === GUIDANCE)?.items || [];
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-snug" data-testid="navigator-intro">
      {items.map((i, n) => <p key={i.id ?? n} data-testid={`navigator-intro-${n}`}>{i.label}</p>)}
    </div>
  );
};

export const NavigatorReminders = () => (
  <ul className="flex flex-col gap-1.5 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="navigator-reminders">
    <li className="flex gap-2"><BellRing className="mt-0.5 h-4 w-4 shrink-0" /> When the weather reports update, check your weather and routing products again and upload fresh screenshots here.</li>
    <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Where available, monitor the AI polars of your chosen weather and routing products, so the routing matches how your boat really sails.</li>
  </ul>
);

import { MEETUP_DEFAULT } from "@/lib/routeNotes";

const When = ({ id, label, value, onChange, warn }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
    <span className={`field-label ${warn ? "!text-[var(--red)]" : ""}`}>{label}</span>
    <input id={id} type="datetime-local" value={value || ""} onChange={(e) => onChange(e.target.value)} aria-invalid={!!warn}
      className={`field-input w-full !text-sm ${warn ? "!border-[var(--red)] bg-red-50" : ""}`} data-testid={`${id}-input`} />
  </label>
);

// Departure and Start are normally the same day (racers leave the dock an hour or so before the start), so flag anything else.
const day = (v) => (v || "").slice(0, 10);
const timingAnomaly = (w) => {
  if (!w.event_at) return "";
  if (!w.depart_at) return "There's a Start date and time but no Departure date and time. Check this is right.";
  if (day(w.depart_at) !== day(w.event_at)) return "Departure and Start are on different days. Check this is right.";
  return "";
};

// Departure, optional race/event and where crew meet, kept with the passage plan.
export const TripTiming = ({ weather = {}, onChange }) => {
  const warn = timingAnomaly(weather);
  // Start follows Departure until the skipper sets a different Start.
  const depart = (v) => onChange({ depart_at: v, ...(!weather.event_at || weather.event_at === weather.depart_at ? { event_at: v } : {}) });
  return (
  <div className="flex flex-col gap-3" data-testid="trip-timing">
    <When id="navigator-depart-at" label="Departure date and time" value={weather.depart_at} onChange={depart} warn={warn} />
    <label htmlFor="navigator-event-name" className="flex flex-col gap-1.5">
      <span className="field-label">Event or Trip name (optional)</span>
      <input id="navigator-event-name" value={weather.event_name || ""} maxLength={100} placeholder="e.g. RPNYC Winter Series Race 3" onChange={(e) => onChange({ event_name: e.target.value })}
        className="field-input text-base normal-case tracking-normal" data-testid="navigator-event-name-input" />
    </label>
    <When id="navigator-event-at" label="Start date and time (optional)" value={weather.event_at} onChange={(v) => onChange({ event_at: v })} warn={warn} />
    {warn && <p role="alert" className="-mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="trip-timing-anomaly">{warn}</p>}
    <When id="navigator-finish-at" label="Estimated Finish date and time (optional)" value={weather.finish_at} onChange={(v) => onChange({ finish_at: v })} />
    <label htmlFor="navigator-meetup" className="flex flex-col gap-1.5">
      <span className="field-label">Meet up details</span>
      <textarea id="navigator-meetup" value={weather.meetup ?? MEETUP_DEFAULT} maxLength={1000} rows={3} onChange={(e) => onChange({ meetup: e.target.value })}
        className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-meetup-input" />
    </label>
  </div>
  );
};

export const WhyGoing = ({ value, onChange }) => (
  <label className="flex flex-col gap-1.5">
    <span className="field-label">Why we're going</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3}
      placeholder="e.g. Window Tue 0600-1800: SW 15-20 kn easing, 1.5 m swell. Leave before the next front on Wed."
      className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-why-input" />
    <span className="text-xs text-[var(--muted)]">Logged in the Ship's Log with the photos when Departure is ticked on the Leaving Dock list.</span>
  </label>
);
