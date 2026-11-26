import { useEffect, useState } from "react";
import { Check, ChevronDown, Sparkles, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { slug } from "@/components/boat/zone/ZoneDialog";
import { firstBatchWalk, HOW_LINES, isGalley, PLAN_LINES, WalkButton, WalkList, WalkOptIn, WalkSection } from "@/components/boat/zone/BatchWalk";
import { ZONE_COLOURS } from "@/lib/zoneColours";

// No Galley yet: offered anyway, and made with its usual cupboards when picked.
const GALLEY = { label: "Galley", colour: "Orange", fresh: true };
// Main (always open) first, then Cabins, Heads and Engines, folded; the Zone Map's Add cabin / head / engine groups (plurals too, e.g. "Heads Aft").
const FOLDED = [
  { key: "cabin", title: "Cabins", test: (z) => /\bcabins?\b/i.test(z.label) && !/cabin top/i.test(z.label) },
  { key: "head", title: "Heads", test: (z) => /\bheads?\b/i.test(z.label) },
  { key: "engine", title: "Engines", test: (z) => /\bengines?\b/i.test(z.label) },
];
const isMain = (z) => !FOLDED.some((g) => g.test(z));

const ZoneOption = ({ z, on, glow, count, onPick }) => (
  <button type="button" role="radio" aria-checked={on} onClick={() => onPick(z)}
    className={`flex min-h-11 items-center gap-3 rounded-md border-[1.5px] px-3 text-left text-sm font-bold text-[var(--navy)] [transition:background-color_.15s] hover:bg-slate-50 ${glow ? "mbp-glow" : ""} ${on ? "border-[var(--navy)] bg-slate-50" : "border-[var(--line)]"}`}
    data-testid={`batch-zone-prompt-option-${slug(z.label)}`}>
    <span className="h-5 w-5 shrink-0 rounded-[5px]" style={{ background: ZONE_COLOURS[z.colour] }} />
    <span className="flex-1">{z.label} – {z.colour}
      {count ? <span className="font-semibold text-[var(--muted)]"> · {count} cupboards</span> : ""}
      {z.fresh ? <span className="font-semibold text-[var(--muted)]"> · added with its usual cupboards</span> : ""}
    </span>
    {on && <Check className="h-4 w-4" />}
  </button>
);

const FoldGroup = ({ g, zones, open, onToggle, children }) => (
  <div className="flex flex-col gap-1.5" data-testid={`batch-zone-group-${g.key}`}>
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-10 items-center gap-2 rounded-md border-[1.5px] border-[var(--line)] bg-[var(--panel)] px-3 text-left text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`batch-zone-group-${g.key}-toggle`}>
      <span className="flex-1">{g.title} <span className="font-semibold normal-case text-[var(--muted)]">· {zones.length}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
    </button>
    {open && children}
  </div>
);

// The yellow walkthrough: "How to..." then "Have a plan...", each folded by its Continue...
const ZoneWalk = ({ step, shut, onShut, onNext }) => (
  <>
    <WalkSection title="How to Batch Magic Scan cupboard by cupboard" open={!shut.how} onToggle={() => onShut("how")} testId="batch-walk-how">
      <WalkList lines={HOW_LINES} />
      {step === "how" && <WalkButton onClick={() => onNext("plan")} testId="batch-walk-how-continue" />}
    </WalkSection>
    {step !== "how" && (
      <WalkSection title="Have a plan to get started with Batch Magic Scan" open={!shut.plan} onToggle={() => onShut("plan")} testId="batch-walk-plan">
        <WalkList lines={PLAN_LINES} />
        {step === "plan" && <WalkButton onClick={() => onNext("go")} testId="batch-walk-plan-continue" />}
      </WalkSection>
    )}
  </>
);

// Batch Magic Scan starts here: pick one zone, e.g. the Galley, so every cupboard scanned is filed under it.
// onZone(zone, walk): walk = carry the walkthrough on into the Galley's scan.
export const BatchZonePrompt = ({ open, zones, counts = {}, onZone, onWholeBoat, onClose }) => {
  const [pick, setPick] = useState(null);
  const [whole, setWhole] = useState(false);
  const [first, setFirst] = useState(false);
  const [walk, setWalk] = useState(false);
  const [step, setStep] = useState("how");
  const [shut, setShut] = useState({});
  const [folds, setFolds] = useState({});
  const restart = (on) => { setWalk(on); setStep("how"); setShut({}); };
  useEffect(() => {
    if (!open) return;
    const f = firstBatchWalk();
    setFirst(f); restart(f); setPick(null); setWhole(false); setFolds({});
  }, [open]);
  const list = zones.some(isGalley) ? zones : [GALLEY, ...zones];
  const go = walk && step === "go";
  const option = (z) => <ZoneOption key={z.label} z={z} on={pick?.label === z.label} glow={go && isGalley(z)} count={counts[z.colour]} onPick={setPick} />;
  const next = (s) => { setShut((x) => ({ ...x, [step]: true })); setStep(s); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" aria-describedby={undefined} data-testid="batch-zone-prompt">
        <DialogTitle className="font-display text-xl font-extrabold uppercase text-[var(--navy)]">{whole ? "Scan the whole boat?" : "Add Cupboards By ZONE"}</DialogTitle>
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
            {!first && <WalkOptIn on={walk} onChange={restart} />}
            {walk && <ZoneWalk step={step} shut={shut} onShut={(k) => setShut((x) => ({ ...x, [k]: !x[k] }))} onNext={next} />}
            <p className="text-sm text-[var(--muted)]">Pick one area of the boat, e.g. the Galley. Every cupboard you scan goes into that zone.</p>
            <div className="flex flex-col gap-2" role="radiogroup">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid="batch-zone-group-main">Main Zones</p>
              {list.filter(isMain).map(option)}
              {FOLDED.map((g) => {
                const zs = list.filter((z) => g.test(z) && !FOLDED.slice(0, FOLDED.indexOf(g)).some((x) => x.test(z)));
                return zs.length > 0 && (
                  <FoldGroup key={g.key} g={g} zones={zs} open={!!folds[g.key]} onToggle={() => setFolds((f) => ({ ...f, [g.key]: !f[g.key] }))}>{zs.map(option)}</FoldGroup>
                );
              })}
            </div>
            <button type="button" className={`btn-solid h-11 justify-center gap-2 text-sm ${go ? "mbp-glow" : ""}`} disabled={!pick} onClick={() => onZone(pick, walk && isGalley(pick))} data-testid="batch-zone-prompt-scan-btn">
              <Sparkles className="h-4 w-4" /> {pick ? `Batch Magic Scan ${pick.label} – ${pick.colour}` : "Pick a zone to scan"}
            </button>
            <button type="button" className="btn-ghost h-10 justify-center text-sm" onClick={() => setWhole(true)} data-testid="batch-zone-prompt-whole-btn">Scan the whole boat instead</button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
