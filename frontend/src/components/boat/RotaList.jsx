import { dayLabel, timeOf } from "@/lib/watchRota";

export const RotaList = ({ rota, me, testId = "rota-list" }) => {
  let lastDay = "";
  return (
    <ol className="max-h-80 overflow-y-auto rounded-md border-[1.5px] border-[var(--line)]" data-testid={testId}>
      {rota.slots.map((s, i) => {
        const day = dayLabel(s.start);
        const showDay = day !== lastDay;
        lastDay = day;
        const crew = s.people.map((p) => rota.people[p]).filter(Boolean);
        const mine = me && crew.some((p) => p.id === me);
        return (
          <li key={s.start} data-testid={`${testId}-slot-${i}`}>
            {showDay && <p className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{day}</p>}
            <div className={`flex gap-3 border-t border-[var(--line)] px-3 py-2 text-sm ${mine ? "bg-amber-50" : ""}`}>
              <div className="w-24 shrink-0">
                <p className="font-mono font-bold">{timeOf(s.start)}–{timeOf(s.end)}</p>
                <p className="text-xs text-[var(--muted)]">{s.watch}</p>
              </div>
              <div className="min-w-0 flex-1">
                {crew.map((p) => (
                  <p key={p.id} className="truncate">
                    <span className="font-bold">{p.name}</span>{p.id === me && <span className="ml-1 rounded bg-amber-200 px-1 text-[11px] font-bold">You</span>}
                    {p.roles?.length > 0 && <span className="text-xs text-[var(--muted)]"> · {p.roles.join(", ")}</span>}
                  </p>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
