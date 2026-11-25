import { useState } from "react";
import { Anchor, ChevronDown, ChevronUp, RotateCcw, Settings2 } from "lucide-react";
import { AdditionalDetailsDialog } from "@/components/boat/AdditionalDetailsDialog";
import { PassagePlan } from "@/components/boat/departure/PassagePlan";
import { TankLevels, allLevelsPicked } from "@/components/boat/departure/TankLevels";
import { LogCopy, stamp } from "@/components/boat/departure/LogCopy";
import { TankChange } from "@/components/boat/departure/TankChange";
import { tankSummary } from "@/lib/allDone";
import { departureSummary, fuelOnBoard, gasOnBoard, num, passagePlan, tankUnit, telemetryConfigured, waterOnBoard } from "@/lib/telemetry";

const about = (n, u) => (n ? `about ${Math.round(n * 10) / 10} ${u} on board` : "");

export const logBlock = (boat, depart) => {
  if (!allLevelsPicked(boat, depart.levels)) return "Pick a level for every tank and battery first.";
  if (depart.calc && !num(depart.rate_override) && !depart.rate_reviewed) return "Tick that you've reviewed the fuel use, or enter your own, first.";
  if (depart.calc && !depart.ack) return "Tick the skipper acknowledgment first.";
  return "";
};

export const SetupPrompt = ({ boat, onChange, testId }) => {
  const [open, setOpen] = useState(false);
  if (telemetryConfigured(boat) && !open) return null;
  return (
    <>
      {!telemetryConfigured(boat) && (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-md border-[1.5px] border-dashed border-[var(--navy)] px-3 py-2 text-left text-sm font-bold" data-testid={testId}>
          <Settings2 className="h-4 w-4 shrink-0" /> Set up your tanks and batteries so the check knows how much is on board
        </button>
      )}
      <AdditionalDetailsDialog open={open} boat={boat} onChange={onChange} onClose={() => setOpen(false)} />
    </>
  );
};

// underway: no New departure from the dock while the boat is already away.
export const DepartureCheck = ({ boat, underway = false, onBoatChange, engineType, premium, online, onUpgrade, onLog, onUnlog, onRelog, onTankLog }) => {
  const depart = boat.depart || {};
  const setDepart = (patch) => onBoatChange("depart", { ...depart, ...patch });
  const levels = depart.levels || {};
  const u = tankUnit(boat);
  const blocked = logBlock(boat, depart);
  const summary = (when) => departureSummary(boat, depart, passagePlan(boat, depart), when);
  const sig = summary("");
  const [open, setOpen] = useState(false);
  const collapsed = !!depart.log_id && !open;
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="departure-check">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><Anchor className="h-4 w-4" /> Leaving the Dock status check</h3>
        <div className="flex items-center gap-1">
        {depart.log_id && (
          <button type="button" className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" aria-expanded={!collapsed} onClick={() => setOpen(collapsed)} data-testid="departure-collapse-toggle">
            {collapsed ? <>Show <ChevronDown className="h-3.5 w-3.5" /></> : <>Hide <ChevronUp className="h-3.5 w-3.5" /></>}
          </button>
        )}
        {!underway && <button type="button" className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" onClick={() => onBoatChange("depart", {})} data-testid="departure-reset-btn"><RotateCcw className="h-3.5 w-3.5" /> New departure</button>}
        </div>
      </div>
      {collapsed ? (
        <p className="text-sm font-semibold" data-testid="departure-collapsed-summary">{`${tankSummary(levels)} Dock status logged.`.trim()}{depart.log_sig !== sig ? " Changed since it was copied." : ""}</p>
      ) : (
      <>
      <SetupPrompt boat={boat} onChange={onBoatChange} testId="departure-setup-btn" />
      <TankLevels boat={boat} levels={levels} onLevel={(k, v) => setDepart({ levels: { ...levels, [k]: v } })}
        details={{ fuel: about(fuelOnBoard(boat, levels.fuel), u), gas: about(gasOnBoard(boat, levels.gas), "kg"), water: about(waterOnBoard(boat, levels.water), u) }} />
      <TankChange boat={boat} engineType={engineType} levels={levels} amounts={depart.amounts} onSet={setDepart} onBoatChange={onBoatChange} onLog={onTankLog} />
      <PassagePlan boat={boat} depart={depart} setDepart={setDepart} onBoatChange={onBoatChange} engineType={engineType} premium={premium} online={online} onUpgrade={onUpgrade} />
      <LogCopy prefix="departure" label="Copy this departure's tank and battery status into the Ship's Log" logged={!!depart.log_id} blocked={blocked}
        outdated={!!depart.log_id && depart.log_sig !== sig}
        onToggle={(on) => (on ? (setOpen(false), setDepart({ log_id: onLog(summary(stamp()), "Departure"), log_sig: sig })) : (onUnlog(depart.log_id), setDepart({ log_id: null, log_sig: "" })))}
        onRelog={() => { onRelog(depart.log_id, summary(stamp()), "Departure"); setDepart({ log_sig: sig }); }} />
      </>
      )}
    </section>
  );
};
