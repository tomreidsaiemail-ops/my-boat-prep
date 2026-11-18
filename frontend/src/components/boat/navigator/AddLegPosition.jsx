import { Fragment, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const NewStop = () => (
  <li className="flex items-center gap-2 rounded-md border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800" data-testid="add-leg-new-stop">
    <Plus className="h-4 w-4" /> New stop goes here
  </li>
);

// points: the stop names in order (START, each stop, end of trip). onPick(at): the new stop goes after point `at` (-1: a new START).
export const AddLegPosition = ({ open, points, onPick, onClose }) => {
  const last = points.length - 1;
  const [mode, setMode] = useState("after");
  const [j, setJ] = useState(last);
  useEffect(() => { if (open) { setMode("after"); setJ(last); } }, [open, last]);
  const name = (i) => points[i] || `Point ${i + 1}`;
  const at = mode === "before" ? j - 1 : j;
  const where = at < 0 ? `The new stop becomes the START, before ${name(0)}.` : at === last ? `The new stop goes after ${name(last)}, at the end of the trip.`
    : `The new stop goes between ${name(at)} and ${name(at + 1)}.`;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg" data-testid="add-leg-position-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold">Position the Leg To Add</DialogTitle>
          <DialogDescription>Tap a point, then pick whether the new stop goes after or before it.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={setMode} className="flex flex-wrap gap-x-6 gap-y-2" data-testid="add-leg-mode">
          {[["after", "Add after leg"], ["before", "Add before leg"]].map(([v, label]) => (
            <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
              <RadioGroupItem value={v} className="h-5 w-5 border-2 border-[var(--navy)] text-[var(--navy)]" data-testid={`add-leg-${v}-radio`} /> {label}
            </label>
          ))}
        </RadioGroup>
        <ol className="flex flex-col gap-1.5" data-testid="add-leg-points">
          {points.map((_, i) => (
            <Fragment key={i}>
              {mode === "before" && i === j && <NewStop />}
              <li>
                <button type="button" onClick={() => setJ(i)} aria-pressed={i === j}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-md border-2 px-3 py-2 text-left text-sm font-bold [transition:background-color_.15s,border-color_.15s] ${i === j ? "border-[var(--navy)] bg-[var(--panel)]" : "border-[var(--line)] bg-white"}`}
                  data-testid={`add-leg-point-${i}`}>
                  <span className={`route-pin shrink-0 ${i === 0 ? "route-pin-start" : i === last ? "route-pin-end" : ""}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 break-words">{name(i)}</span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">{i === 0 ? "Start" : i === last ? "End of trip" : ""}</span>
                </button>
              </li>
              {mode === "after" && i === j && <NewStop />}
            </Fragment>
          ))}
        </ol>
        <p className="text-sm font-semibold text-[var(--navy)]" data-testid="add-leg-where">{where}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="add-leg-position-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-[2] justify-center gap-1.5" onClick={() => onPick(at)} data-testid="add-leg-position-ok-btn"><Plus className="h-4 w-4" /> Add Leg</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
