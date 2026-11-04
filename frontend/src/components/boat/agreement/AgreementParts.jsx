import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { PinnedPhoto, pinName } from "@/components/boat/PinnedPhoto";
import { WalkStopContents } from "@/components/boat/CrewWalkthrough";

// One Zone Map Walk Through stop: tick it once seen; tap the name to see the photo and what's stowed there.
const Stop = ({ step, areas, ticked, onTick, n }) => {
  const [open, setOpen] = useState(false);
  const area = areas.find((a) => a.id === step.pin.area_id);
  return (
    <li className={`flex flex-col gap-2 px-3 py-2 ${ticked ? "bg-emerald-50" : ""}`} data-testid={`agreement-stop-${n}`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={ticked} onChange={onTick} aria-label={`Seen ${pinName(step.pin, areas)}`} className="h-5 w-5 shrink-0 accent-emerald-700" data-testid={`agreement-stop-${n}-checkbox`} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold" data-testid={`agreement-stop-${n}-toggle`}>
          <span className="min-w-0 flex-1 truncate">{n + 1}. {pinName(step.pin, areas)}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && <>
        <PinnedPhoto src={step.pic.src} alt={`Zone map showing ${pinName(step.pin, areas)}`} pins={step.pic.map.pins} areas={areas} highlight={step.pin.id}
          imgClass="max-h-[36vh] w-full rounded-md object-contain" testId={`agreement-stop-${n}-photo`} />
        <WalkStopContents area={area} areas={areas} />
      </>}
    </li>
  );
};

export const stopId = (step) => `${step.pic.key}:${step.pin.id}`;

export const AgreementWalkthrough = ({ steps, areas, ticked, onChange }) => {
  if (!steps.length) return <p className="text-sm text-[var(--muted)]" data-testid="agreement-walkthrough-empty">The skipper hasn't labelled a zone map yet, so there are no stops to tick.</p>;
  const toggle = (id) => onChange(ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id]);
  return (
    <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-md border-[1.5px] border-[var(--line)]" data-testid="agreement-walkthrough">
      {steps.map((s, n) => <Stop key={stopId(s)} step={s} n={n} areas={areas} ticked={ticked.includes(stopId(s))} onTick={() => toggle(stopId(s))} />)}
    </ul>
  );
};

export const AcceptButtons = ({ accepted, ready, busy, onAccept, onLater }) => {
  if (accepted) return <button type="button" className="btn-solid h-12 justify-center" onClick={onLater} data-testid="agreement-close-btn">Close</button>;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!!busy}
        onClick={() => (ready ? onAccept() : toast.error("Tick every stop of the Zone Map Walk Through first"))} data-testid="agreement-accept-btn">
        {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />} I have read and accept
      </button>
      <button type="button" className="btn-ghost h-11 justify-center gap-2" disabled={!!busy} onClick={onLater} data-testid="agreement-later-btn">
        {busy === "later" && <Loader2 className="h-4 w-4 animate-spin" />} Not now
      </button>
    </div>
  );
};
