import { useEffect, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CookPicker } from "@/components/boat/meals/CookPicker";
import { itemText } from "@/lib/shoppers";

// Tick several Provisions items and give them all to one shopper.
export const AssignShoppersDialog = ({ open, items, people, onApply, onClose }) => {
  const [picked, setPicked] = useState([]);
  const [who, setWho] = useState("");
  useEffect(() => { if (open) { setPicked([]); setWho(""); } }, [open]);
  const rows = (items || []).filter((i) => !i.checked && itemText(i));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="assign-shoppers-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><ShoppingBasket className="h-5 w-5" /> Assign shoppers</DialogTitle>
          <DialogDescription>Tick the items, pick who buys them and brings them on board.</DialogDescription>
        </DialogHeader>
        <CookPicker value={who} cooks={people} onChange={setWho} label="Shopper" help="Not assigned clears the shopper from the ticked items." testId="assign-shoppers-select" />
        <div className="flex gap-2 text-xs font-bold">
          <button type="button" className="underline" onClick={() => setPicked(rows.map((i) => i.id))} data-testid="assign-shoppers-all-btn">Tick all</button>
          <button type="button" className="underline" onClick={() => setPicked(rows.filter((i) => !i.shopper).map((i) => i.id))} data-testid="assign-shoppers-unassigned-btn">Tick unassigned</button>
          <button type="button" className="underline" onClick={() => setPicked([])} data-testid="assign-shoppers-none-btn">Clear</button>
        </div>
        <ul className="flex flex-col gap-1" data-testid="assign-shoppers-list">
          {rows.map((i) => (
            <li key={i.id}>
              <label className="flex items-start gap-2 rounded-md border-[1.5px] border-[var(--line)] px-2 py-1.5 text-sm">
                <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`assign-shoppers-check-${i.id}`} />
                <span className="flex-1 [overflow-wrap:anywhere]">{itemText(i)}</span>
                {i.shopper && <span className="shrink-0 text-xs font-bold text-amber-800">{i.shopper}</span>}
              </label>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-solid h-12 justify-center" disabled={!picked.length} onClick={() => onApply(picked, who)} data-testid="assign-shoppers-apply-btn">
          {who ? `Give ${picked.length} to ${who}` : `Clear shopper on ${picked.length}`}
        </button>
      </DialogContent>
    </Dialog>
  );
};
