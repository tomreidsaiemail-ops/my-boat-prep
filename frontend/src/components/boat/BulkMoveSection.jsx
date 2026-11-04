import { ArrowRightLeft } from "lucide-react";
import { childrenOf } from "@/lib/bulkMove";

// Edit List Panel: tick the items to move (all start ticked; a heading ticks/unticks its sub-items) and pick the target list.
export const BulkMoveSection = ({ items, targets, labelFor, bulk, onChange }) => {
  if (!bulk) {
    return (
      <button type="button" onClick={() => onChange({ to: targets.find((l) => l.id === "myTodo")?.id || "", ids: items.map((i) => i.id) })}
        className="btn-ghost min-h-11 w-full gap-1.5 text-sm" data-testid="bulk-move-open-btn">
        <ArrowRightLeft className="h-4 w-4" /> Bulk Move Items To Another List
      </button>
    );
  }
  const all = items.length > 0 && items.every((i) => bulk.ids.includes(i.id));
  const toggle = (n, on) => {
    const group = [items[n].id, ...(items[n].indent ? [] : childrenOf(items, n))];
    onChange({ ...bulk, ids: on ? [...new Set([...bulk.ids, ...group])] : bulk.ids.filter((x) => !group.includes(x)) });
  };
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] p-3" data-testid="bulk-move-section">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-bold"><ArrowRightLeft className="h-4 w-4 text-[var(--navy)]" /> Bulk Move Items To Another List</legend>
      <select value={bulk.to} onChange={(e) => onChange({ ...bulk, to: e.target.value })} className="field-input font-normal" aria-label="List to move the items to" data-testid="bulk-move-target-select">
        <option value="">Choose the list to move them to</option>
        {targets.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div className="max-h-[40vh] overflow-y-auto rounded-md border-[1.5px] border-[var(--line)]" data-testid="bulk-move-items">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b-[1.5px] border-[var(--line)] bg-slate-50 px-3 text-sm font-bold">
          <input type="checkbox" checked={all} onChange={(e) => onChange({ ...bulk, ids: e.target.checked ? items.map((i) => i.id) : [] })} className="h-5 w-5 accent-[var(--navy)]" data-testid="bulk-move-all" />
          Select All ({bulk.ids.length} of {items.length} ticked)
        </label>
        {items.map((i, n) => (
          <label key={i.id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 py-1.5 text-sm last:border-0 ${i.indent ? "pl-8" : "font-semibold"}`} data-testid={`bulk-move-option-${i.id}-label`}>
            <input type="checkbox" checked={bulk.ids.includes(i.id)} onChange={(e) => toggle(n, e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`bulk-move-option-${i.id}`} />
            <span className="min-w-0 flex-1 break-words">{labelFor(i)}</span>
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onChange(null)} className="self-start text-xs font-bold underline" data-testid="bulk-move-cancel-btn">Don't bulk move</button>
    </fieldset>
  );
};
