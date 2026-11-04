import { Trash2 } from "lucide-react";
import { MaintTable } from "@/components/boat/maint/MaintTable";
import { CUSTOM, DUE_KEY, LAST_KEY } from "@/lib/maint";
import { ListWeightFooter } from "@/components/boat/weights/WeightPanel";

export const MaintList = ({ list, items, setItems, defs, ctx, guard, onDeleteList, ordering, onOrderingChange, promptDelete, onPromptDeleteChange }) => {
  const custom = list?.maint === CUSTOM;
  const cols = custom ? (list.columns || []).map((k) => defs.find((d) => d.key === k)).filter(Boolean) : null;
  return (
    <section className="flex flex-col gap-4" data-testid="maint-list" data-custom={custom ? "true" : "false"}>
      <p className="rounded-md border-l-4 border-[var(--navy)] bg-white px-3 py-2 text-sm text-[var(--muted)]" data-testid="maint-help">
        {custom ? "Add your items below (in categories), then tap an item to fill in its details."
          : "Review and correct each item, then tap the arrow to fill in its details. A category's Service due date applies to its items unless an item has its own (grey dates come from the category)."}
      </p>
      <MaintTable items={items} setItems={setItems} defs={custom ? defs : defs.filter((d) => d.key !== LAST_KEY && d.key !== DUE_KEY)} cols={cols} ctx={ctx} guard={guard}
        ordering={ordering} onOrderingChange={onOrderingChange} promptDelete={promptDelete} onPromptDeleteChange={onPromptDeleteChange} />
      {!custom && <ListWeightFooter listKey={list?.maint} />}
      {!ctx.readOnly && (
        <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 self-end px-3 text-sm text-[var(--red)]" onClick={onDeleteList} data-testid="maint-delete-list-btn">
          <Trash2 className="h-4 w-4" /> Delete this list
        </button>
      )}
    </section>
  );
};
