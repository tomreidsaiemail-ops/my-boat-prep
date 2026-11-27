import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { EngineBatteryRow, UsingEngineBattery } from "@/components/boat/departure/EngineBatteryRow";
import { missingLevels } from "@/lib/allDone";
import { allBatteries, batteriesOf, batteryName, tankUnit } from "@/lib/telemetry";

// A small labelled number box that sits on the tank's title line, e.g. "Fuel  TANK SIZE [200] L".
const Cap = ({ label, unit, value, onChange, testId, digits = 5 }) => (
  <label className="flex items-center gap-1.5">
    <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
    <input value={value ?? ""} onChange={(e) => new RegExp(`^\\d{0,${digits}}([.,]\\d?)?$`).test(e.target.value) && onChange(e.target.value)} inputMode="decimal"
      className="field-input !h-8 !w-16 px-1.5 text-sm" aria-label={label} data-testid={testId} />
    {unit && <span className="text-xs font-semibold text-[var(--muted)]">{unit}</span>}
  </label>
);
const Title = ({ name, children }) => <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><b className="text-sm font-extrabold">{name}</b>{children}</span>;

const CAP_KEYS = ["fuel_tank", "water_tank", "gas_bottles", "gas_kg"];

// Departures and arrivals: the latest levels filled in for the skipper to confirm or change, with the tank, LPG and house bank sizes
// editable here too (saved back to Additional Boat Details on Confirm).
export const LevelsConfirmDialog = ({ ask, boat, onConfirm, onBoat, onClose }) => {
  const [levels, setLevels] = useState({});
  const [caps, setCaps] = useState({});
  useEffect(() => {
    if (!ask) return;
    setLevels(ask.levels || {});
    setCaps({ ...Object.fromEntries(CAP_KEYS.map((k) => [k, boat[k] || ""])), batteries: allBatteries(boat), engine_battery_off: !!boat.engine_battery_off });
  }, [ask]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = { ...boat, ...caps };
  const missing = missingLevels(view, levels);
  const u = tankUnit(boat);
  const cap = (k, label, unit, testId) => <Cap label={label} unit={unit} value={caps[k]} onChange={(v) => setCaps((c) => ({ ...c, [k]: v }))} testId={testId} />;
  const setAh = (id, ah) => setCaps((c) => ({ ...c, batteries: c.batteries.map((b) => (b.id === id ? { ...b, ah } : b)) }));
  const lowText = ask?.arrival ? "Top up or charge before the next passage." : undefined;
  const pick = (k) => ({ value: levels[k], lowText, onChange: (v) => setLevels((l) => ({ ...l, [k]: v })) });
  const bats = batteriesOf(view).filter((b) => b.role !== "engine");
  const engine = allBatteries(view).find((b) => b.role === "engine");
  const confirm = () => {
    const changed = Object.fromEntries(Object.entries(caps).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(k === "batteries" ? allBatteries(boat) : k === "engine_battery_off" ? !!boat.engine_battery_off : boat[k] || "")));
    if (Object.keys(changed).length) onBoat?.(changed);
    onConfirm(engine && !caps.engine_battery_off ? { ...levels, [`bat_${engine.id}`]: "full" } : levels);
  };
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="levels-confirm-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        {ask && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-extrabold" data-testid="levels-confirm-title">{ask.title}</DialogTitle>
              <DialogDescription data-testid="levels-confirm-description">
                {Object.keys(ask.levels || {}).length ? "Filled in from the latest levels recorded. Change any that are different, then confirm." : "No levels recorded yet, so pick a level for every tank and battery, then confirm."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2.5">
              <LevelPicker id="confirm-fuel" name="Fuel" label={<Title name="Fuel">{cap("fuel_tank", "Tank size", u, "confirm-fuel-tank-input")}</Title>} {...pick("fuel")} />
              <LevelPicker id="confirm-gas" name="LPG" label={<Title name="LPG">{cap("gas_bottles", "No of bottles", "", "confirm-gas-bottles-input")}{cap("gas_kg", "Size", "kg", "confirm-gas-kg-input")}</Title>} {...pick("gas")} />
              <LevelPicker id="confirm-water" name="Water" label={<Title name="Water">{cap("water_tank", "Tank size", u, "confirm-water-tank-input")}</Title>} {...pick("water")} />
              {bats.map((b) => (
                <LevelPicker key={b.id} id={`confirm-bat_${b.id}`} name={batteryName(b)} {...pick(`bat_${b.id}`)}
                  label={<Title name={batteryName(b)}>{b.role === "house" && <Cap label="Amp hours" unit="Ah" value={b.ah} digits={5} onChange={(v) => /^\d*$/.test(v) && setAh(b.id, v)} testId={`confirm-bat-${b.id}-ah-input`} />}</Title>} />
              ))}
              {engine && <UsingEngineBattery on={!caps.engine_battery_off} onChange={(on) => setCaps((c) => ({ ...c, engine_battery_off: !on }))} testId="confirm-using-engine-battery" />}
              {engine && !caps.engine_battery_off && <EngineBatteryRow id={`confirm-bat_${engine.id}`} label={batteryName(engine)} />}
            </div>
            <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 bg-white px-1 pb-1 pt-2">
              {missing.length > 0 && <p role="alert" className="w-full text-sm font-bold text-[var(--red)]" data-testid="levels-confirm-missing">Pick a level for {missing.join(", ")}.</p>}
              <button type="button" className="btn-solid h-11 flex-1 justify-center" disabled={missing.length > 0} onClick={confirm} data-testid="levels-confirm-btn">Confirm levels</button>
              <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="levels-confirm-cancel-btn">Cancel</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
