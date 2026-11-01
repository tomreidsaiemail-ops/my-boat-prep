import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { TextDialog } from "@/components/boat/TextDialog";
import { BudgetRow } from "@/components/boat/budget/BudgetRow";
import { BudgetTotals } from "@/components/boat/budget/BudgetTotals";
import { OpeningStore } from "@/components/boat/budget/OpeningStore";
import { money, newBudgetItem, storeUrl, sumAll } from "@/lib/budget";

const HEAD = ["Description", "Product", "Store", "Date Paid", "Cost", ""];

export const BudgetTable = ({ items, setItems, currency, guard }) => {
  const [linkFor, setLinkFor] = useState(null);
  const [opening, setOpening] = useState(null);
  const [draft, setDraft] = useState("");
  const update = (id, patch) => guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (item) => {
    if (!guard()) return;
    const index = items.findIndex((i) => i.id === item.id);
    setItems((list) => list.filter((i) => i.id !== item.id));
    const undo = () => setItems((list) => (list.some((i) => i.id === item.id) ? list : [...list.slice(0, index), item, ...list.slice(index)]));
    toast(`Deleted "${item.label || "budget item"}"`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  const add = (e) => {
    e.preventDefault();
    const label = draft.trim();
    if (!label || !guard("bottom")) return;
    setItems((list) => [...list, newBudgetItem(Date.now(), label)]);
    setDraft("");
  };
  const saveLink = (raw) => {
    if (raw && !/^(https?:\/\/)?[^\s/$.?#].[^\s]*\.[^\s]+/i.test(raw)) return "Enter a web address, e.g. www.store.com/product";
    update(linkFor.id, { url: storeUrl(raw) });
    setLinkFor(null);
    return true;
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="budget-table-wrap">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm" data-testid="budget-table">
          <colgroup><col className="w-[200px]" /><col className="w-[170px]" /><col className="w-[56px]" /><col className="w-[150px]" /><col className="w-[108px]" /><col className="w-[36px]" /></colgroup>
          <thead className="bg-slate-50">
            <tr>{HEAD.map((h, n) => <th key={h || n} className={`field-label px-2 py-2 ${n === 0 ? "sticky left-0 z-10 bg-slate-50" : ""} ${h === "Cost" ? "text-right" : h === "Store" ? "text-center" : "text-left"}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <BudgetRow key={item.id} item={item} onChange={(p) => update(item.id, p)} onDelete={() => remove(item)}
                onLink={() => (item.url ? setOpening(item) : guard() && setLinkFor(item))} />
            ))}
            {!items.length && <tr><td colSpan={6} className="p-4 text-center text-[var(--muted)]" data-testid="budget-empty">No budget items yet. Add one below.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--navy)] bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-sm font-extrabold">Total (all dates)</td>
              <td colSpan={3} />
              <td className="px-2 py-2 text-right font-mono text-sm font-extrabold" data-testid="budget-total-all">{money(sumAll(items), currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <form onSubmit={add} className="flex gap-2" data-testid="budget-add-form">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="New budget item..." aria-label="New budget item" className="field-input" data-testid="budget-add-input" />
        <button type="submit" className="btn-solid shrink-0 gap-1 px-4" data-testid="budget-add-btn"><Plus className="h-4 w-4" /> Add</button>
      </form>
      <BudgetTotals items={items} currency={currency} total={money(sumAll(items), currency)} />
      <TextDialog open={!!linkFor} title="Reorder store link" testId="budget-url" inputType="url" placeholder="www.store.com/product" confirmLabel="Save"
        description={`Where do you buy ${linkFor?.product || linkFor?.label || "this"}? Leave it empty to remove the link.`} initial={linkFor?.url || ""}
        onConfirm={saveLink} onClose={() => setLinkFor(null)} />
      <OpeningStore url={opening?.url || ""} onDone={() => setOpening(null)} onEdit={() => { const it = opening; setOpening(null); if (guard()) setLinkFor(it); }} />
    </div>
  );
};
