import { useState } from "react";
import { Footprints, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { allStops } from "@/components/boat/CrewWalkthrough";
import { StopList, keyOf, walkPics } from "@/components/boat/crew/WalkStopsPicker";

const sameList = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// "Nav station (1) Galley (2)": the ticked stops counted per zone map photo.
const summary = (steps, skip) => {
  const counts = new Map();
  steps.filter((s) => !skip.includes(keyOf(s))).forEach((s) => {
    const n = s.groupName || "Zone map";
    counts.set(n, (counts.get(n) || 0) + 1);
  });
  return [...counts].map(([n, c]) => `${n} (${c})`).join(" ");
};

// Invite crew: this crew member's own walkthrough stops (a chef and a mechanic need different ones). Null = the boat's default.
export const CrewWalkStops = ({ boat, areas = [], skip, onChange }) => {
  const [draft, setDraft] = useState(null);
  const steps = boat ? allStops(walkPics(boat), areas, boat) : [];
  if (!steps.length) return null;
  const def = boat.walk_skip || [];
  const cur = skip || def;
  const on = steps.filter((s) => !cur.includes(keyOf(s))).length;
  const flip = (k) => setDraft((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const done = () => { onChange(sameList(draft, def) ? null : draft); setDraft(null); };
  const draftOn = draft ? steps.filter((s) => !draft.includes(keyOf(s))).length : 0;
  return (
    <div className="flex flex-col gap-1" data-testid="crew-walk-stops">
      <button type="button" className="btn-ghost h-11 justify-center gap-2 text-sm" onClick={() => setDraft(cur)} data-testid="crew-walk-stops-btn">
        <Footprints className="h-4 w-4" /> Walkthrough stops for this crew member
      </button>
      <p className="text-xs text-[var(--muted)]" data-testid="crew-walk-stops-summary">
        <b className="text-[var(--navy)]">{skip ? `Own stops, ${on} of ${steps.length}:` : `Default, ${on} of ${steps.length}:`}</b> {summary(steps, cur) || "none"}
      </p>
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto" data-testid="crew-walk-stops-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Walkthrough stops for this crew member</DialogTitle>
            <DialogDescription>Tick the stops they walk through when they accept the Boat Terms, and tap Contents to show them what&apos;s stowed there. It starts from your default stops and contents.</DialogDescription>
          </DialogHeader>
          {draft && <div className="flex flex-col gap-2"><StopList steps={steps} areas={areas} skip={draft} onFlip={flip} /></div>}
          {draft && !sameList(draft, def) && (
            <button type="button" className="flex items-center gap-1 self-start text-xs font-bold text-[var(--navy)] underline underline-offset-2" onClick={() => setDraft(def)} data-testid="crew-walk-stops-default-btn">
              <RotateCcw className="h-3.5 w-3.5" /> Back to the default stops
            </button>
          )}
          <button type="button" className="btn-solid h-12 justify-center" disabled={!draftOn} onClick={done} data-testid="crew-walk-stops-done-btn">
            {draftOn ? `Done (${draftOn} ${draftOn === 1 ? "stop" : "stops"})` : "Keep at least one stop"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
