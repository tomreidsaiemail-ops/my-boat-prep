import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PinnedPhoto, pinName } from "@/components/boat/PinnedPhoto";

// Every pin, photo by photo, in the order they were placed.
export const walkSteps = (pics) => pics.flatMap((p) => (p.map?.pins || []).map((pin) => ({ pic: p, pin })));

const Contents = ({ area }) => {
  if (!area) return <p className="text-sm text-[var(--muted)]" data-testid="walkthrough-not-listed">This spot isn't listed in Boat Inventory yet.</p>;
  const items = area.items || [];
  if (!items.length) return <p className="text-sm text-[var(--muted)]" data-testid="walkthrough-empty">Nothing listed in here yet.</p>;
  return (
    <ul className="max-h-[28vh] divide-y divide-[var(--line)] overflow-y-auto rounded-md border border-[var(--line)]" data-testid="walkthrough-items">
      {items.map((i) => (
        <li key={i.id} className={`flex justify-between gap-2 px-3 py-2 text-sm ${i.removed ? "bg-red-100" : ""}`} data-testid={`walkthrough-item-${i.id}`}>
          <span className="font-semibold">{i.name}{i.removed && <span className="text-[var(--red)]"> (removed for now)</span>}</span>
          <span className="font-mono text-[var(--muted)]">x{i.qty}</span>
        </li>
      ))}
    </ul>
  );
};

export const CrewWalkthrough = ({ steps, areas, onClose, onOpenArea }) => {
  const [n, setN] = useState(0);
  const step = steps[n];
  const area = areas.find((a) => a.id === step.pin.area_id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid="walkthrough-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight" data-testid="walkthrough-title">{pinName(step.pin, areas)}</DialogTitle>
          <DialogDescription data-testid="walkthrough-step">Stop {n + 1} of {steps.length} · here's what's stowed in this spot.</DialogDescription>
        </DialogHeader>
        <PinnedPhoto src={step.pic.src} alt={`Zone map showing ${pinName(step.pin, areas)}`} pins={step.pic.map.pins} areas={areas} highlight={step.pin.id}
          imgClass="max-h-[40vh] w-full rounded-md object-contain" testId="walkthrough-photo" />
        <Contents area={area} />
        {area && <button type="button" className="btn-ghost h-9 self-start px-3 text-xs" onClick={() => { onClose(); onOpenArea(area.id); }} data-testid="walkthrough-open-area-btn">Open in Boat Inventory</button>}
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" disabled={n === 0} onClick={() => setN(n - 1)} data-testid="walkthrough-back-btn"><ChevronLeft className="h-4 w-4" /> Back</button>
          {n < steps.length - 1
            ? <button type="button" className="btn-solid h-11 flex-1 justify-center" onClick={() => setN(n + 1)} data-testid="walkthrough-next-btn">Next <ChevronRight className="h-4 w-4" /></button>
            : <button type="button" className="btn-solid h-11 flex-1 justify-center" onClick={onClose} data-testid="walkthrough-done-btn">Done</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
