import { DetailsSection } from "@/components/boat/telemetry/DetailsSection";
import { NumField } from "@/components/boat/telemetry/NumField";
import { BatteriesEditor } from "@/components/boat/telemetry/BatteriesEditor";
import { batteriesOf, num, tankUnit, telemetryConfigured } from "@/lib/telemetry";

const Group = ({ title, children, testId }) => (
  <div className="col-span-2 grid grid-cols-3 items-end gap-2" data-testid={testId}>
    <span className="col-span-3 text-sm font-extrabold">{title}</span>
    {children}
  </div>
);

const UnitPick = ({ value, onChange }) => (
  <div className="col-span-2 flex items-center justify-between gap-2" role="radiogroup" aria-label="Tank units">
    <span className="field-label">Tanks in</span>
    <div className="flex overflow-hidden rounded-md border-[1.5px] border-[var(--line)]">
      {[["L", "Litres"], ["gal", "Gallons"]].map(([u, text]) => (
        <button key={u} type="button" role="radio" aria-checked={value === u} onClick={() => onChange(u)} data-testid={`tank-units-${u}`}
          className={`h-9 px-3 text-sm font-bold [transition:background-color_.15s] ${value === u ? "bg-[var(--navy)] text-white" : "bg-white"}`}>{text}</button>
      ))}
    </div>
  </div>
);

const summaryOf = (boat, u) => [num(boat.fuel_tank) && `Fuel ${num(boat.fuel_tank)} ${u}`, num(boat.water_tank) && `Water ${num(boat.water_tank)} ${u}`,
  num(boat.gas_bottles) && `Gas ${num(boat.gas_bottles)} x ${num(boat.gas_kg)} kg`, `${batteriesOf(boat).length} batteries`].filter(Boolean).join(" · ");

// Stays open until the tanks and every battery are set up.
export const TelemetrySection = ({ boat, onChange }) => {
  const u = tankUnit(boat);
  const f = (key) => ({ value: boat[key], onChange: (v) => onChange(key, v) });
  return (
    <DetailsSection title="Vessel Telemetry (tank levels and battery status)" summary={summaryOf(boat, u)} defaultOpen={!telemetryConfigured(boat)} testId="telemetry-section">
      <UnitPick value={u} onChange={(v) => onChange("tank_units", v)} />
      <Group title="Fuel" testId="telemetry-fuel">
        <NumField id="fuel-tank" label="Tank size" unit={u} {...f("fuel_tank")} />
        <NumField id="fuel-jerry" label="Extra jerry cans" {...f("fuel_jerry")} />
        <NumField id="fuel-jerry-size" label="Each can" unit={u} placeholder="20" {...f("fuel_jerry_size")} />
      </Group>
      <Group title="Gas" testId="telemetry-gas">
        <NumField id="gas-bottles" label="Gas bottles" {...f("gas_bottles")} />
        <NumField id="gas-kg" label="Each bottle" unit="kg" placeholder="4.5" {...f("gas_kg")} />
        <NumField id="gas-extra" label="Extra bottles" {...f("gas_extra")} />
      </Group>
      <Group title="Water" testId="telemetry-water">
        <NumField id="water-tank" label="Tank size" unit={u} {...f("water_tank")} />
        <NumField id="water-jerry" label="Extra jerry cans" {...f("water_jerry")} />
        <NumField id="water-jerry-size" label="Each can" unit={u} placeholder="20" {...f("water_jerry_size")} />
      </Group>
      <BatteriesEditor boat={boat} onChange={onChange} />
    </DetailsSection>
  );
};
