import { useState } from "react";
import { Anchor, LifeBuoy, Sailboat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NavigatorAsk } from "@/components/boat/NavigatorAsk";
import { LEG_KINDS, dmyt, nowLocal, today } from "@/lib/allDone";

const ICONS = { berth: Sailboat, anchor: Anchor, mooring: LifeBuoy };
const pad = (n) => String(n).padStart(2, "0");
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// next: the next planned leg from Route Planning. It leaves now, and its finish moves by however early or late that is.
const blank = (next) => {
  if (!next) return { route_start: "", route_dest: "", weather: { depart_at: nowLocal(), finish_at: today(), meetup: "" } };
  const now = new Date();
  const dep = new Date(next.depart_at || "");
  const fin = new Date(next.finish_at || "");
  const finish = Number.isNaN(fin.getTime()) ? next.finish_at || today() : local(Number.isNaN(dep.getTime()) ? fin : new Date(fin.getTime() + (now.getTime() - dep.getTime())));
  return { route_start: next.route_start || "", route_dest: next.route_dest || "", weather: { depart_at: local(now), finish_at: finish, meetup: "", arrive_type: next.arrive_type || "" } };
};

const missing = (w) => {
  if ((w.finish_at || "").length < 16) return "Enter the Estimated Finish (arrival) date and time first.";
  if (w.depart_at && w.finish_at < w.depart_at) return "The Estimated Finish (arrival) is before the Departure. Check the times.";
  return "";
};

const Body = ({ trip, next, boat, items, online, locked, onUpgrade, boatId, onDepart }) => {
  const [leg, setLeg] = useState(() => blank(next));
  const planned = next && (next.depart_at || next.finish_at) && (
    <p className="-mt-1 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900" data-testid="interim-departure-planned-times">
      Planned Leg {next.n} times: Departure {dmyt(next.depart_at) || "not set"} · Estimated Finish {dmyt(next.finish_at) || "not set"}. Departure is now set to now and the finish moved to match.
    </p>
  );
  const [error, setError] = useState("");
  const legBoat = { ...boat, route_start: leg.route_start, route_dest: leg.route_dest, weather: leg.weather };
  const go = (kind) => {
    const why = missing(leg.weather);
    setError(why);
    if (!why) onDepart(kind, leg);
  };
  return (
    <>
      <NavigatorAsk interim timesNote={planned} legNo={next?.n || 1} boat={legBoat} items={items} online={online} locked={locked} onUpgrade={onUpgrade} boatId={boatId}
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
        <DialogDescription>{props.next ? `Leg ${props.next.n} from Route Planning is filled in, leaving now.` : "Fill in today's departure. Departure is set to now."} Then tap how you're leaving to tick those items and log it.</DialogDescription>
      </DialogHeader>
      {open && <Body {...props} />}
    </DialogContent>
  </Dialog>
);
