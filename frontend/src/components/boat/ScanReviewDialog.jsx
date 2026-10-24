import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

let seq = 0;
const row = (name = "", qty = 1) => ({ key: `r${(seq += 1)}`, name, qty: String(qty), keep: true });

// Review what the AI spotted before it replaces the cupboard's contents.
export const ScanReviewDialog = ({ scan, onSave, onClose }) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { if (scan) { setRows(scan.items.map((i) => row(i.name, i.qty))); setError(""); } }, [scan]);
  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const save = () => {
    const kept = rows.filter((r) => r.keep && r.name.trim());
    if (kept.some((r) => !/^\d+$/.test(r.qty) || +r.qty < 1 || +r.qty > 9999)) { setError("Quantities must be whole numbers from 1 to 9999"); return; }
    const names = kept.map((r) => r.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { setError("Two lines have the same name. Merge them or rename one."); return; }
    onSave(kept.map((r) => ({ name: r.name.trim().slice(0, 80), qty: +r.qty })));
  };
  const existing = scan?.area.items?.length || 0;
  return (
    <Dialog open={!!scan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="scan-review-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold text-[var(--navy)]"><Sparkles className="h-5 w-5" /> Magic Scan Discoveries</DialogTitle>
          <DialogDescription className="text-sm">
            {scan?.items.length ? `Magic Scan discovered ${scan.items.length} ${scan.items.length === 1 ? "item" : "items"} in ${scan?.area.name}. Fix names or quantities, untick anything wrong, or add what it missed.` : `Magic Scan couldn't spot any items in ${scan?.area.name}. You can add them below.`}
            {existing > 0 && <b className="mt-1 block text-[var(--red)]" data-testid="scan-replace-warning">Saving replaces the {existing} {existing === 1 ? "item" : "items"} listed in this cupboard now.</b>}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2" data-testid="scan-rows">
          {rows.map((r, n) => (
            <li key={r.key} className={`flex items-center gap-2 ${r.keep ? "" : "opacity-50"}`} data-testid={`scan-row-${n}`}>
              <input type="checkbox" checked={r.keep} onChange={(e) => set(r.key, { keep: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--navy)]" aria-label={`Keep ${r.name}`} data-testid={`scan-row-keep-${n}`} />
              <input value={r.name} maxLength={80} onChange={(e) => set(r.key, { name: e.target.value })} className="field-input h-11 !w-0 min-w-0 flex-1" aria-label="Item name" data-testid={`scan-row-name-${n}`} />
              <input value={r.qty} inputMode="numeric" onChange={(e) => set(r.key, { qty: e.target.value.replace(/\D/g, "") })} className="field-input h-11 !w-16 shrink-0" aria-label="Quantity" data-testid={`scan-row-qty-${n}`} />
              <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Remove line" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} data-testid={`scan-row-remove-${n}`}><Trash2 className="h-[18px] w-[18px]" /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => setRows((rs) => [...rs, row()])} data-testid="scan-add-row-btn"><Plus className="h-4 w-4" /> Add a line</button>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="scan-review-error">{error}</p>}
        <DialogFooter className="flex-row gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={onClose} data-testid="scan-review-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1" onClick={save} data-testid="scan-review-save-btn">Save contents</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
