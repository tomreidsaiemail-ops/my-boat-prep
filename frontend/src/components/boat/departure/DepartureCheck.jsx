import { useState } from "react";
import { Anchor, RotateCcw, Settings2 } from "lucide-react";
import { AdditionalDetailsDialog } from "@/components/boat/AdditionalDetailsDialog";
import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { PassagePlan } from "@/components/boat/departure/PassagePlan";
import { batteriesOf, batteryName, departureSummary, fuelOnBoard, gasOnBoard, num, passagePlan, tankUnit, telemetryConfigured, waterOnBoard } from "@/lib/telemetry";

const FUEL_HINT = "The 1/3rd rule: 1/3 to get there, 1/3 to get back, 1/3 held in reserve.";
const about = (n, u) => (n ? `about ${Math.round(n * 10) / 10} ${u} on board` : "");

const logBlock = (boat, depart) => {
  const levels = depart.levels || {};
  if (!["fuel", "gas", "water", ...batteriesOf(boat).map((b) => `bat_${b.id}`)].every((k) => levels[k])) return "Pick a level for every tank and battery first.";
  if (depart.calc && !num(depart.rate_override) && !depart.rate_reviewed) return "Tick that you've reviewed the fuel use, or enter your own, first.";
  if (depart.calc && !depart.ack) return "Tick the skipper acknowledgment first.";
  return "";
};

export const DepartureCheck = ({ boat, onBoatChange, engineType, premium, online, onUpgrade, onLog, onUnlog }) => {
  const [details, setDetails] = useState(false);
  const depart = boat.depart || {};
  const setDepart = (patch) => onBoatChange("depart", { ...depart, ...patch });
  const levels = depart.levels || {};
  const setLevel = (k, v) => setDepart({ levels: { ...levels, [k]: v } });
  const u = tankUnit(boat);
  const blocked = logBlock(boat, depart);
  const toggleLog = (on) => {
    if (on) setDepart({ log_id: onLog(departureSummary(boat, depart, passagePlan(boat, depart), new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))) });
    else { onUnlog(depart.log_id); setDepart({ log_id: null }); }
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-[var(--navy)] bg-white p-3.5" data-testid="departure-check">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold"><Anchor className="h-4 w-4" /> Leaving the Dock status check</h3>
        <button type="button" className="btn-ghost h-9 min-h-0 gap-1 px-2.5 text-xs" onClick={() => onBoatChange("depart", {})} data-testid="departure-reset-btn"><RotateCcw className="h-3.5 w-3.5" /> New departure</button>
      </div>
      {!telemetryConfigured(boat) && (
        <button type="button" onClick={() => setDetails(true)} className="flex items-center gap-2 rounded-md border-[1.5px] border-dashed border-[var(--navy)] px-3 py-2 text-left text-sm font-bold" data-testid="departure-setup-btn">
          <Settings2 className="h-4 w-4 shrink-0" /> Set up your tanks and batteries so the check knows how much is on board
        </button>
      )}
      <LevelPicker id="fuel" label="Fuel" value={levels.fuel} onChange={(v) => setLevel("fuel", v)} hint={FUEL_HINT} detail={about(fuelOnBoard(boat, levels.fuel), u)} />
      <LevelPicker id="gas" label="Gas" value={levels.gas} onChange={(v) => setLevel("gas", v)} detail={about(gasOnBoard(boat, levels.gas), "kg")} />
      <LevelPicker id="water" label="Water" value={levels.water} onChange={(v) => setLevel("water", v)} detail={about(waterOnBoard(boat, levels.water), u)} />
      {batteriesOf(boat).map((b) => <LevelPicker key={b.id} id={`bat-${b.id}`} label={batteryName(b)} value={levels[`bat_${b.id}`]} onChange={(v) => setLevel(`bat_${b.id}`, v)} />)}
      <PassagePlan boat={boat} depart={depart} setDepart={setDepart} onBoatChange={onBoatChange} engineType={engineType} premium={premium} online={online} onUpgrade={onUpgrade} />
      <label className={`flex items-start gap-2 text-sm ${blocked && !depart.log_id ? "opacity-60" : "cursor-pointer"}`}>
        <input type="checkbox" checked={!!depart.log_id} disabled={!!blocked && !depart.log_id} onChange={(e) => toggleLog(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="departure-log-checkbox" />
        <span><b>Copy this departure&apos;s tank and battery status into the Ship&apos;s Log</b>
          {blocked && !depart.log_id && <span className="block text-xs text-[var(--muted)]" data-testid="departure-log-blocked">{blocked}</span>}
          {depart.log_id && <span className="block text-xs text-emerald-700" data-testid="departure-logged">Copied to the Ship&apos;s Log. Untick to take it out again.</span>}
        </span>
      </label>
      <AdditionalDetailsDialog open={details} boat={boat} onChange={onBoatChange} onClose={() => setDetails(false)} />
    </section>
  );
};
