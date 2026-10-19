import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const SuggestAreasDialog = ({ open, names, onConfirm, onClose }) => {
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setPicked([]); setError(""); } }, [open]);
  const toggle = (n, on) => { setError(""); setPicked((p) => (on ? [...p, n] : p.filter((x) => x !== n))); };
  const all = names.length > 0 && picked.length === names.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="inventory-suggest-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Suggested Cupboards</DialogTitle>
          <DialogDescription>Tick the ones your boat has. You can rename them or add your own afterwards.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)]">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b-[1.5px] border-[var(--line)] bg-slate-50 px-3 font-bold" data-testid="inventory-suggest-all-label">
            <input type="checkbox" checked={all} onChange={(e) => setPicked(e.target.checked ? [...names] : [])} className="h-5 w-5 accent-[var(--navy)]" data-testid="inventory-suggest-all" />
            Select All
          </label>
          {names.map((n, i) => (
            <label key={n} className="flex min-h-[44px] cursor-pointer items-center gap-3 border-t border-[var(--line)] px-3 font-medium first-of-type:border-t-0" data-testid={`inventory-suggest-option-${i}-label`}>
              <input type="checkbox" checked={picked.includes(n)} onChange={(e) => toggle(n, e.target.checked)} className="h-5 w-5 accent-[var(--navy)]" data-testid={`inventory-suggest-option-${i}`} />
              {n}
            </label>
          ))}
        </div>
        {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid="inventory-suggest-error">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className="btn-ghost h-12 px-5" onClick={onClose} data-testid="inventory-suggest-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 px-5" data-testid="inventory-suggest-confirm-btn"
            onClick={() => (picked.length ? onConfirm(names.filter((n) => picked.includes(n))) : setError("Nothing is selected. Tick the cupboards your boat has."))}>Add</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
