import { useEffect, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Missing cocktail ingredients, all ticked to start; ones already on Provisions are shown but can't be added twice.
export const MissingToProvisionsDialog = ({ open, missing, provisions, onConfirm, onClose }) => {
  const have = new Set(provisions.map((p) => p.toLowerCase()));
  const fresh = missing.filter((m) => !have.has(m.name.toLowerCase()));
  const [picked, setPicked] = useState([]);
  useEffect(() => { if (open) setPicked(fresh.map((m) => m.name)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (n) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="missing-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><ShoppingBasket className="h-5 w-5" /> Cocktail shopping</DialogTitle>
          <DialogDescription className="text-left">Untick anything you don&apos;t want, then add the rest to your Provisions list.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1" data-testid="missing-list">
          {missing.map((m) => {
            const already = have.has(m.name.toLowerCase());
            return (
              <li key={m.name}>
                <label className={`flex items-start gap-2 rounded-md border-[1.5px] border-[var(--line)] px-3 py-2 ${already ? "opacity-60" : ""}`} data-testid={`missing-item-${m.name}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" checked={!already && picked.includes(m.name)} disabled={already} onChange={() => toggle(m.name)} />
                  <span className="min-w-0">
                    <span className="block font-bold">{m.name}</span>
                    <span className="block text-xs text-[var(--muted)]">{already ? "Already on Provisions" : `For ${m.for.join(", ")}`}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1" onClick={onClose} data-testid="missing-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-1 disabled:opacity-40" disabled={!picked.length} onClick={() => onConfirm(picked)} data-testid="missing-confirm-btn">
            Add {picked.length || ""} to Provisions
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
