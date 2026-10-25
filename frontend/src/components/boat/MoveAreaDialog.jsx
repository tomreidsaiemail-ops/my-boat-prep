import { useEffect, useState } from "react";
import { Move } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MoveRow } from "@/components/boat/MoveRow";

const toRows = (area, links) => [
  ...(area.items || []).map((i) => ({ key: i.id, kind: "item", id: i.id, name: i.name, max: i.qty || 1, qty: String(i.qty || 1), pick: true })),
  ...links.map((l) => ({ key: l.key, kind: "link", listId: l.listId, id: l.item.id, name: `${l.listName} - ${l.text}`, pick: true })),
];
const shiftTo = (list, from, to) => { const next = [...list]; next.splice(to, 0, next.splice(from, 1)[0]); return next; };

// Move some or all of one boat area's items to other areas; a changed target carries down to the rows below it.
export const MoveAreaDialog = ({ source, areas, links = [], onMove, onClose }) => {
  const [rows, setRows] = useState([]);
  const [explicit, setExplicit] = useState({});
  const [ordering, setOrdering] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { if (source) { setRows(toRows(source, links)); setExplicit({}); setOrdering(true); setError(""); } }, [source]); // eslint-disable-line react-hooks/exhaustive-deps
  const targets = areas.filter((a) => a.id !== source?.id);
  let carry = targets[0]?.id;
  const effective = rows.map((r) => (carry = explicit[r.key] && targets.some((a) => a.id === explicit[r.key]) ? explicit[r.key] : carry));
  const picked = rows.filter((r) => r.pick);
  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!picked.length) { setError("Tick at least one item to move"); return; }
    if (picked.some((r) => r.kind === "item" && (!/^\d+$/.test(r.qty) || +r.qty < 1 || +r.qty > r.max))) { setError("Each amount must be a whole number from 1 up to how many there are"); return; }
    const withTarget = rows.map((r, i) => ({ ...r, target: effective[i] }));
    onMove({
      sourceId: source.id,
      order: rows.filter((r) => r.kind === "item").map((r) => r.id),
      moves: withTarget.filter((r) => r.pick && r.kind === "item").map((r) => ({ id: r.id, qty: +r.qty, target: r.target })),
      links: withTarget.filter((r) => r.pick && r.kind === "link").map((r) => ({ listId: r.listId, itemId: r.id, target: r.target })),
    }, picked.length);
  };

  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="move-area-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold text-[var(--navy)]"><Move className="h-5 w-5" /> Move Boat Area Items</DialogTitle>
          <DialogDescription className="text-sm" data-testid="move-area-description">
            Moving from <b>{source?.name}</b>. Untick anything that should stay. Changing an item's target area also changes the items below it.
          </DialogDescription>
        </DialogHeader>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-3 self-start text-sm font-bold text-[var(--navy)]" data-testid="move-ordering-toggle">
          <Checkbox checked={ordering} onCheckedChange={(v) => setOrdering(!!v)} className="h-5 w-5" data-testid="move-ordering-checkbox" /> Show List Ordering Icons
        </label>
        <ul className="flex flex-col gap-2" data-testid="move-rows">
          {rows.map((r, n) => (
            <MoveRow key={r.key} row={r} n={n} total={rows.length} target={effective[n]} targets={targets} ordering={ordering}
              onChange={(patch) => set(r.key, patch)} onTarget={(id) => setExplicit((e) => ({ ...e, [r.key]: id }))}
              onShift={(d) => setRows((rs) => shiftTo(rs, n, n + d))} onPlace={(pos) => setRows((rs) => shiftTo(rs, n, pos - 1))} />
          ))}
        </ul>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="move-area-error">{error}</p>}
        <DialogFooter className="flex-row gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={onClose} data-testid="move-area-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1" onClick={submit} data-testid="move-area-confirm-btn">
            Move {picked.length} {picked.length === 1 ? "item" : "items"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
