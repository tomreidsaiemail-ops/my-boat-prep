import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { LEVELS, batteriesOf } from "@/lib/telemetry";
import { BatteryStatus, CollapseToggle, unsetTone, useCollapsed } from "@/components/boat/departure/BatteryStatus";

const FUEL_HINT = "The 1/3rd rule: 1/3 to get there, 1/3 to get back, 1/3 held in reserve.";
const TANKS = [["fuel", "Fuel"], ["gas", "LPG"], ["water", "Water"]];
const levelLabel = (v) => LEVELS.find((l) => l.key === v)?.label || "not set";

export const tankLevelSummary = (levels = {}) => TANKS.map(([k, n]) => `${n}: ${levelLabel(levels[k])}`);


// Fuel, gas, water and one row per battery; `prefix` keeps departure and arrival test ids apart.
export const TankLevels = ({ boat, levels, onLevel, details = {}, prefix = "", arrival = false }) => {
  const [collapsed, toggle] = useCollapsed("mbp_tanks_collapsed");
  const lowText = arrival ? "Top up or charge before the next passage." : undefined;
  return (
  <>
    <div className="flex flex-col gap-2" data-testid={`${prefix}tank-status`}>
      <CollapseToggle label="Fuel, LPG & Water status" collapsed={collapsed} onToggle={toggle} testId={`${prefix}tank-status-toggle`} />
      {collapsed
        ? <p className={`text-sm font-semibold ${unsetTone(tankLevelSummary(levels))}`} data-testid={`${prefix}tank-status-summary`}>{tankLevelSummary(levels).join(" · ")}</p>
        : (
          <>
            <LevelPicker id={`${prefix}fuel`} label="Fuel" value={levels.fuel} onChange={(v) => onLevel("fuel", v)} hint={arrival ? "" : FUEL_HINT} detail={details.fuel} lowText={lowText} />
            <LevelPicker id={`${prefix}gas`} label="LPG" value={levels.gas} onChange={(v) => onLevel("gas", v)} detail={details.gas} lowText={lowText} />
            <LevelPicker id={`${prefix}water`} label="Water" value={levels.water} onChange={(v) => onLevel("water", v)} detail={details.water} lowText={lowText} />
          </>
        )}
    </div>
    <BatteryStatus boat={boat} levels={levels} onLevel={onLevel} prefix={prefix} lowText={lowText} />
  </>
  );
};

export const allLevelsPicked = (boat, levels = {}) => ["fuel", "gas", "water", ...batteriesOf(boat).map((b) => `bat_${b.id}`)].every((k) => levels[k]);
