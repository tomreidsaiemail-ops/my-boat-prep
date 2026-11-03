import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { batteriesOf, batteryName } from "@/lib/telemetry";

const FUEL_HINT = "The 1/3rd rule: 1/3 to get there, 1/3 to get back, 1/3 held in reserve.";

// Fuel, gas, water and one row per battery; `prefix` keeps departure and arrival test ids apart.
export const TankLevels = ({ boat, levels, onLevel, details = {}, prefix = "" }) => (
  <>
    <LevelPicker id={`${prefix}fuel`} label="Fuel" value={levels.fuel} onChange={(v) => onLevel("fuel", v)} hint={FUEL_HINT} detail={details.fuel} />
    <LevelPicker id={`${prefix}gas`} label="Gas" value={levels.gas} onChange={(v) => onLevel("gas", v)} detail={details.gas} />
    <LevelPicker id={`${prefix}water`} label="Water" value={levels.water} onChange={(v) => onLevel("water", v)} detail={details.water} />
    {batteriesOf(boat).map((b) => (
      <LevelPicker key={b.id} id={`${prefix}bat-${b.id}`} label={batteryName(b)} value={levels[`bat_${b.id}`]} onChange={(v) => onLevel(`bat_${b.id}`, v)} />
    ))}
  </>
);

export const allLevelsPicked = (boat, levels = {}) => ["fuel", "gas", "water", ...batteriesOf(boat).map((b) => `bat_${b.id}`)].every((k) => levels[k]);
