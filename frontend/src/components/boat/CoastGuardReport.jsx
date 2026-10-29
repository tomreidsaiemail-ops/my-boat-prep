import { Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const FILL = (s) => `[${s}]`;
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const coastGuardReport = (boat, start, dest, result) => {
  const pob = boat.pob || 1;
  const kids = Math.min(boat.children || 0, pob);
  const via = (result.waypoints || []).slice(1, -1).map((w) => w.name).filter(Boolean);
  const size = boat.loa ? `, LOA ${boat.loa} ${boat.units === "ft" ? "ft" : "m"}` : "";
  return [
    `Vessel: ${boat.vessel || FILL("VESSEL NAME")}`,
    `Callsign: ${boat.callsign || FILL("CALLSIGN")}${/^\d{9}$/.test(boat.mmsi || "") ? ` · MMSI ${boat.mmsi}` : ""}`,
    `Boat: ${boat.boat_type || FILL("BOAT TYPE AND COLOUR")}${size}`,
    `Skipper: ${boat.skipper || FILL("SKIPPER NAME")}`,
    `Persons on board: ${pob}${kids ? ` (${count(pob - kids, "adult", "adults")}, ${count(kids, "child", "children")})` : ""}`,
    `Departing: ${start} at ${FILL("DEPARTURE TIME")}`,
    `Destination: ${dest}`,
    ...(via.length ? [`Route: via ${via.join(", ")}`] : []),
    ...(result.distance_nm ? [`Distance: about ${result.distance_nm} nm`] : []),
    `Estimated passage time: ${result.passage_time || FILL("PASSAGE TIME")}`,
    `ETA: ${FILL("ETA")}`,
    ...(boat.trip_days ? [`Trip duration: ${boat.trip_days} ${boat.trip_days === 1 ? "day" : "days"}`] : []),
    `Shore contact: ${FILL("NAME AND PHONE")}`,
    "Remember to close this trip report when you arrive.",
  ].join("\n");
};

export const CoastGuardReport = ({ text }) => {
  const copy = () => navigator.clipboard?.writeText(text).then(() => toast.success("Trip report copied"), () => toast.error("Couldn't copy, select the text instead"));
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2" data-testid="coast-guard-report">
      <div className="flex items-center gap-2">
        <span className="flex flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"><ShieldCheck className="h-4 w-4" /> Coast Guard Trip Report</span>
          <span className="text-[11px] text-[var(--muted)]">Suggested by the Magic Marine Navigator</span>
        </span>
        <button type="button" className="icon-btn h-9 w-9" onClick={copy} aria-label="Copy trip report" data-testid="coast-guard-report-copy-btn"><Copy className="h-4 w-4" /></button>
      </div>
      <p className="select-text whitespace-pre-line text-sm" data-testid="coast-guard-report-text">{text}</p>
    </div>
  );
};
