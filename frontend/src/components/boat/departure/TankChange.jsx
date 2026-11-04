import { useState } from "react";
import { Droplets, Fuel, Minus, Plus } from "lucide-react";
import { num, tankChange, tankUnit } from "@/lib/telemetry";

const AMOUNT_RE = /^\d{0,4}([.,]\d{0,1})?$/;

const Tab = ({ k, Icon, label, on, onPick, prefix }) => (
  <button type="button" onClick={() => onPick(k)} aria-pressed={on} data-testid={`${prefix}tank-change-${k}`}
    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border-2 text-sm font-extrabold [transition:background-color_.15s,color_.15s] ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>
    <Icon className="h-4 w-4" /> {label}
  </button>
);

// Add or use fuel or water; every change goes straight into the Ship's Log with its estimated weight.
export const TankChange = ({ boat, engineType, levels = {}, amounts = {}, onSet, onLog, prefix = "" }) => {
  const [tank, setTank] = useState("fuel");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const u = tankUnit(boat);
  const pick = (k) => { setTank(k); setError(""); };
  const go = (added) => {
    const n = num(amount);
    if (!n) { setError(`Enter how many ${u === "gal" ? "gallons" : "litres"}.`); return; }
    const res = tankChange(boat, tank, n, added, levels, amounts, engineType);
    if (res.error) { setError(res.error); return; }
    setError("");
    if (!onLog(res.text)) return;
    setAmount("");
    if (res.level) onSet({ levels: { ...levels, [tank]: res.level }, amounts: { ...amounts, [tank]: res.now } });
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid={`${prefix}tank-change`}>
      <p className="field-label">Add or use fuel and water</p>
      <div className="flex gap-2">
        <Tab k="fuel" Icon={Fuel} label="Fuel" on={tank === "fuel"} onPick={pick} prefix={prefix} />
        <Tab k="water" Icon={Droplets} label="Water" on={tank === "water"} onPick={pick} prefix={prefix} />
      </div>
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <input type="text" inputMode="decimal" value={amount} placeholder="20" aria-label={`Amount of ${tank}`} className="field-input w-full pr-10" data-testid={`${prefix}tank-change-amount`}
            onChange={(e) => AMOUNT_RE.test(e.target.value) && setAmount(e.target.value.replace(",", "."))} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">{u}</span>
        </span>
        <button type="button" className="btn-solid shrink-0 gap-1 px-3" onClick={() => go(true)} data-testid={`${prefix}tank-change-add`}><Plus className="h-4 w-4" /> Added</button>
        <button type="button" className="btn-ghost shrink-0 gap-1 px-3" onClick={() => go(false)} data-testid={`${prefix}tank-change-use`}><Minus className="h-4 w-4" /> Used</button>
      </div>
      {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid={`${prefix}tank-change-error`}>{error}</p>}
      <p className="text-xs text-[var(--muted)]">Goes into the Ship&apos;s Log straight away with the estimated weight change{levels[tank] ? ", and the level above is updated" : ""}.</p>
    </div>
  );
};
