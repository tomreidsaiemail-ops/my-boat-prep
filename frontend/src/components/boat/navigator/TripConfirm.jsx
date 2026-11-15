import { ArrowDown, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dmyt } from "@/lib/allDone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { arriveType } from "@/components/boat/navigator/ArriveType";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { legMiles, milesText } from "@/lib/tripStops";

const LIST_NAMES = { arrivingDest: "Arriving at Destination", returningDock: "Returning to Dock" };
// The checklist pops up over the trip plan, so the skipper keeps their place.
const openList = (t) => window.dispatchEvent(new CustomEvent("mbp:open-arrival", { detail: { id: t.list, name: LIST_NAMES[t.list], kind: t.key, prep: t.prep } }));

const Leg = ({ leg, n, prev, miles }) => {
  const t = arriveType(leg.arrive_type);
  const Icon = t?.Icon;
  return (
    <li className="flex flex-col gap-2" data-testid={`trip-confirm-leg-${n}`}>
      <div className="flex flex-col gap-0.5 rounded-3xl bg-[var(--navy)] px-5 py-4 text-white shadow" data-testid={`trip-confirm-depart-${n}`}>
        <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-white/80"><Navigation className="h-3.5 w-3.5" /> Leg {n + 1} · {n === 0 ? "Leave Dock" : arriveType(prev?.arrive_type)?.leave || "Depart"}</span>
        <b className="font-display text-xl leading-tight">{leg.route_start || "Start not set"}</b>
        <span className="text-sm font-semibold">{dmyt(leg.depart_at) || "Departure not set"}</span>
      </div>
      <ArrowDown className="mx-auto h-5 w-5 text-[var(--navy)]" />
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-3xl bg-emerald-700 px-5 py-4 text-white shadow" data-testid={`trip-confirm-arrive-${n}`}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-white/80">{Icon && <Icon className="h-3.5 w-3.5" />} Arrive · {t?.label || "Type not set"}</span>
          <b className="break-words font-display text-xl leading-tight">{leg.route_dest || "Destination not set"}</b>
          <span className="text-sm font-semibold">{dmyt(leg.finish_at) || "Estimated Finish not set"}</span>
          {miles != null && <span className="text-xs font-bold text-white/85" data-testid={`trip-confirm-miles-${n}`}>{milesText(miles)}</span>}
        </div>
        {t && (
          <button type="button" onClick={() => openList(t)} className="flex w-28 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-emerald-700 bg-emerald-50 px-2 text-center text-sm font-bold leading-tight text-emerald-900 [transition:transform_.1s] hover:bg-emerald-100 active:scale-95"
            data-testid={`trip-confirm-prepare-${n}`}>{t.prep}</button>
        )}
      </div>
    </li>
  );
};

const Stops = ({ legs }) => {
  const miles = legMiles(legs);
  return <ol className="flex flex-col gap-4" data-testid="trip-stops">{legs.map((l, n) => <Leg key={l.id ?? n} leg={l} n={n} prev={legs[n - 1]} miles={miles[n]} />)}</ol>;
};

// Shown once a planned leg returns to the dock, or from View planned route... (onPlace: with the Stops and Map tabs).
export const TripConfirm = ({ open, legs, name, onClose, onPlace }) => {
  const home = arriveType(legs[legs.length - 1]?.arrive_type)?.key === "dock";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="max-h-[94vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid={onPlace ? "trip-view-dialog" : "trip-confirm-dialog"} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black text-[var(--navy)]">{onPlace ? "Planned route" : "Trip plan"}{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription data-testid="trip-confirm-summary">{legs.length} {legs.length === 1 ? "leg" : "legs"}{home ? ", back at the dock" : ""}. Tap a Prepare to... box to open its arrival checklist.</DialogDescription>
        </DialogHeader>
        {onPlace ? (
          <Tabs defaultValue="stops" className="flex flex-col gap-3">
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="stops" className="h-9 font-bold" data-testid="trip-view-stops-tab">Stops</TabsTrigger>
              <TabsTrigger value="map" className="h-9 font-bold" data-testid="trip-view-map-tab">Map</TabsTrigger>
            </TabsList>
            <TabsContent value="stops" className="mt-0"><Stops legs={legs} /></TabsContent>
            <TabsContent value="map" className="mt-0"><StopsMap legs={legs} onPlace={onPlace} onPrepare={openList} /></TabsContent>
          </Tabs>
        ) : <Stops legs={legs} />}
        <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="trip-confirm-done-btn">{onPlace ? "Done" : "Looks good"}</button>
      </DialogContent>
    </Dialog>
  );
};
