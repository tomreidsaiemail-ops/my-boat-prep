import { useState } from "react";
import { ArrowLeftRight, Droplets, Flame, Fuel, Minus, Plus } from "lucide-react";
import { gasChange, num, tankChange, tankUnit } from "@/lib/telemetry";

const AMOUNT_RE = /^\d{0,4}([.,]\d{0,1})?$/;
const COUNT_RE = /^\d{0,2}$/;
const TABS = [["fuel", Fuel, "Fuel"], ["water", Droplets, "Water"], ["gas", Flame, "LPG"]];

const Tab = ({ k, Icon, label, on, onPick, prefix }) => (
  <button type="button" onClick={() => onPick(k)} aria-pressed={on} data-testid={`${prefix}tank-change-${k}`}
    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border-2 text-sm font-extrabold [transition:background-color_.15s,color_.15s] ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>
    <Icon className="h-4 w-4" /> {label}
  </button>
);

const Act = ({ id, Icon, label, solid, onClick }) => (
  <button type="button" className={`${solid ? "btn-solid" : "btn-ghost"} shrink-0 gap-1 px-3`} onClick={onClick} data-testid={id}><Icon className="h-4 w-4" /> {label}</button>
);

// Add or use fuel, water or gas bottles; every change goes straight into the Ship's Log with its estimated weight.
export const TankChange = ({ boat, engineType, levels = {}, amounts = {}, onSet, onBoatChange, onLog, prefix = "" }) => {
  const [tank, setTank] = useState("fuel");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const gas = tank === "gas";
  const u = gas ? "bottles" : tankUnit(boat);
  const pick = (k) => { setTank(k); setAmount(""); setError(""); };
  const go = (mode) => {
    const n = num(amount);
    if (!n) { setError(gas ? "Enter how many bottles." : `Enter how many ${u === "gal" ? "gallons" : "litres"}.`); return; }
    const res = gas ? gasChange(boat, n, mode, levels) : tankChange(boat, tank, n, mode === "add", levels, amounts, engineType);
    if (res.error) { setError(res.error); return; }
    if (!onLog(res.text)) { setError("Fill in your vessel name, call sign and skipper at the top first, then try again."); return; }
    setError("");
    setAmount("");
    if (res.level) onSet({ levels: { ...levels, [tank]: res.level }, ...(gas ? {} : { amounts: { ...amounts, [tank]: res.now } }) });
    if (res.extra !== undefined) onBoatChange("gas_extra", String(res.extra));
  };
  const p = `${prefix}tank-change`;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid={p}>
      <p className="field-label">Add or use fuel, water and LPG</p>
      <div className="flex gap-2">{TABS.map(([k, Icon, label]) => <Tab key={k} k={k} Icon={Icon} label={label} on={tank === k} onPick={pick} prefix={prefix} />)}</div>
      <div className="flex flex-wrap gap-2">
        <span className="relative min-w-[110px] flex-1">
          <input type="text" inputMode={gas ? "numeric" : "decimal"} value={amount} placeholder={gas ? "1" : "20"} aria-label={gas ? "Number of LPG bottles" : `Amount of ${tank}`} className="field-input w-full pr-16" data-testid={`${p}-amount`}
            onChange={(e) => { const v = e.target.value; if (gas && /[.,]/.test(v)) { setError("LPG bottles are counted whole, e.g. 1 or 2."); return; } if ((gas ? COUNT_RE : AMOUNT_RE).test(v)) setAmount(v.replace(",", ".")); }} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">{u}</span>
        </span>
        <div className={`flex gap-2 ${gas ? "w-full [&>button]:flex-1" : ""}`}>
          {gas && <Act id={`${p}-swap`} Icon={ArrowLeftRight} label="Swapped" solid onClick={() => go("swap")} />}
          <Act id={`${p}-add`} Icon={Plus} label="Added" solid={!gas} onClick={() => go("add")} />
          <Act id={`${p}-use`} Icon={Minus} label={gas ? "Removed" : "Used"} onClick={() => go(gas ? "remove" : "use")} />
        </div>
      </div>
      {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid={`${p}-error`}>{error}</p>}
      <p className="text-xs text-[var(--muted)]" data-testid={`${p}-hint`}>
        {gas ? `Swapped: empty bottles swapped for full ones${levels.gas && num(boat.gas_bottles) ? " (the LPG level above goes up)" : ""}. Added or Removed: full spare bottles brought on board or taken off (spare bottles now ${num(boat.gas_extra)}). ` : ""}
        Goes into the Ship&apos;s Log straight away with the estimated weight change{!gas && levels[tank] ? ", and the level above is updated" : ""}.
      </p>
    </div>
  );
};
