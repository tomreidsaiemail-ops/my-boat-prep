import { ArrowDown, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dmyt } from "@/lib/allDone";
import { arriveType } from "@/components/boat/navigator/ArriveType";

const openList = (id, onClose) => { onClose(); window.dispatchEvent(new CustomEvent("mbp:open-list", { detail: id })); };

const Leg = ({ leg, n, prev, onClose }) => {
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
        </div>
        {t && (
          <button type="button" onClick={() => openList(t.list, onClose)} className="flex w-28 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-emerald-700 bg-emerald-50 px-2 text-center text-sm font-bold leading-tight text-emerald-900 [transition:transform_.1s] hover:bg-emerald-100 active:scale-95"
            data-testid={`trip-confirm-prepare-${n}`}>{t.prep}</button>
        )}
      </div>
    </li>
  );
};

// Shown once a planned leg returns to the dock: the whole trip, each arrival with its checklist a tap away.
export const TripConfirm = ({ open, legs, name, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent guard={false} className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="trip-confirm-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-black text-[var(--navy)]">Trip plan{name ? `: ${name}` : ""}</DialogTitle>
        <DialogDescription data-testid="trip-confirm-summary">{legs.length} {legs.length === 1 ? "leg" : "legs"}, back at the dock. Tap a Prepare to... box to open its arrival checklist.</DialogDescription>
      </DialogHeader>
      <ol className="flex flex-col gap-4">{legs.map((l, n) => <Leg key={l.id ?? n} leg={l} n={n} prev={legs[n - 1]} onClose={onClose} />)}</ol>
      <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="trip-confirm-done-btn">Looks good</button>
    </DialogContent>
  </Dialog>
);
