import { ClipboardCheck } from "lucide-react";

export const prepCounts = (items) => {
  const tasks = items.filter((i, n) => !(!i.indent && items[n + 1]?.indent));
  return { ticked: tasks.filter((i) => i.checked).length, total: tasks.length };
};

export const crewPrepName = (listName) => /^\s*crew prep\s*-\s*(.+)$/i.exec(listName || "")?.[1]?.trim() || "";

// Bar at the top of a "Crew Prep - <name>" list.
export const CrewPrepProgress = ({ name, items }) => {
  const { ticked, total } = prepCounts(items);
  const pct = total ? Math.round((ticked / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 py-2.5" data-testid="crew-prep-progress">
      <div className="flex items-center gap-2 text-sm font-bold">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-[var(--navy)]" />
        <span className="min-w-0 flex-1 truncate">{name}'s progress</span>
        <span data-testid="crew-prep-progress-count">{ticked} of {total} ticked</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${name}'s Crew Prep progress`}>
        <div className={`h-full rounded-full [transition:width_.3s] ${pct === 100 ? "bg-emerald-600" : "bg-[var(--navy)]"}`} style={{ width: `${pct}%` }} data-testid="crew-prep-progress-bar" />
      </div>
    </div>
  );
};

// Small line under a person in the skipper's crew list.
export const PrepBadge = ({ prep, testId }) => prep ? (
  <p className={`mt-1 flex items-center gap-1 text-xs font-bold ${prep.total && prep.ticked === prep.total ? "text-emerald-800" : "text-sky-900"}`} data-testid={testId}>
    <ClipboardCheck className="h-3.5 w-3.5 shrink-0" /> {prep.list_name}: {prep.ticked} of {prep.total} ticked
  </p>
) : null;
