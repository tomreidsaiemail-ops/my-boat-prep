import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { cruiseKn, num, passagePlan, tankUnit } from "@/lib/telemetry";
import { PassageResults } from "@/components/boat/departure/PassageResults";

const Check = ({ checked, onChange, testId, children }) => (
  <label className="flex cursor-pointer items-start gap-2 text-sm">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={testId} />
    <span>{children}</span>
  </label>
);

const Box = ({ id, label, value, onChange, placeholder, suffix }) => (
  <label className="flex min-w-0 flex-col gap-1"><span className="field-label">{label}</span>
    <span className="relative">
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={80} className={`field-input !h-10 w-full px-2 text-sm ${suffix ? "pr-12" : ""}`} data-testid={`${id}-input`} />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">{suffix}</span>}
    </span>
  </label>
);

const decimal = (set) => (v) => /^\d{0,4}([.,]\d?)?$/.test(v) && set(v.replace(",", "."));

export const PassagePlan = ({ boat, depart, setDepart, onBoatChange, engineType, premium, online, onUpgrade }) => {
  const [busy, setBusy] = useState(false);
  const calc = depart.calc;
  const plan = passagePlan(boat, depart);
  const speed = cruiseKn(boat);
  const unit = tankUnit(boat);
  const start = boat.route_start || "";
  const dest = boat.route_dest || "";
  const stale = calc && (calc.start !== start || calc.dest !== dest || calc.speed !== speed || (calc.engine || "") !== engineType || (calc.unit || "L") !== unit);
  const ask = async () => {
    if (!premium) { onUpgrade(); return; }
    if (!start.trim() || !dest.trim()) { toast.error("Add the start and destination first"); return; }
    if (!online) { toast.error("The Magic Mariner needs a signal to work out the passage"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/passage", { start, dest, engine_type: engineType, cruise_kn: speed, boat_type: boat.boat_type || "", make: boat.make || "",
        model: boat.model || "", loa: boat.loa || "", units: boat.units === "ft" ? "ft" : "m", tank_units: unit }, { timeout: 90000 });
      setDepart({ calc: { distance_nm: data.distance_nm, fuel_rate: data.fuel_rate, notes: data.notes, start, dest, speed, engine: engineType, unit }, rate_reviewed: false, rate_override: "", distance_override: "", ack: false });
    } catch (e) { toast.error(apiError(e, "The Magic Mariner couldn't work out the passage right now. Please try again.")); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-[var(--panel)] p-3" data-testid="passage-plan">
      <p className="field-label">Magic Mariner passage calculation</p>
      <div className="grid grid-cols-2 gap-2">
        <Box id="passage-start" label="Start" value={start} onChange={(v) => onBoatChange("route_start", v)} placeholder="e.g. Mana" />
        <Box id="passage-dest" label="Destination" value={dest} onChange={(v) => onBoatChange("route_dest", v)} placeholder="e.g. Picton" />
      </div>
      <p className="text-sm" data-testid="passage-engine">
        <span className="text-[var(--muted)]">Engine </span><b>{engineType || "not recorded yet (add it on Engine Service History)"}</b>
        <span className="text-[var(--muted)]"> · Cruising speed </span><b data-testid="passage-speed">{speed} kn</b>
      </p>
      <button type="button" className="btn-solid h-11 justify-center gap-2" onClick={ask} disabled={busy} data-testid="passage-ask-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {calc ? "Recalculate with the Magic Mariner" : "Work out my range"}
      </button>
      {stale && <p className="text-xs font-bold text-amber-800" data-testid="passage-stale">The route, speed, engine or tank units changed since this was worked out. Recalculate to update it.</p>}
      {calc && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Box id="passage-distance" label={`Distance (MM: ${calc.distance_nm} nm)`} value={depart.distance_override} onChange={decimal((v) => setDepart({ distance_override: v }))} placeholder={`${calc.distance_nm}`} suffix="nm" />
            <Box id="passage-rate" label={`Fuel use (MM: ${calc.fuel_rate} ${unit}/h)`} value={depart.rate_override} onChange={decimal((v) => setDepart({ rate_override: v, rate_reviewed: false }))} placeholder={`${calc.fuel_rate}`} suffix={`${unit}/h`} />
          </div>
          {calc.notes && <p className="text-xs text-[var(--muted)]" data-testid="passage-notes">{calc.notes}</p>}
          {!num(depart.rate_override) && (
            <Check checked={depart.rate_reviewed} onChange={(v) => setDepart({ rate_reviewed: v })} testId="passage-reviewed-checkbox">
              I&apos;ve reviewed the Magic Mariner&apos;s fuel use of {calc.fuel_rate} {unit}/h (or type my own above).
            </Check>
          )}
          <PassageResults plan={plan} />
          <Check checked={depart.ack} onChange={(v) => setDepart({ ack: v })} testId="passage-ack-checkbox">
            <b>Skipper acknowledgment:</b> I&apos;ve read the passage {plan.warnings.length ? "warnings" : "plan"} and will manage fuel on route. We&apos;ll hold about {speed} knots{speed === 6 ? " (the 6 knot default)" : ""} and won&apos;t go faster, which would burn more fuel.
          </Check>
        </>
      )}
    </div>
  );
};
