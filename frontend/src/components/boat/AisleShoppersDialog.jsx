import { useEffect, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CookPicker } from "@/components/boat/meals/CookPicker";
import { shopGroups } from "@/lib/shoppers";

const giveLabel = (names, who) => {
  const what = names.length <= 3 ? names.join(", ") : `${names.length} aisles`;
  return who ? `Give ${what} to ${who}` : `Clear shopper on ${what}`;
};

// Tick Trip Shopping List aisles and give them all to one shopper, e.g. Tom gets Bakery and Fresh produce.
export const AisleShoppersDialog = ({ open, rows, people, onApply, onClose }) => {
  const [picked, setPicked] = useState([]);
  const [who, setWho] = useState("");
  useEffect(() => { if (open) { setPicked([]); setWho(""); } }, [open]);
  const groups = shopGroups(rows).filter((g) => g.rows.length);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const names = groups.filter((g) => picked.includes(g.id)).map((g) => g.aisle);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="assign-shoppers-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><ShoppingBasket className="h-5 w-5" /> Assign shoppers</DialogTitle>
          <DialogDescription>Tick the Trip Shopping List aisles, then pick who buys everything in them and brings it on board.</DialogDescription>
        </DialogHeader>
        <CookPicker value={who} cooks={people} onChange={setWho} label="Shopper" help="Not assigned clears the shopper from the ticked aisles." testId="assign-shoppers-select" />
        <div className="flex gap-2 text-xs font-bold">
          <button type="button" className="underline" onClick={() => setPicked(groups.map((g) => g.id))} data-testid="assign-shoppers-all-btn">Tick all</button>
          <button type="button" className="underline" onClick={() => setPicked(groups.filter((g) => !g.shopper).map((g) => g.id))} data-testid="assign-shoppers-unassigned-btn">Tick unassigned</button>
          <button type="button" className="underline" onClick={() => setPicked([])} data-testid="assign-shoppers-none-btn">Clear</button>
        </div>
        <ul className="flex flex-col gap-1" data-testid="assign-shoppers-list">
          {groups.map((g) => {
            const left = g.rows.filter((r) => !r.checked).length;
            return (
              <li key={g.id}>
                <label className="flex items-start gap-2 rounded-md border-[1.5px] border-[var(--line)] px-2 py-1.5 text-sm">
                  <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`assign-shoppers-check-${g.id}`} />
                  <span className="flex-1 [overflow-wrap:anywhere]">
                    <span className="block font-bold">{g.aisle}</span>
                    <span className="block text-xs text-[var(--muted)]">{left} to buy{left !== g.rows.length ? ` of ${g.rows.length}` : ""}</span>
                  </span>
                  {g.shopper && <span className="shrink-0 text-xs font-bold text-amber-800" data-testid={`assign-shoppers-who-${g.id}`}>{g.shopper}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn-solid h-12 justify-center" disabled={!picked.length} onClick={() => onApply(picked, who, names)} data-testid="assign-shoppers-apply-btn">
          {picked.length ? giveLabel(names, who) : "Tick the aisles to give out"}
        </button>
      </DialogContent>
    </Dialog>
  );
};
