import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { batteriesOf } from "@/lib/telemetry";
import { BatteryStatus } from "@/components/boat/departure/BatteryStatus";

const FUEL_HINT = "The 1/3rd rule: 1/3 to get there, 1/3 to get back, 1/3 held in reserve.";

// Fuel, gas, water and one row per battery; `prefix` keeps departure and arrival test ids apart.
export const TankLevels = ({ boat, levels, onLevel, details = {}, prefix = "", arrival = false }) => {
  const lowText = arrival ? "Top up or charge before the next passage." : undefined;
  return (
  <>
    <LevelPicker id={`${prefix}fuel`} label="Fuel" value={levels.fuel} onChange={(v) => onLevel("fuel", v)} hint={arrival ? "" : FUEL_HINT} detail={details.fuel} lowText={lowText} />
    <LevelPicker id={`${prefix}gas`} label="LPG" value={levels.gas} onChange={(v) => onLevel("gas", v)} detail={details.gas} lowText={lowText} />
    <LevelPicker id={`${prefix}water`} label="Water" value={levels.water} onChange={(v) => onLevel("water", v)} detail={details.water} lowText={lowText} />
    <BatteryStatus boat={boat} levels={levels} onLevel={onLevel} prefix={prefix} lowText={lowText} />
  </>
  );
};

export const allLevelsPicked = (boat, levels = {}) => ["fuel", "gas", "water", ...batteriesOf(boat).map((b) => `bat_${b.id}`)].every((k) => levels[k]);
