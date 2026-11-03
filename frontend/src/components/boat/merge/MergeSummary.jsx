import { Minus, Plus } from "lucide-react";

const Line = ({ item, kind, note, testId }) => (
  <li className="flex items-start gap-1.5 text-sm" data-testid={testId}>
    {kind === "add" ? <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" /> : <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" />}
    <span className="min-w-0 break-words">{item.label}{note && <span className="ml-1 text-xs text-[var(--muted)]">({note})</span>}</span>
  </li>
);

// The top of the merge window: what changed in the master, and what of the skipper's own is kept.
export const MergeSummary = ({ plan, listName, when, notes = [] }) => {
  const { masterAdded, masterRemoved, mineAdded, mineRemoved, exact } = plan;
  const offered = new Set([...plan.add, ...plan.remove].map((i) => i.mkey));
  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-[var(--blue)] bg-sky-50 p-3 text-sky-950" data-testid="merge-summary">
      <p className="text-sm font-extrabold" data-testid="merge-summary-title">
        {exact ? `What changed in the master ${listName}${when ? ` (${when})` : ""}` : `How the master ${listName} differs from yours`}
      </p>
      {notes.length > 0 && (
        <div className="rounded border-l-4 border-[var(--blue)] bg-white px-2.5 py-1.5" data-testid="merge-summary-notes">
          <p className="field-label">Why it changed</p>
          {notes.map((n, k) => <p key={n.at || k} className="text-sm" data-testid={`merge-summary-note-${k}`}>{n.note}</p>)}
        </div>
      )}
      <p className="text-xs font-semibold" data-testid="merge-summary-counts">
        {masterAdded.length} {exact ? "added" : "only in the master"}, {masterRemoved.length} {exact ? "removed" : "only in yours"}
      </p>
      {(masterAdded.length > 0 || masterRemoved.length > 0) && (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto" data-testid="merge-summary-list">
          {masterAdded.map((i) => <Line key={`a${i.mkey}`} item={i} kind="add" note={offered.has(i.mkey) ? "" : "already in yours"} testId="merge-summary-added" />)}
          {masterRemoved.map((i) => <Line key={`r${i.mkey}`} item={i} kind="remove" note={offered.has(i.mkey) ? "" : "already gone from yours"} testId="merge-summary-removed" />)}
        </ul>
      )}
      <p className="text-xs" data-testid="merge-summary-mine">
        {exact
          ? `Your own changes are kept: ${mineAdded.length} ${mineAdded.length === 1 ? "item" : "items"} you added, ${mineRemoved.length} you removed, and all your ticks.`
          : "Your list and ticks are kept. This boat's last master version isn't on file, so items only in yours may be ones you added yourself."}
      </p>
    </div>
  );
};
