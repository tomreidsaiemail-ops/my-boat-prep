import { Flag, RotateCcw } from "lucide-react";
import { SetupPrompt } from "@/components/boat/departure/DepartureCheck";
import { TankLevels, allLevelsPicked } from "@/components/boat/departure/TankLevels";
import { LogCopy, stamp } from "@/components/boat/departure/LogCopy";
import { arrivalSummary, arrivalUsage, num, usedText } from "@/lib/telemetry";

const r = (n) => Math.round(n * 10) / 10;
const left = (n, u) => (n ? `about ${r(n)} ${u} left` : "");

const Count = ({ id, label, value, max, onChange }) => (
  <label className="flex min-w-0 flex-col gap-1"><span className="field-label">{label}</span>
    <input type="number" inputMode="numeric" min={0} max={max} value={value ?? max} onChange={(e) => onChange(e.target.value === "" ? "" : String(Math.max(0, Math.min(max, Math.floor(Number(e.target.value)) || 0))))}
      className="field-input !h-10 px-2 text-sm" data-testid={`${id}-input`} />
  </label>
);

const Used = ({ label, value, testId }) => (
  <div className="flex justify-between gap-2 text-sm" data-testid={testId}><span className="text-[var(--muted)]">{label}</span><b className="text-right">{value}</b></div>
);

// Matches the Leaving the Dock check: levels on arrival, then fuel, water and gas used since the last departure.
export const ArrivalCheck = ({ boat, listName, onBoatChange, onLog, onUnlog, onRelog }) => {
  const depart = boat.depart || {};
  const arrive = boat.arrive || {};
  const setArrive = (patch) => onBoatChange("arrive", { ...arrive, ...patch });
  const levels = arrive.levels || {};
  const use = arrivalUsage(boat, depart, arrive);
  const u = use.unit;
  const summary = (when) => arrivalSummary(boat, depart, arrive, use, when, listName);
  const sig = summary("");
  const blocked = allLevelsPicked(boat, levels) ? "" : "Pick a level for every tank and battery first.";
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="arrival-check">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><Flag className="h-4 w-4" /> Arrival status check</h3>
        <button type="button" className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" onClick={() => onBoatChange("arrive", {})} data-testid="arrival-reset-btn"><RotateCcw className="h-3.5 w-3.5" /> New arrival</button>
      </div>
      {!depart.levels && <p className="rounded-md bg-sky-50 px-2 py-1.5 text-sm text-sky-900" data-testid="arrival-no-departure">No Leaving the Dock check recorded, so only the arrival levels can be logged.</p>}
      <SetupPrompt boat={boat} onChange={onBoatChange} testId="arrival-setup-btn" />
      <TankLevels boat={boat} prefix="arrive-" levels={levels} onLevel={(k, v) => setArrive({ levels: { ...levels, [k]: v } })}
        details={{ fuel: left(use.fuelNow, u), gas: left(use.gasNow, "kg"), water: left(use.waterNow, u) }} />
      {(num(boat.fuel_jerry) > 0 || num(boat.water_jerry) > 0 || num(boat.gas_extra) > 0) && (
        <div className="grid grid-cols-3 gap-2" data-testid="arrival-spares">
          {num(boat.fuel_jerry) > 0 && <Count id="arrival-fuel-jerry" label="Fuel cans still full" value={arrive.fuel_jerry_left} max={num(boat.fuel_jerry)} onChange={(v) => setArrive({ fuel_jerry_left: v })} />}
          {num(boat.water_jerry) > 0 && <Count id="arrival-water-jerry" label="Water cans still full" value={arrive.water_jerry_left} max={num(boat.water_jerry)} onChange={(v) => setArrive({ water_jerry_left: v })} />}
          {num(boat.gas_extra) > 0 && <Count id="arrival-gas-extra" label="Spare gas still full" value={arrive.gas_extra_left} max={num(boat.gas_extra)} onChange={(v) => setArrive({ gas_extra_left: v })} />}
        </div>
      )}
      {depart.levels && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--panel)] p-3" data-testid="arrival-used">
          <p className="field-label">Used on the passage</p>
          <Used label="Fuel" value={`${usedText(use.fuelUsed, u)}${use.plan.fuelNeed ? ` (planned about ${r(use.plan.fuelNeed)} ${u})` : ""}`} testId="arrival-fuel-used" />
          <Used label="Water" value={usedText(use.waterUsed, u)} testId="arrival-water-used" />
          <Used label="Gas" value={usedText(use.gasUsed, "kg")} testId="arrival-gas-used" />
          {use.actualRate > 0 && <Used label="Actual fuel use" value={`about ${r(use.actualRate)} ${u}/h (planned ${r(use.plan.rate)} ${u}/h)`} testId="arrival-actual-rate" />}
        </div>
      )}
      <LogCopy prefix="arrival" label="Copy this arrival's levels and what was used into the Ship's Log" logged={!!arrive.log_id} blocked={blocked}
        outdated={!!arrive.log_id && arrive.log_sig !== sig}
        onToggle={(on) => (on ? setArrive({ log_id: onLog(summary(stamp()), "Arrival"), log_sig: sig }) : (onUnlog(arrive.log_id), setArrive({ log_id: null, log_sig: "" })))}
        onRelog={() => { onRelog(arrive.log_id, summary(stamp())); setArrive({ log_sig: sig }); }} />
    </section>
  );
};
