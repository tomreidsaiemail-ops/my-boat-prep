import { AlertTriangle, CheckCircle2 } from "lucide-react";

const fmt = (n) => Math.round(n * 10) / 10;

const Row = ({ label, value, testId }) => (
  <div className="flex justify-between gap-2 text-sm" data-testid={testId}><span className="text-[var(--muted)]">{label}</span><b className="text-right">{value}</b></div>
);

// Time, fuel and range for the passage, then the red/amber warnings.
export const PassageResults = ({ plan }) => (
  <div className="flex flex-col gap-1.5" data-testid="passage-results">
    <Row label="Time at cruising speed" value={`about ${fmt(plan.hours)} h`} testId="passage-hours" />
    <Row label="Fuel needed" value={`about ${fmt(plan.fuelNeed)}${plan.missing.includes("fuel") ? "" : ` of ${fmt(plan.fuel)}`} ${plan.unit}${plan.missing.includes("fuel") ? "" : " on board"}`} testId="passage-fuel" />
    {!plan.missing.includes("fuel") && <Row label="Range on this fuel" value={`about ${fmt(plan.range)} nm (${fmt(plan.range * (2 / 3))} nm with a 1/3 reserve)`} testId="passage-range" />}
    {plan.missing.length > 0 && (
      <p className="rounded-md bg-sky-50 px-2 py-1.5 text-sm font-semibold text-sky-900" data-testid="passage-setup-note">
        Add your {plan.missing.join(", ")} {plan.missing.length === 1 ? "size" : "sizes"} in Boat details (Vessel Telemetry) so the check can compare them with this passage.
      </p>
    )}
    {plan.warnings.map((w) => (
      <p key={w.key} role="alert" data-testid={`passage-warning-${w.key}`}
        className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-sm font-bold ${w.level === "red" ? "bg-red-50 text-[var(--red)]" : "bg-amber-50 text-amber-800"}`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w.text}
      </p>
    ))}
    {!plan.warnings.length && !plan.missing.length && (
      <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-sm font-bold text-emerald-800" data-testid="passage-ok">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> Within the 1/3 rule, with water and LPG for the trip.
      </p>
    )}
  </div>
);
