import { changeKey } from "@/lib/merge";

const Choice = ({ item, kind, on, onToggle }) => {
  const k = changeKey(kind, item);
  return (
    <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm" data-testid={`merge-choice-${kind}-${item.label}`}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" checked={on} onChange={(e) => onToggle(k, e.target.checked)} data-testid={`merge-check-${kind}-${item.label}`} />
      <span className="min-w-0 break-words">
        <b className={kind === "add" ? "text-emerald-800" : "text-red-700"}>{kind === "add" ? "Bring in: " : "Remove from mine: "}</b>{item.label}
      </span>
    </label>
  );
};

// Master changes the skipper can bring in; all start unticked so nothing changes unless chosen.
export const MergeChoices = ({ plan, picked, onToggle, allOn, onAll }) => {
  const count = plan.add.length + plan.remove.length;
  if (!count) return <p className="rounded-md bg-slate-50 p-3 text-sm" data-testid="merge-nothing">Your list already has every master change. Merging just clears the Updated tag.</p>;
  return (
    <div className="flex flex-col rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="merge-choices">
      <label className="flex cursor-pointer items-center gap-2.5 border-b-[1.5px] border-[var(--line)] bg-slate-50 px-3 py-2.5 text-sm font-extrabold">
        <input type="checkbox" className="h-5 w-5 accent-[var(--navy)]" checked={allOn} onChange={(e) => onAll(e.target.checked)} data-testid="merge-select-all" />
        Master changes you can bring in ({count})
      </label>
      <div className="flex max-h-64 flex-col divide-y divide-[var(--line)] overflow-y-auto">
        {plan.add.map((i) => <Choice key={`a${i.label}`} item={i} kind="add" on={picked.has(changeKey("add", i))} onToggle={onToggle} />)}
        {plan.remove.map((i) => <Choice key={`r${i.label}`} item={i} kind="remove" on={picked.has(changeKey("remove", i))} onToggle={onToggle} />)}
      </div>
    </div>
  );
};
