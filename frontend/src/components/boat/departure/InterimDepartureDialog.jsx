import { useState } from "react";
import { Anchor, LifeBuoy, Sailboat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NavigatorAsk } from "@/components/boat/NavigatorAsk";
import { LEG_KINDS, nowLocal, today } from "@/lib/allDone";

const ICONS = { berth: Sailboat, anchor: Anchor, mooring: LifeBuoy };
const blank = () => ({ route_start: "", route_dest: "", weather: { depart_at: nowLocal(), finish_at: today(), meetup: "" } });

const missing = (w) => {
  if ((w.finish_at || "").length < 16) return "Enter the Estimated Finish (arrival) date and time first.";
  if (w.depart_at && w.finish_at < w.depart_at) return "The Estimated Finish (arrival) is before the Departure. Check the times.";
  return "";
};

const Body = ({ trip, boat, items, online, locked, onUpgrade, boatId, onDepart }) => {
  const [leg, setLeg] = useState(blank);
  const [error, setError] = useState("");
  const legBoat = { ...boat, route_start: leg.route_start, route_dest: leg.route_dest, weather: leg.weather };
  const go = (kind) => {
    const why = missing(leg.weather);
    setError(why);
    if (!why) onDepart(kind, leg);
  };
  return (
    <>
      <NavigatorAsk interim boat={legBoat} items={items} online={online} locked={locked} onUpgrade={onUpgrade} boatId={boatId}
        onChange={(k, v) => { setLeg((l) => ({ ...l, [k]: v })); setError(""); }}
        onWeather={(patch) => { setLeg((l) => ({ ...l, weather: { ...l.weather, ...patch } })); setError(""); }} />
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="interim-departure-error">{error}</p>}
      <div className="sticky bottom-0 -mx-1 grid grid-cols-3 gap-2 bg-white px-1 pb-1 pt-2" data-testid="interim-departure-actions">
        {LEG_KINDS.map((k) => {
          const Icon = ICONS[k.key];
          return (
            <button key={k.key} type="button" className="btn-solid flex h-auto min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs font-extrabold uppercase leading-tight" onClick={() => go(k.key)} data-testid={`interim-departure-${k.key}-btn`}>
              <Icon className="h-5 w-5" /> {k.label}
            </button>
          );
        })}
      </div>
      {trip && <p className="text-xs text-[var(--muted)]" data-testid="interim-departure-trip">Added to Route Plan: {trip.name} as part of the overall trip.</p>}
    </>
  );
};

// Arriving at Destination: today's departure from an anchorage, berth or mooring, part of the overall trip.
export const InterimDepartureDialog = ({ open, onClose, ...props }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg" data-testid="interim-departure-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle className="font-display text-lg font-extrabold">New departure{props.trip ? ` · Route Plan: ${props.trip.name}` : ""}</DialogTitle>
        <DialogDescription>Fill in today's departure. Departure is set to now. Then tap how you're leaving to tick those items and log it.</DialogDescription>
      </DialogHeader>
      {open && <Body {...props} />}
    </DialogContent>
  </Dialog>
);
