import { CheckCircle2, Flag, Navigation, X } from "lucide-react";
import { dmyt } from "@/lib/allDone";
import { arriveType } from "@/components/boat/navigator/ArriveType";

// A logged time (ISO) as the phone's local "26/11/2026 13:01".
export const localTime = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : dmyt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); };

const Line = ({ Icon, done, text, testId }) => (
  <p className="flex items-start gap-1.5 text-sm" data-testid={testId}>
    {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />}
    <span className={done ? "font-bold text-emerald-800" : "font-semibold"}>{text}</span>
  </p>
);

// A tapped stop on the read-only route map: its arrival (stop 2 on) and departure (all but the last), each ticked once logged.
// sailed[k]: the logged leg k ({ at: departed, arrived_at, arrival }).
export const StopDetails = ({ i, legs, name, sailed = [], onClose }) => {
  const into = i > 0 ? legs[i - 1] : null;
  const out = legs[i] || null;
  const got = into && sailed[i - 1];
  const went = out && sailed[i];
  const t = into && arriveType(into.arrive_type);
  const passed = got?.arrival === "transit";
  return (
    <div className="flex w-[min(250px,calc(100vw-56px))] flex-col gap-1 rounded-lg border-2 border-[var(--navy)] bg-white p-2.5 shadow-lg" data-testid="stops-map-details">
      <div className="flex items-start justify-between gap-1">
        <p className="break-words text-sm font-extrabold text-[var(--navy)]" data-testid="stops-map-details-name">{i + 1}) {name || `Point ${i + 1}`}</p>
        <button type="button" className="icon-btn -m-1 h-8 w-8 min-h-0 shrink-0" aria-label="Close" onClick={onClose} data-testid="stops-map-details-close"><X className="h-4 w-4" /></button>
      </div>
      {into && (got?.arrived_at
        ? <Line done text={`${passed ? "Passed" : "Arrived"} ${localTime(got.arrived_at)}`} testId="stops-map-details-arrived" />
        : <Line Icon={t?.Icon || Flag} text={`Estimated arrival ${dmyt(into.finish_at) || "not set"}${t ? ` · ${t.label}` : ""}`} testId="stops-map-details-eta" />)}
      {out && (went?.at
        ? <Line done text={`Departed ${localTime(went.at)}`} testId="stops-map-details-departed" />
        : <Line Icon={Navigation} text={`Due to depart ${dmyt(out.depart_at) || "not set"}`} testId="stops-map-details-due" />)}
    </div>
  );
};
