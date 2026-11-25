import { ArriveQuickPick, arriveType } from "@/components/boat/navigator/ArriveType";

// DEPART: each planned leg's arrival type to confirm; a tap changes it in the trip plan.
export const DepartLegTypes = ({ legs, onType }) => (
  <div className="flex flex-col gap-1.5 rounded-lg border-2 border-[var(--navy)] p-2.5" data-testid="depart-leg-types">
    <p className="text-sm font-bold text-[var(--navy)]">Planned arrivals: check each leg, tap one to change it.</p>
    <ul className="flex flex-col gap-1">
      {legs.map((l, n) => {
        const t = arriveType(l.arrive_type);
        return (
          <li key={l.id ?? n} className="flex items-center gap-2 rounded-md bg-[var(--panel)] py-1 pl-2.5 pr-1 text-sm" data-testid={`depart-leg-type-${n}`}>
            <span className="min-w-0 flex-1 break-words"><b>Leg {n + 1}</b> to {l.route_dest || "Destination not set"} · <span className="font-bold" data-testid={`depart-leg-type-${n}-label`}>{t?.label || "Type not set"}</span></span>
            <ArriveQuickPick value={l.arrive_type} onChange={(k) => onType(n, k)} legLabel={`Leg ${n + 1}`} testId={`depart-leg-type-${n}-pick`} />
          </li>
        );
      })}
    </ul>
  </div>
);
