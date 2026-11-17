import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { LEVELS } from "@/lib/telemetry";
import { batteriesOf, batteryName } from "@/lib/telemetry";

const levelLabel = (v) => LEVELS.find((l) => l.key === v)?.label || "not set";

// Collapsed or open is remembered and shared by every list showing the same card.
export const useCollapsed = (key = "mbp_battery_collapsed") => {
  const evt = `mbp:collapse-${key}`;
  const [collapsed, set] = useState(() => localStorage.getItem(key) === "1");
  useEffect(() => {
    const f = () => set(localStorage.getItem(key) === "1");
    window.addEventListener(evt, f);
    return () => window.removeEventListener(evt, f);
  }, [key, evt]);
  const toggle = () => { localStorage.setItem(key, collapsed ? "0" : "1"); window.dispatchEvent(new Event(evt)); };
  return [collapsed, toggle];
};

export const CollapseToggle = ({ label, collapsed, onToggle, testId }) => (
  <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex items-center justify-between gap-2 text-left" data-testid={testId}>
    <span className="field-label">{label}</span>
    <span className="flex items-center gap-1 text-xs font-bold text-[var(--navy)]">{collapsed ? <>Show <ChevronDown className="h-4 w-4" /></> : <>Hide <ChevronUp className="h-4 w-4" /></>}</span>
  </button>
);

// Orange until every level is picked: they must be set before ARRIVED, ALL CHECKS DONE.
export const unsetTone = (parts) => (parts.some((t) => t.endsWith(": not set")) ? "rounded-md bg-orange-200 px-2 py-1 text-orange-950" : "");
export const batterySummary = (boat, levels = {}) => batteriesOf(boat).map((b) => `${batteryName(b)}: ${levelLabel(levels[`bat_${b.id}`])}`);

// The big battery level buttons, saved in the Leaving the Dock levels so both lists show the same status.
export const BatteryStatus = ({ boat, levels = {}, onLevel, prefix = "", lowText }) => {
  const [collapsed, toggle] = useCollapsed();
  const bats = batteriesOf(boat);
  if (!bats.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid={`${prefix}battery-status`}>
      <CollapseToggle label="Battery status" collapsed={collapsed} onToggle={toggle} testId={`${prefix}battery-status-toggle`} />
      {collapsed
        ? <p className={`text-sm font-semibold ${unsetTone(batterySummary(boat, levels))}`} data-testid={`${prefix}battery-status-summary`}>{batterySummary(boat, levels).join(" · ")}</p>
        : bats.map((b) => <LevelPicker key={b.id} id={`${prefix}bat-${b.id}`} label={batteryName(b)} value={levels[`bat_${b.id}`]} onChange={(v) => onLevel(`bat_${b.id}`, v)} lowText={lowText} />)}
    </div>
  );
};
