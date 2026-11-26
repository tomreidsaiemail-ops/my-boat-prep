import { ArrowDown, CheckCircle2, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dmyt } from "@/lib/allDone";
import { RouteTabs } from "@/components/boat/navigator/RouteTabs";
import { arriveType } from "@/components/boat/navigator/ArriveType";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { localTime } from "@/components/boat/navigator/StopDetails";
import { legMiles, milesText } from "@/lib/tripStops";

const LIST_NAMES = { arrivingDest: "Arriving at Destination", returningDock: "Returning to Dock" };
// The checklist pops up over the trip plan, so the skipper keeps their place.
const openList = (t) => window.dispatchEvent(new CustomEvent("mbp:open-arrival", { detail: { id: t.list, name: LIST_NAMES[t.list], kind: t.key, prep: t.prep } }));

const same = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
// The trip's sailed legs (from Leaving Dock onwards) that match each planned leg, by order and start and destination.
const sailedFor = (legs, done = []) => legs.map((l, n) => (done[n] && same(done[n].start, l.route_start) && same(done[n].dest, l.route_dest) ? done[n] : null));
const Done = ({ text, at, testId }) => (
  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-800 shadow-sm" data-testid={testId}>
    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {text}{at ? ` ${localTime(at)}` : ""}
  </span>
);

const Leg = ({ leg, n, prev, miles, sailed }) => {
  const t = arriveType(leg.arrive_type);
  const Icon = t?.Icon;
  const left = !!sailed?.at;
  const arrived = !!sailed?.arrived_at;
  return (
    <li className="flex flex-col gap-2" data-testid={`trip-confirm-leg-${n}`}>
      <div className="flex flex-col gap-0.5 rounded-3xl bg-[var(--navy)] px-5 py-4 text-white shadow" data-testid={`trip-confirm-depart-${n}`}>
        <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-white/80"><Navigation className="h-3.5 w-3.5" /> Leg {n + 1} · {n === 0 ? "Leave Dock" : arriveType(prev?.arrive_type)?.leave || "Depart"}</span>
        <b className="font-display text-xl leading-tight">{leg.route_start || "Start not set"}</b>
        <span className="text-sm font-semibold">{dmyt(leg.depart_at) || "Departure not set"}</span>
        {left && <Done text="Departed" at={sailed.at} testId={`trip-confirm-departed-${n}`} />}
      </div>
      <ArrowDown className="mx-auto h-5 w-5 text-[var(--navy)]" />
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-3xl bg-emerald-700 px-5 py-4 text-white shadow" data-testid={`trip-confirm-arrive-${n}`}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-white/80">{Icon && <Icon className="h-3.5 w-3.5" />} Arrive · {t?.label || "Type not set"}</span>
          <b className="break-words font-display text-xl leading-tight">{leg.route_dest || "Destination not set"}</b>
          <span className="text-sm font-semibold">{dmyt(leg.finish_at) || "Estimated Finish not set"}</span>
          {miles != null && <span className="text-xs font-bold text-white/85" data-testid={`trip-confirm-miles-${n}`}>{milesText(miles)}</span>}
          {arrived && <Done text={sailed.arrival === "transit" ? "Passed" : "Arrived"} at={sailed.arrived_at} testId={`trip-confirm-arrived-${n}`} />}
        </div>
        {t && (
          <button type="button" onClick={() => openList(t)} className="flex w-28 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-emerald-700 bg-emerald-50 px-2 text-center text-sm font-bold leading-tight text-emerald-900 [transition:transform_.1s] hover:bg-emerald-100 active:scale-95"
            data-testid={`trip-confirm-prepare-${n}`}>{t.prep}</button>
        )}
      </div>
    </li>
  );
};

const Stops = ({ legs, sailed }) => {
  const miles = legMiles(legs);
  return <ol className="flex flex-col gap-4" data-testid="trip-stops">{legs.map((l, n) => <Leg key={l.id ?? n} leg={l} n={n} prev={legs[n - 1]} miles={miles[n]} sailed={sailed[n]} />)}</ol>;
};

// Shown once a planned leg returns to the dock, or from the Route bubble (onPlace: with the Stops and Map tabs).
export const TripConfirm = ({ open, legs, name, onClose, onPlace, onPath, onRedraw, done, shared = null }) => {
  const home = arriveType(legs[legs.length - 1]?.arrive_type)?.key === "dock";
  const sailed = sailedFor(legs, done);
  const complete = sailed.filter((r) => r?.arrived_at).length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="max-h-[94vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid={onPlace ? "trip-view-dialog" : "trip-confirm-dialog"} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black text-[var(--navy)]">{onPlace ? "Planned route" : "Trip plan"}{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription data-testid="trip-confirm-summary">{legs.length} {legs.length === 1 ? "leg" : "legs"}{home ? ", back at the dock" : ""}{complete ? `, ${complete} of ${legs.length} completed` : ""}. Tap a Prepare to... box to open its arrival checklist.</DialogDescription>
        </DialogHeader>
        {onPlace ? (
          <RouteTabs stops={<Stops legs={legs} sailed={sailed} />} map={<StopsMap legs={legs} sailed={sailed} onPrepare={openList} shared={shared} />} />
        ) : <Stops legs={legs} sailed={sailed} />}
        <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="trip-confirm-done-btn">{onPlace ? "Done" : "Looks good"}</button>
      </DialogContent>
    </Dialog>
  );
};
