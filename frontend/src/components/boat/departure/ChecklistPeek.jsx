import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { arrivalTicks } from "@/lib/tripFold";

const nested = (i) => i.indent || (i.level || 0) > 1;

// Prepare to... from the trip plan: that arrival's checklist in a window, ticks save to the list; the trip plan stays open behind it.
export const ChecklistPeek = ({ peek, list = [], onToggle, onClose }) => {
  const ids = peek && peek.kind !== "dock" ? arrivalTicks(list, peek.kind) : null;
  const shown = ids ? list.filter((i) => ids.has(i.id)) : list;
  const done = shown.filter((i) => i.checked).length;
  return (
    <Dialog open={!!peek} onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-emerald-700" data-testid="checklist-peek-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-black text-[var(--navy)]" data-testid="checklist-peek-title">{peek?.prep}</DialogTitle>
          <DialogDescription data-testid="checklist-peek-summary">{peek?.name} · {done} of {shown.length} ticked</DialogDescription>
        </DialogHeader>
        {shown.length ? (
          <ul className="flex flex-col rounded-md border border-[var(--line)]">
            {shown.map((i) => (
              <li key={i.id} className={`border-t border-[var(--line)] first:border-t-0 ${i.checked ? "bg-emerald-50" : ""}`}>
                <button type="button" role="checkbox" aria-checked={!!i.checked} onClick={() => onToggle(i.id)}
                  className={`flex min-h-[52px] w-full items-center gap-3 py-2 pr-3 text-left ${nested(i) ? "pl-9" : "pl-3"}`} data-testid={`checklist-peek-item-${i.id}`}>
                  <span className="tick-box shrink-0">{i.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
                  <span className={`item-text flex-1 ${nested(i) ? "" : "font-bold"}`}>{i.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[var(--muted)]" data-testid="checklist-peek-empty">Nothing on this list yet.</p>}
        <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="checklist-peek-done-btn">Back to the trip plan</button>
      </DialogContent>
    </Dialog>
  );
};
