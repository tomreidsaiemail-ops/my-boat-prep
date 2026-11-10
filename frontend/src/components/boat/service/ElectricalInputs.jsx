import { BatteryStatus, batterySummary } from "@/components/boat/departure/BatteryStatus";
import { SetupPrompt } from "@/components/boat/departure/DepartureCheck";

export const ELECTRICAL_KIT = [
  ["windlass", "Windlass or capstan"], ["bow_thruster", "Bow thruster"], ["induction", "Induction stove top"], ["solar", "Solar"], ["inverter", "Inverter"],
];
const PRESETS = ["12", "24", "48"];
export const boatVoltage = (boat) => (boat.battery_voltage || "12").trim();

// What the Magic Marine Engineer should know about this boat's electrics.
export const electricalContext = (boat) => ({
  voltage: boatVoltage(boat),
  equipment: ELECTRICAL_KIT.filter(([k]) => boat.electrical?.[k]).map(([, label]) => label),
  batteries: batterySummary(boat, boat.depart?.levels || {}),
});

const Voltage = ({ value, onChange }) => {
  const other = !PRESETS.includes(value);
  return (
    <div className="flex flex-col gap-1.5" data-testid="electrical-voltage">
      <span className="field-label">Boat battery voltage</span>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Boat battery voltage">
        {PRESETS.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} data-testid={`electrical-voltage-${v}`}
            className={`h-10 rounded-md border-2 px-3 text-sm font-extrabold ${value === v ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>{v}V</button>
        ))}
        <label className="flex items-center gap-1 text-sm font-bold">
          <input value={other ? value : ""} onChange={(e) => /^\d{0,3}([.,]\d?)?$/.test(e.target.value) && onChange(e.target.value.replace(",", ".") || "12")} inputMode="decimal" placeholder="Other"
            className={`field-input h-10 w-20 px-2 text-sm ${other ? "!border-[var(--navy)]" : ""}`} aria-label="Other voltage" data-testid="electrical-voltage-other-input" />V
        </label>
      </div>
    </div>
  );
};

// Voltage, battery status and kit on board: fed into the electrical Magic Marine Engineer.
export const ElectricalInputs = ({ boat, onBoatChange }) => {
  const depart = boat.depart || {};
  const levels = depart.levels || {};
  const kit = boat.electrical || {};
  return (
    <div className="col-span-2 flex flex-col gap-3 rounded-md border-[1.5px] border-[var(--line)] bg-[var(--panel)] p-2.5" data-testid="electrical-inputs">
      <Voltage value={boatVoltage(boat)} onChange={(v) => onBoatChange("battery_voltage", v)} />
      <SetupPrompt boat={boat} onChange={onBoatChange} testId="electrical-setup-btn" />
      <BatteryStatus boat={boat} levels={levels} prefix="electrical-" onLevel={(k, v) => onBoatChange("depart", { ...depart, levels: { ...levels, [k]: v } })} lowText="Charge it, and check why it's low." />
      <div className="flex flex-col gap-1.5">
        <span className="field-label">On board</span>
        <div className="grid grid-cols-2 gap-1.5">
          {ELECTRICAL_KIT.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-md bg-white px-2 py-2 text-sm font-semibold" data-testid={`electrical-kit-${k}`}>
              <input type="checkbox" checked={!!kit[k]} onChange={(e) => onBoatChange("electrical", { ...kit, [k]: e.target.checked })} className="h-5 w-5 accent-[var(--navy)]" data-testid={`electrical-kit-${k}-checkbox`} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
