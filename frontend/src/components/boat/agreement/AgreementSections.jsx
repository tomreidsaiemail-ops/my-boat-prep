import { useState } from "react";
import { CheckCircle2, Map as MapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { localWhen } from "@/lib/timeAgo";

// "I've read the ..." tick, like the role briefing ones.
export const ReadTick = ({ checked, onChange, disabled, children, testId }) => (
  <label className={`flex items-center gap-2 self-start rounded-md border-[1.5px] px-2.5 py-1.5 text-sm font-bold ${checked ? "border-emerald-600 bg-emerald-50" : "border-[var(--navy)] bg-white"}`} data-testid={testId}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-emerald-700" data-testid={`${testId}-checkbox`} />
    {children}
  </label>
);

export const Done = ({ children, testId }) => (
  <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900" data-testid={testId}>
    <CheckCircle2 className="h-4 w-4" /> {children}
  </p>
);

const when = (v) => (v && v.length >= 16 ? localWhen(v) : v ? new Date(`${v}T12:00`).toLocaleDateString() : "");
const Fact = ({ label, value, testId }) => (value ? <p className="text-sm" data-testid={testId}><b>{label}:</b> {value}</p> : null);
const hasMap = (legs) => !!(legs[0]?.start_pos && legs[legs.length - 1]?.dest_pos);

// Trip Plan: the Route Planning trip they were invited to, a map when it has pins, and the meet up to agree to when the skipper asks.
export const TripPlanSection = ({ trip, ok, meetOk, locked, onOk, onMeetOk }) => {
  const [map, setMap] = useState(false);
  const [meet, setMeet] = useState(false);
  const [agree, setAgree] = useState(false);
  const legs = trip.legs || [];
  const tick = (v) => {
    if (!v) { onOk(false); onMeetOk(false); return; }
    if (trip.meetup_agree && !meetOk) { setAgree(false); setMeet(true); return; }
    onOk(true);
  };
  const closeMeet = (done) => { setMeet(false); if (done) { onMeetOk(true); onOk(true); } };
  return (
    <section className="flex flex-col gap-1.5" data-testid="agreement-trip-plan">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">Trip Plan</h3>
      {!ok && (
        <div className="flex flex-col gap-1 rounded-md bg-sky-50 p-2.5" data-testid="agreement-trip-details">
          <Fact label="START" value={legs[0]?.route_start} testId="agreement-trip-start" />
          <Fact label="DESTINATION" value={legs[0]?.route_dest} testId="agreement-trip-dest" />
          <Fact label="Why we're going" value={trip.why} testId="agreement-trip-why" />
          <Fact label="Event or plan" value={trip.event || trip.name} testId="agreement-trip-event" />
          <Fact label="Departure" value={when(trip.depart_at)} testId="agreement-trip-depart" />
          <Fact label="Estimated finish" value={when(trip.finish_at)} testId="agreement-trip-finish" />
          <Fact label="Meet up" value={trip.meetup} testId="agreement-trip-meetup" />
          {legs.length > 1 && (
            <ol className="ml-1 flex flex-col gap-0.5 text-sm" data-testid="agreement-trip-legs">
              {legs.map((l, n) => <li key={n}><b>Leg {n + 1}:</b> {[l.route_start, l.route_dest].filter(Boolean).join(" to ")}{l.depart_at ? `, departs ${when(l.depart_at)}` : ""}</li>)}
            </ol>
          )}
          {hasMap(legs) && (
            <button type="button" className="btn-ghost mt-1 h-10 justify-center gap-1.5 self-start px-3 text-sm" onClick={() => setMap(true)} data-testid="agreement-trip-map-btn">
              <MapIcon className="h-4 w-4" /> Open map to see trip
            </button>
          )}
        </div>
      )}
      <ReadTick checked={ok} disabled={locked} onChange={tick} testId="agreement-trip-ok">I&apos;ve read and accepted the skipper&apos;s plan</ReadTick>
      {ok && trip.meetup_agree && meetOk && <Done testId="agreement-meet-ok">You won&apos;t be late for the meet up</Done>}
      {map && (
        <Dialog open onOpenChange={(o) => !o && setMap(false)}>
          <DialogContent guard={false} className="max-h-[94vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="agreement-trip-map-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle className="font-display text-xl font-black text-[var(--navy)]">Trip map: {trip.event || trip.name}</DialogTitle></DialogHeader>
            <StopsMap legs={legs} onPlace={() => {}} />
            <button type="button" className="btn-solid h-12 justify-center" onClick={() => setMap(false)} data-testid="agreement-trip-map-done-btn">Done</button>
          </DialogContent>
        </Dialog>
      )}
      {meet && (
        <Dialog open onOpenChange={(o) => !o && closeMeet(false)}>
          <DialogContent guard={false} className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="agreement-meetup-dialog">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-extrabold">Meet up details</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap text-left text-base font-semibold text-[var(--ink)]" data-testid="agreement-meetup-text">{trip.meetup}</DialogDescription>
            </DialogHeader>
            <label className={`flex items-start gap-3 rounded-md border-[1.5px] p-2.5 text-sm font-bold ${agree ? "border-emerald-600 bg-emerald-50" : "border-[var(--navy)]"}`} data-testid="agreement-meetup-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700" data-testid="agreement-meetup-agree-checkbox" />
              I recognize the meet up details are important to the skipper, I will not be late
            </label>
            <button type="button" className="btn-solid h-12 justify-center" disabled={!agree} onClick={() => closeMeet(true)} data-testid="agreement-meetup-ok-btn">OK</button>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};
