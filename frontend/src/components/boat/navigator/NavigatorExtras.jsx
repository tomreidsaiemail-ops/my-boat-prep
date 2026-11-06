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

export const MEETUP_DEFAULT = "Pier X, Berth YYY, be onboard no later than ONE HOUR before DEPARTURE, as that is when the crew briefing will begin.";

const When = ({ id, label, value, onChange }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
    <span className="field-label">{label}</span>
    <input id={id} type="datetime-local" value={value || ""} onChange={(e) => onChange(e.target.value)} className="field-input w-full !text-sm" data-testid={`${id}-input`} />
  </label>
);

// Departure, optional race/event and where crew meet, kept with the passage plan.
export const TripTiming = ({ weather = {}, onChange }) => (
  <div className="flex flex-col gap-3" data-testid="trip-timing">
    <When id="navigator-depart-at" label="Departure date and time" value={weather.depart_at} onChange={(v) => onChange({ depart_at: v })} />
    <label htmlFor="navigator-event-name" className="flex flex-col gap-1.5">
      <span className="field-label">Event name (optional)</span>
      <input id="navigator-event-name" value={weather.event_name || ""} maxLength={100} placeholder="e.g. RPNYC Winter Series Race 3" onChange={(e) => onChange({ event_name: e.target.value })}
        className="field-input text-base normal-case tracking-normal" data-testid="navigator-event-name-input" />
    </label>
    <When id="navigator-event-at" label="Event date and time (optional)" value={weather.event_at} onChange={(v) => onChange({ event_at: v })} />
    <label htmlFor="navigator-meetup" className="flex flex-col gap-1.5">
      <span className="field-label">Meet up details</span>
      <textarea id="navigator-meetup" value={weather.meetup ?? MEETUP_DEFAULT} maxLength={1000} rows={3} onChange={(e) => onChange({ meetup: e.target.value })}
        className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-meetup-input" />
    </label>
  </div>
);

export const WhyGoing = ({ value, onChange }) => (
  <label className="flex flex-col gap-1.5">
    <span className="field-label">Why we're going</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3}
      placeholder="e.g. Window Tue 0600-1800: SW 15-20 kn easing, 1.5 m swell. Leave before the next front on Wed."
      className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-why-input" />
    <span className="text-xs text-[var(--muted)]">Logged in the Ship's Log with the photos when Departure is ticked on the Leaving Dock list.</span>
  </label>
);
