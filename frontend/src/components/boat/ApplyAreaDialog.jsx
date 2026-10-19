import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Tag several untagged checklist items with one area at once.
export const ApplyAreaDialog = ({ open, area, items, labelFor, onApply, onClose }) => {
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setPicked(items.map((i) => i.id)); setError(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = items.length > 0 && picked.length === items.length;
  const toggle = (id, on) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const submit = () => {
    if (!items.length) { onClose(); return; }
    if (!picked.length) { setError("Nothing is selected. Tick the items to put in this area."); return; }
    onApply(picked);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="apply-area-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold text-[var(--navy)]">Apply all items to {area?.name}</DialogTitle>
          <DialogDescription className="text-sm">{items.length ? "These items have no area yet. Untick any that live somewhere else." : "Every item on this list already has an area."}</DialogDescription>
        </DialogHeader>
        {items.length > 0 && (
          <div className="rounded-lg border-[1.5px] border-[var(--line)]">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b-[1.5px] border-[var(--line)] bg-slate-50 px-3 font-bold" data-testid="apply-area-all-label">
              <input type="checkbox" checked={all} onChange={(e) => setPicked(e.target.checked ? items.map((i) => i.id) : [])} className="h-5 w-5 accent-[var(--navy)]" data-testid="apply-area-all" /> Select All
            </label>
            {items.map((i) => (
              <label key={i.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 last:border-0" data-testid={`apply-area-option-${i.id}-label`}>
                <input type="checkbox" checked={picked.includes(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`apply-area-option-${i.id}`} />
                <span>{labelFor(i)}</span>
              </label>
            ))}
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="apply-area-error">{error}</p>}
        <DialogFooter className="flex-row gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={onClose} data-testid="apply-area-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1" onClick={submit} data-testid="apply-area-confirm-btn">OK</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
