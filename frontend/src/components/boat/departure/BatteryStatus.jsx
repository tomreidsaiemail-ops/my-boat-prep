import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { LEVELS } from "@/lib/telemetry";
import { batteriesOf, batteryName } from "@/lib/telemetry";

const KEY = "mbp_battery_collapsed";
const EVT = "mbp:battery-collapse";
const levelLabel = (v) => LEVELS.find((l) => l.key === v)?.label || "not set";

// Collapsed or open is shared between Leaving the Dock and Electrical Service.
const useCollapsed = () => {
  const [collapsed, set] = useState(() => localStorage.getItem(KEY) === "1");
  useEffect(() => {
    const f = () => set(localStorage.getItem(KEY) === "1");
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, []);
  const toggle = () => { localStorage.setItem(KEY, collapsed ? "0" : "1"); window.dispatchEvent(new Event(EVT)); };
  return [collapsed, toggle];
};

export const batterySummary = (boat, levels = {}) => batteriesOf(boat).map((b) => `${batteryName(b)}: ${levelLabel(levels[`bat_${b.id}`])}`);

// The big battery level buttons, saved in the Leaving the Dock levels so both lists show the same status.
export const BatteryStatus = ({ boat, levels = {}, onLevel, prefix = "", lowText }) => {
  const [collapsed, toggle] = useCollapsed();
  const bats = batteriesOf(boat);
  if (!bats.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid={`${prefix}battery-status`}>
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex items-center justify-between gap-2 text-left" data-testid={`${prefix}battery-status-toggle`}>
        <span className="field-label">Battery status</span>
        <span className="flex items-center gap-1 text-xs font-bold text-[var(--navy)]">{collapsed ? <>Show <ChevronDown className="h-4 w-4" /></> : <>Hide <ChevronUp className="h-4 w-4" /></>}</span>
      </button>
      {collapsed
        ? <p className="text-sm font-semibold" data-testid={`${prefix}battery-status-summary`}>{batterySummary(boat, levels).join(" · ")}</p>
        : bats.map((b) => <LevelPicker key={b.id} id={`${prefix}bat-${b.id}`} label={batteryName(b)} value={levels[`bat_${b.id}`]} onChange={(v) => onLevel(`bat_${b.id}`, v)} lowText={lowText} />)}
    </div>
  );
};
