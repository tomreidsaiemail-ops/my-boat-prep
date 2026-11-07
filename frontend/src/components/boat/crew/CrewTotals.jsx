import { Scale, Users } from "lucide-react";
import { CREW_DEFAULT, fmtKg } from "@/lib/weights";

const LB = 0.453592;
const REG_SPREAD = 3;
const EST_SPREAD = 20;

// Everyone invited or joined, plus the skipper, with an estimated total weight and how far out it could be.
export const CrewTotals = ({ crew, invites, reg, boat = {} }) => {
  const unit = boat.units === "ft" ? "lb" : "kg";
  const avg = Number(boat.crew_weight) || CREW_DEFAULT[unit];
  const avgKg = unit === "lb" ? avg * LB : avg;
  const open = invites.filter((i) => !i.declined_at);
  const weights = [...crew, ...open].map((p) => Number(reg[(p.email || "").toLowerCase()]?.weight_kg) || 0);
  const known = weights.filter((w) => w > 0);
  const est = weights.length - known.length + 1;
  const total = known.reduce((s, w) => s + w, 0) + est * avgKg;
  const spread = known.length * REG_SPREAD + est * EST_SPREAD;
  const people = weights.length + 1;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-[1.5px] border-[var(--navy)] bg-sky-50 p-3" data-testid="crew-totals">
      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--navy)]" data-testid="crew-totals-count">
        <Users className="h-4 w-4 shrink-0" /> {people} on board: you, {crew.length} joined, {open.length} invited
      </p>
      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--navy)]" data-testid="crew-totals-weight">
        <Scale className="h-4 w-4 shrink-0" /> Total crew weight about {fmtKg(total, unit)}
      </p>
      <p className="text-xs leading-snug text-[var(--muted)]" data-testid="crew-totals-note">
        Weights are always estimates. {known.length ? `${known.length} ${known.length === 1 ? "person uses" : "people use"} the weight on your crew register (usually within ${fmtKg(REG_SPREAD, unit)}, more in wet gear) and ` : ""}
        {est} ({est === 1 ? "you" : "including you"}) {est === 1 ? "uses" : "use"} the {Number(boat.crew_weight) ? "" : "typical "}{avg} {unit}, and a real person can be {fmtKg(EST_SPREAD, unit)} either side.
        So the total could be out by about {fmtKg(spread, unit)}.
      </p>
    </div>
  );
};
