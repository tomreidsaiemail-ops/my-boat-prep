import { Scale } from "lucide-react";
import { useWeights } from "@/components/boat/weights/WeightsContext";
import { fmtKg } from "@/lib/weights";

const NUM_RE = /^\d{0,6}([.,]\d{0,2})?$/;

const Row = ({ label, value, testId, bold, muted }) => (
  <div className={`flex items-baseline justify-between gap-2 text-sm ${bold ? "font-extrabold" : ""}`} data-testid={testId}>
    <span className={muted ? "text-[var(--muted)]" : ""}>{label}</span><span className="text-right font-mono">{value}</span>
  </div>
);

const WeightInput = ({ id, label, value, unit, placeholder, onChange }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
    <span className="field-label">{label}</span>
    <span className="relative">
      <input id={id} type="text" inputMode="decimal" value={value || ""} placeholder={placeholder} data-testid={`${id}-input`} className="field-input w-full pr-10"
        onChange={(e) => NUM_RE.test(e.target.value) && onChange(e.target.value.replace(",", "."))} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">{unit}</span>
    </span>
  </label>
);

// Boat details - Additional details: baseline weight, on-deck gear total, crew weight and the All-Up Racing Displacement.
export const WeightPanel = ({ boat, onChange }) => {
  const w = useWeights();
  if (!w) return null;
  const u = w.unit;
  return (
    <section className="col-span-2 flex flex-col gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-slate-50 p-3" data-testid="weight-panel">
      <h3 className="flex items-center gap-2 text-sm font-extrabold"><Scale className="h-4 w-4" /> Racing weight</h3>
      <div className="grid grid-cols-2 items-end gap-2.5">
        <WeightInput id="boat-weight" label="Weight" value={boat.boat_weight} unit={u} placeholder="Boat only" onChange={(v) => onChange("boat_weight", v)} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="field-label">Totalled on deck weight</span>
          <output className="field-input flex items-center bg-white font-mono font-bold" aria-readonly="true" data-testid="on-deck-weight">{fmtKg(w.gearKg, u)}</output>
        </div>
        <WeightInput id="crew-weight" label="Average crew weight" value={boat.crew_weight} unit={u} placeholder={String(w.avg)} onChange={(v) => onChange("crew_weight", v)} />
        <div className="flex min-w-0 flex-col justify-end gap-1 pb-2 text-sm" data-testid="crew-weight-total">
          <span>{w.known ? `${w.known} registered crew ${fmtKg(w.knownKg, u)}${w.pob > w.known ? ` + ${w.pob - w.known} x ${w.avg} ${u}${w.avgDefault ? " (typical)" : ""}` : ""}` : `${w.pob} on board x ${w.avg} ${u}${w.avgDefault ? " (typical)" : ""}`}</span>
          <b className="font-mono">{fmtKg(w.crewKg, u)}</b>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-white p-2.5" data-testid="gear-weights">
        <p className="field-label">On deck gear (Boat Maintenance lists)</p>
        {w.gear.map((g) => <Row key={g.key} label={g.name} value={g.has ? fmtKg(g.kg, u) : "no list yet"} muted={!g.has} testId={`gear-weight-${g.key}`} />)}
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-white p-2.5" data-testid="displacement-breakdown">
        <p className="field-label">All-Up Racing Displacement</p>
        <Row label="Boat" value={fmtKg(w.boatKg, u)} testId="disp-boat" />
        <Row label={`Fluids (fuel, water, LPG)${w.fluids.fromLevels ? "" : " - full tanks"}`} value={fmtKg(w.fluidKg, u)} testId="disp-fluids" />
        <Row label="Provisions (scanned food and drink)" value={fmtKg(w.provKg, u)} testId="disp-provisions" />
        <Row label="On deck gear" value={fmtKg(w.gearKg, u)} testId="disp-gear" />
        <Row label="Crew" value={fmtKg(w.crewKg, u)} testId="disp-crew" />
        <div className="mt-1 border-t-2 border-[var(--navy)] pt-1.5"><Row bold label="All-Up Racing Displacement" value={fmtKg(w.totalKg, u)} testId="disp-total" /></div>
      </div>
      <p className="text-xs text-[var(--muted)]">Fluids use your latest Leaving the Dock levels (tanks without a level count as full). Gear weights include the Magic Mariner&apos;s estimates until you change them.</p>
    </section>
  );
};

// Footer under each Boat Maintenance list: this list's weight and the live displacement.
export const ListWeightFooter = ({ listKey }) => {
  const w = useWeights();
  const g = w?.gear.find((x) => x.key === listKey);
  if (!g) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="maint-weight-footer">
      <Row bold label={`${g.name} weight total`} value={fmtKg(g.kg, w.unit)} testId="maint-weight-total" />
      <Row label="Totalled on deck weight (all six)" value={fmtKg(w.gearKg, w.unit)} testId="maint-weight-on-deck" muted />
      <Row label="All-Up Racing Displacement" value={fmtKg(w.totalKg, w.unit)} testId="maint-weight-displacement" muted />
    </div>
  );
};
