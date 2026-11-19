import useAdminLists from "@/hooks/useAdminLists";
import { AlertTriangle, BellRing, ChevronRight } from "lucide-react";
import { ArriveType } from "@/components/boat/navigator/ArriveType";

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

// Date and time are separate boxes, so a date saves even before a time is picked (a single date-and-time box saves nothing until both are filled).
// onLeave: the date box lost focus (typing a date changes it a keystroke at a time).
export const When = ({ id, label, value, onChange, warn, onLeave }) => {
  const [date, time] = [(value || "").slice(0, 10), (value || "").slice(11, 16)];
  const join = (d, t) => onChange(d ? (t ? `${d}T${t}` : d) : "");
  const box = `field-input w-full !text-sm ${warn ? "!border-[var(--red)] bg-red-50" : ""}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-testid={`${id}-field`}>
      <label htmlFor={id} className={`field-label ${warn ? "!text-[var(--red)]" : ""}`}>{label}</label>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <input id={id} type="date" value={date} onChange={(e) => join(e.target.value, time)} onBlur={onLeave} aria-invalid={!!warn} aria-label={`${label}: date`} className={box} data-testid={`${id}-input`} />
        <input type="time" value={time} disabled={!date} onChange={(e) => join(date, e.target.value)} aria-label={`${label}: time`} className={`${box} disabled:opacity-50`} data-testid={`${id}-time-input`} />
      </div>
    </div>
  );
};

// Departure and Start are normally the same day (racers leave the dock an hour or so before the start), so flag anything else.
const day = (v) => (v || "").slice(0, 10);
const timingAnomaly = (w) => {
  if (!w.event_at) return "";
  if (!w.depart_at) return "There's a Start date and time but no Departure date and time. Check this is right.";
  if (day(w.depart_at) !== day(w.event_at)) return "Departure and Start are on different days. Check this is right.";
  return "";
};

// Departure, optional race/event and where crew meet, kept with the passage plan. interim: the New departure window (today's leg).
export const TripTiming = ({ weather = {}, onChange, interim, note = null }) => {
  const warn = timingAnomaly(weather);
  // Start follows Departure until the skipper sets a different Start.
  const depart = (v) => onChange({ depart_at: v, ...(!weather.event_at || weather.event_at === weather.depart_at ? { event_at: v } : {}) });
  // An empty Estimated Finish takes the Departure date, once the date box is left (not on each keystroke).
  const fillFinish = () => { if (!weather.finish_at && day(weather.depart_at)) onChange({ finish_at: day(weather.depart_at) }); };
  // Crew agree to the meet up explicitly once the skipper changes it from the default; the skipper can untick that.
  const meetup = weather.meetup ?? MEETUP_DEFAULT;
  const changed = (m) => !!m.trim() && m.trim() !== MEETUP_DEFAULT;
  const agree = changed(meetup) && weather.meetup_agree !== false;
  const setMeetup = (v) => onChange({ meetup: v, ...(changed(v) && !changed(meetup) ? { meetup_agree: true } : {}) });
  const noDepart = !interim && (weather.depart_at || "").length < 16;
  const departField = <>
    <When id="navigator-depart-at" label="Departure date and time" value={weather.depart_at} onChange={depart} warn={warn || noDepart} onLeave={fillFinish} />
    {noDepart && <p role="alert" className="-mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-depart-required">Enter the Departure date and time. It's needed for the trip plan.</p>}
  </>;
  // Start is only for racing: folded away until opened once, then it stays open.
  const startOpen = weather.event_open || (weather.event_at && weather.event_at !== weather.depart_at);
  const noFinish = (weather.finish_at || "").length < 16;
  const noName = !interim && !String(weather.event_name || "").trim();
  return (
  <div className="flex flex-col gap-3" data-testid="trip-timing">
    {interim && departField}
    <label htmlFor="navigator-event-name" className="flex flex-col gap-1.5">
      <span className={`field-label ${noName ? "!text-[var(--red)]" : ""}`}>Event or Trip name{interim ? " (optional)" : ""}</span>
      <input id="navigator-event-name" value={weather.event_name || ""} maxLength={100} placeholder="e.g. The Yacht Club's Winter Series Race 3" onChange={(e) => onChange({ event_name: e.target.value })}
        className={`field-input text-base normal-case tracking-normal ${noName ? "!border-[var(--red)]" : ""}`} data-testid="navigator-event-name-input" />
    </label>
    {noName && <p role="alert" className="-mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-event-name-required">Enter the Event or Trip name. It's needed before you depart.</p>}
    {!interim && departField}
    {startOpen ? <When id="navigator-event-at" label="Start date and time (optional)" value={weather.event_at} onChange={(v) => onChange({ event_at: v })} warn={warn} />
      : <button type="button" onClick={() => onChange({ event_open: true })} className="flex items-center gap-2 rounded-md border-[1.5px] border-dashed border-[var(--line)] px-3 py-2 text-left text-sm" data-testid="navigator-event-at-expand-btn">
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--navy)]" />
        <span><b className="text-[var(--navy)]">Start date and time (optional)</b><span className="block text-xs text-[var(--muted)]">Same as DEPARTURE DATE AND TIME. Only for racing, tap to set a different Start.</span></span>
      </button>}
    {warn && <p role="alert" className="-mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="trip-timing-anomaly">{warn}</p>}
    <When id="navigator-finish-at" label="Estimated Finish date and time" value={weather.finish_at} onChange={(v) => onChange({ finish_at: v })} warn={!interim && noFinish} />
    {note}
    {!interim && noFinish && <p role="alert" className="-mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="navigator-finish-required">Enter the Estimated Finish date and time. It's needed for the trip plan.</p>}
    {!interim && <ArriveType id="navigator-arrive-type" value={weather.arrive_type || ""} onChange={(v) => onChange({ arrive_type: v })} />}
    {!interim && <When id="navigator-actual-finish-at" label="(Actual arrival date and time)" value={weather.actual_finish_at} onChange={(v) => onChange({ actual_finish_at: v })} />}
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor="navigator-meetup" className="field-label">Meet up details</label>
        {!interim && (
          <label className={`flex items-center gap-1.5 text-xs font-bold text-[var(--navy)] ${changed(meetup) ? "" : "opacity-50"}`} data-testid="navigator-meetup-agree">
            <input type="checkbox" checked={agree} disabled={!changed(meetup)} onChange={(e) => onChange({ meetup_agree: e.target.checked })} className="h-4 w-4 accent-[var(--navy)]" data-testid="navigator-meetup-agree-checkbox" />
            Crew member to agree to this explicitly
          </label>
        )}
      </div>
      <textarea id="navigator-meetup" value={meetup} maxLength={1000} rows={3} onChange={(e) => setMeetup(e.target.value)}
        className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-meetup-input" />
    </div>
  </div>
  );
};

export const WhyGoing = ({ value, onChange, hint = "Logged in the Ship's Log with the photos when Departure is ticked on the Leaving Dock list." }) => (
  <label className="flex flex-col gap-1.5">
    <span className="field-label">Why we're going</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3}
      placeholder="e.g. Window Tue 0600-1800: SW 15-20 kn easing, 1.5 m swell. Leave before the next front on Wed."
      className="field-input min-h-[80px] resize-y py-2 text-base normal-case leading-snug tracking-normal" data-testid="navigator-why-input" />
    <span className="text-xs text-[var(--muted)]">{hint}</span>
  </label>
);
