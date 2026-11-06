import { useEffect, useState } from "react";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { slug } from "@/components/boat/zone/ZoneDialog";
import { ZONE_COLOURS } from "@/lib/zoneColours";

// The ++ button asks which one zone to Batch Magic Scan, so every cupboard scanned is filed under it.
export const BatchZonePrompt = ({ open, zones, onZone, onWholeBoat, onClose }) => {
  const [pick, setPick] = useState(null);
  const [whole, setWhole] = useState(false);
  useEffect(() => { if (open) { setPick(null); setWhole(false); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)] p-4" aria-describedby={undefined} data-testid="batch-zone-prompt">
        <DialogTitle className="text-base font-extrabold text-[var(--navy)]">{whole ? "Scan the whole boat?" : "Batch Magic Scan one zone?"}</DialogTitle>
        {whole ? (
          <>
            <p className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900" data-testid="batch-zone-prompt-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              That's fine, but when you've finished you'll have to use the 4 square picker on a lot of cupboards in a lot of areas, especially on a larger boat.
            </p>
            <button type="button" className="btn-solid h-11 justify-center text-sm" onClick={onWholeBoat} data-testid="batch-zone-prompt-whole-confirm">Scan whole boat anyway</button>
            <button type="button" className="btn-ghost h-10 justify-center text-sm" onClick={() => setWhole(false)} data-testid="batch-zone-prompt-back">Back to zones</button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">Pick one area of the boat, e.g. the Galley. Every cupboard you scan goes into that zone.</p>
            <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto" role="radiogroup">
              {zones.map((z) => {
                const on = pick?.label === z.label;
                return (
                  <button key={z.label} type="button" role="radio" aria-checked={on} onClick={() => setPick(z)}
                    className={`flex min-h-11 items-center gap-3 rounded-md border-[1.5px] px-3 text-left text-sm font-bold text-[var(--navy)] [transition:background-color_.15s] hover:bg-slate-50 ${on ? "border-[var(--navy)] bg-slate-50" : "border-[var(--line)]"}`}
                    data-testid={`batch-zone-prompt-option-${slug(z.label)}`}>
                    <span className="h-5 w-5 shrink-0 rounded-[5px]" style={{ background: ZONE_COLOURS[z.colour] }} />
                    <span className="flex-1">{z.label} – {z.colour}</span>
                    {on && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn-solid h-11 justify-center gap-2 text-sm" disabled={!pick} onClick={() => onZone(pick)} data-testid="batch-zone-prompt-scan-btn">
              <Sparkles className="h-4 w-4" /> {pick ? `Batch Magic Scan ${pick.label} – ${pick.colour}` : "Pick a zone to scan"}
            </button>
            <button type="button" className="btn-ghost h-10 justify-center text-sm" onClick={() => setWhole(true)} data-testid="batch-zone-prompt-whole-btn">Scan the whole boat instead</button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
