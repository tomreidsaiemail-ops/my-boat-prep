import { useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Plus } from "lucide-react";
import { TextDialog } from "@/components/boat/TextDialog";
import { BudgetRow } from "@/components/boat/budget/BudgetRow";
import { BudgetTotals } from "@/components/boat/budget/BudgetTotals";
import { OpeningStore } from "@/components/boat/budget/OpeningStore";
import { money, newBudgetItem, storeUrl, sumAll } from "@/lib/budget";

export const BudgetTable = ({ items, setItems, currency, guard }) => {
  const [linkFor, setLinkFor] = useState(null);
  const [opening, setOpening] = useState(null);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState([]);
  const allOpen = items.length > 0 && items.every((i) => openIds.includes(i.id));
  const toggleRow = (id) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
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
        <table className="w-full min-w-[320px] table-fixed border-collapse text-sm" data-testid="budget-table">
          <colgroup><col /><col className="w-[84px]" /><col className="w-[92px]" /><col className="w-[30px]" /></colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-1 py-1.5 text-left">
                <button type="button" onClick={() => setOpenIds(allOpen ? [] : items.map((i) => i.id))} aria-expanded={allOpen} data-testid="budget-expand-all-btn"
                  className="field-label inline-flex h-8 items-center gap-1 rounded px-1 hover:text-[var(--navy)]" title={allOpen ? "Hide product and store on every row" : "Show product and store on every row"}>
                  <ChevronsUpDown className="h-4 w-4" /> Description
                </button>
              </th>
              <th className="field-label px-1 py-1.5 text-left">Date Paid</th>
              <th className="field-label px-1 py-1.5 text-right">Cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <BudgetRow key={item.id} item={item} open={openIds.includes(item.id)} onOpen={() => toggleRow(item.id)} onChange={(p) => update(item.id, p)} onDelete={() => remove(item)}
                onLink={() => (item.url ? setOpening(item) : guard() && setLinkFor(item))} />
            ))}
            {!items.length && <tr><td colSpan={4} className="p-4 text-center text-[var(--muted)]" data-testid="budget-empty">No budget items yet. Add one below.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--navy)] bg-slate-50">
              <td colSpan={2} className="px-2 py-2 text-right text-sm font-extrabold">Total (all dates)</td>
              <td className="px-1 py-2 text-right font-mono text-sm font-extrabold" data-testid="budget-total-all">{money(sumAll(items), currency)}</td>
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
