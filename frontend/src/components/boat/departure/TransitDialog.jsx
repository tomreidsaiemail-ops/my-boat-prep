import { Navigation2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SetNow, When } from "@/components/boat/navigator/NavigatorExtras";
import { arriveType } from "@/components/boat/navigator/ArriveType";
import { PLANNED } from "@/components/boat/departure/NextStep";

const span = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
// "logged 15 min late" when the transit is logged ahead of time or afterwards (a couple of minutes either way counts as now).
export const offsetText = (at) => {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  return Number.isNaN(m) || Math.abs(m) < 2 ? "" : `logged ${span(Math.abs(m))} ${m > 0 ? "late" : "early"}`;
};
const nowLabel = (m) => (m ? `Set to Now - ${-m} minutes` : "Set to Now");

// Passing a Transit point: no checklist, just when it was passed and an automatic departure on to the next stop.
export const TransitDialog = ({ transit, onAt, onConfirm, onClose }) => {
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
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid="transit-dialog-time">
              <When id="transit-at" label="Transit date and time" value={transit.at} onChange={onAt} warn={!ok} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--muted)]" data-testid="transit-dialog-offset">{off ? `Transit ${off}: the transit GPS in the Ship's Log is flagged as approximate.` : "Logged now, with the transit GPS."}</span>
                <SetNow step={-5} onSet={onAt} label={nowLabel} className="btn-ghost h-9 min-h-0 px-3 text-xs" testId="transit-at-now" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className={`btn-solid h-12 flex-1 justify-center gap-2 font-extrabold uppercase tracking-wide ${PLANNED}`} onClick={onConfirm} disabled={!ok} data-testid="transit-dialog-confirm-btn">
                <Navigation2 className="h-4 w-4" /> Transiting through
              </button>
              <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="transit-dialog-cancel-btn">Cancel</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
