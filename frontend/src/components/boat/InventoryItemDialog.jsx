import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const InventoryItemDialog = ({ open, item, onConfirm, onClose }) => {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setName(item?.name || ""); setQty(String(item?.qty ?? 1)); setError(""); } }, [open, item]);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(qty);
    if (!name.trim()) { setError("Please enter the item name"); return; }
    if (!Number.isInteger(n) || n < 1 || n > 9999) { setError("Quantity must be a whole number from 1 to 9999"); return; }
    setBusy(true);
    const res = await onConfirm({ name: name.trim(), qty: n });
    setBusy(false);
    if (typeof res === "string") setError(res);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="inventory-item-dialog" aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Edit Item</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1"><span className="field-label">Item</span>
            <input autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className="field-input" data-testid="inventory-item-name-input" /></label>
          <label className="flex flex-col gap-1"><span className="field-label">Quantity</span>
            <input type="number" inputMode="numeric" min={1} max={9999} value={qty} onChange={(e) => setQty(e.target.value)} className="field-input !w-32" data-testid="inventory-item-qty-input" /></label>
          {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid="inventory-item-error">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="btn-ghost h-12 px-5" onClick={onClose} data-testid="inventory-item-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid h-12 px-5" disabled={busy} data-testid="inventory-item-confirm-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
