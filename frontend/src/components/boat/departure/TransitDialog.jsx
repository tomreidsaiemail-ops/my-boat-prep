import { Check, Navigation2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SetNow, When } from "@/components/boat/navigator/NavigatorExtras";
import { arriveType } from "@/components/boat/navigator/ArriveType";
import { PLANNED } from "@/components/boat/departure/NextStep";
import { passing } from "@/lib/motion";
import { milesText } from "@/lib/tripStops";

const span = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
// "logged 15 min late" when the transit is logged ahead of time or afterwards (a couple of minutes either way counts as now).
export const offsetText = (at) => {
  const m = Math.round((Math.floor(Date.now() / 60000) * 60000 - new Date(at).getTime()) / 60000);
  return Number.isNaN(m) || Math.abs(m) < 2 ? "" : `logged ${span(Math.abs(m))} ${m > 0 ? "late" : "early"}`;
};
// The boat's live fix, else its last known one.
const meOf = (gps) => (gps?.status === "ok" ? { lat: gps.lat, lon: gps.lon } : gps?.last?.lat != null ? { lat: gps.last.lat, lon: gps.last.lon, last: true } : null);
// "Transit 2 was passed to the west (transit bearing 090°, not accounting for compass deviation, 0.4 nm)", from the boat's GPS to the transit's map pin.
export const transitBearing = (gps, pos, pin) => {
  if (pos?.lat == null || pos?.lon == null) return `Transit ${pin} has no map position on the plan, so no transit bearing`;
  const me = meOf(gps);
  if (!me) return `No GPS fix, so no bearing to transit ${pin}`;
  const p = passing(me, pos);
  return `Transit ${pin} was passed to the ${p.side} (transit bearing ${String(p.deg).padStart(3, "0")}°, not accounting for compass deviation, ${milesText(p.nm)}${me.last ? ", from the last known GPS" : ""})`;
};
const nowLabel = (m) => (m ? `Set to Now - ${-m} minutes` : "Set to Now");

// Passing a Transit point: no checklist, just when it was passed and an automatic departure on to the next stop.
export const TransitDialog = ({ transit, gps, onAt, onConfirm, onClose }) => {
  const next = transit?.next;
  const type = arriveType(next?.arrive_type);
  const off = transit ? offsetText(transit.at) : "";
  const ok = transit?.at?.length === 16;
  return (
    <Dialog open={!!transit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="transit-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        {transit && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-extrabold" data-testid="transit-dialog-title">Log passing transit {transit.pin}: {transit.point}</DialogTitle>
              <DialogDescription>Log the time you pass transit {transit.pin}. You can log it ahead of time, or after you have passed it.</DialogDescription>
            </DialogHeader>
            <p className="text-sm font-bold text-[var(--navy)]" data-testid="transit-dialog-auto-depart">
              {next ? `An auto depart from TRANSIT ${transit.pin} will be created (Next stop ${next.route_dest || "not set"}, ${type ? type.label.toLowerCase() : "type not set"}).` : `No more legs are planned after TRANSIT ${transit.pin}.`}
            </p>
            <p className="text-sm text-[var(--navy)]" data-testid="transit-dialog-bearing">{transitBearing(gps, transit.pos, transit.pin)}.</p>
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid="transit-dialog-time">
              <When id="transit-at" label="Transit date and time" value={transit.at} onChange={onAt} warn={!ok} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--muted)]" data-testid="transit-dialog-offset">{off ? `Transit ${off}: the transit GPS in the Ship's Log is flagged as approximate.` : "Logged now, with the transit GPS."}</span>
                <SetNow step={-5} onSet={onAt} label={nowLabel} className="btn-ghost h-9 min-h-0 px-3 text-xs" testId="transit-at-now" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className={`btn-solid h-auto min-h-12 flex-[2] justify-center gap-2 py-1.5 font-extrabold uppercase ${PLANNED}`} onClick={onConfirm} disabled={!ok} data-testid="transit-dialog-confirm-btn">
                <Navigation2 className="h-4 w-4 shrink-0" />
                <span className="flex flex-col items-center leading-tight">
                  <span className="flex items-center gap-1 whitespace-nowrap">Transit complete <Check className="h-4 w-4" strokeWidth={3} /></span>
                  <span>Continue</span>
                </span>
              </button>
              <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="transit-dialog-cancel-btn">Cancel</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
