import { useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Plus } from "lucide-react";
import { TextDialog } from "@/components/boat/TextDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { BudgetRow } from "@/components/boat/budget/BudgetRow";
import { BudgetTotals } from "@/components/boat/budget/BudgetTotals";
import { OpeningStore } from "@/components/boat/budget/OpeningStore";
import { applyCostAllYears, budgetYears, copyYear, costOf, money, newBudgetItem, shownYear, storeUrl, sumAll, tracked, yearOf } from "@/lib/budget";

export const BudgetTable = ({ items: all, setItems, currency, guard, year }) => {
  const items = all.filter((i) => shownYear(i) === year);
  const prior = all.some((i) => shownYear(i) === year - 1);
  const [applying, setApplying] = useState(null);
  const [linkFor, setLinkFor] = useState(null);
  const [doomed, setDoomed] = useState(null);
  const [opening, setOpening] = useState(null);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState([]);
  const allOpen = items.length > 0 && items.every((i) => openIds.includes(i.id));
  const toggleRow = (id) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const update = (id, patch) => {
    if (patch.paid && yearOf(patch) !== year) { toast.error(`Pick a date in ${year} for the ${year} budget`); return; }
    if (guard()) setItems((list) => list.map((i) => (i.id === id ? { ...i, ...tracked(i, patch), ...("paid" in patch ? { year } : {}) } : i)));
  };
  const quickApply = () => {
    const row = applying;
    setApplying(null);
    if (!guard()) return;
    setItems((list) => applyCostAllYears(list, row, year));
    toast.success(`${money(costOf(row), currency)} applied to "${row.label}" in every budget year`);
  };
  const remove = (item) => {
    if (!guard()) return;
    const index = all.findIndex((i) => i.id === item.id);
    setItems((list) => list.filter((i) => i.id !== item.id));
    const undo = () => setItems((list) => (list.some((i) => i.id === item.id) ? list : [...list.slice(0, index), item, ...list.slice(index)]));
    toast(`Deleted "${item.label || "budget item"}"`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  const add = (e) => {
    e.preventDefault();
    const label = draft.trim();
    if (!label || !guard("bottom")) return;
    setItems((list) => [...list, { ...newBudgetItem(Date.now(), label, "", year), history: [{ at: new Date().toISOString(), field: "Created", from: "", to: `Added to the ${year} budget` }] }]);
    setDraft("");
  };
  const saveLink = (raw) => {
    if (raw && !/^(https?:\/\/)?[^\s/$.?#].[^\s]*\.[^\s]+/i.test(raw)) return "Enter a web address, e.g. www.example.com/product";
    if (!guard()) return true;
    setItems((list) => list.map((i) => (i.id === linkFor.id ? { ...i, ...tracked(i, { url: storeUrl(raw) }) } : i)));
    setLinkFor(null);
    return true;
  };
  const startYear = () => {
    if (!guard()) return;
    const rows = copyYear(all, year - 1, year);
    setItems((list) => [...list, ...rows]);
    toast.success(`${rows.length} rows copied from ${year - 1} into the ${year} budget. ${year - 1} is unchanged.`);
  };
  return (
    <div className="flex flex-col gap-3">
      {!items.length && prior && (
        <button type="button" className="btn-solid min-h-11 w-full" onClick={startYear} data-testid="budget-start-year-btn">Start {year} budget from {year - 1}</button>
      )}
      <div className="overflow-x-auto rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="budget-table-wrap">
        <table className="w-full min-w-[320px] table-fixed border-collapse text-sm" data-testid="budget-table">
          <colgroup><col /><col className="w-[76px]" /><col className="w-[86px]" /><col className="w-[30px]" /></colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-1 py-1.5 text-left">
                <button type="button" onClick={() => setOpenIds(allOpen ? [] : items.map((i) => i.id))} aria-expanded={allOpen} data-testid="budget-expand-all-btn"
                  className="field-label inline-flex h-8 items-center gap-1 rounded px-1 hover:text-[var(--navy)]" title={allOpen ? "Hide product and web link on every row" : "Show product and web link on every row"}>
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
              <BudgetRow key={item.id} item={item} open={openIds.includes(item.id)} onOpen={() => toggleRow(item.id)} onChange={(p) => update(item.id, p)} onDelete={() => setDoomed(item)} year={year} onQuickApply={() => setApplying(item)}
                onLink={() => (item.url ? setOpening(item) : guard() && setLinkFor(item))} />
            ))}
            {!items.length && <tr><td colSpan={4} className="p-4 text-center text-[var(--muted)]" data-testid="budget-empty">No budget items in {year} yet. Add one below.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--navy)] bg-slate-50">
              <td colSpan={2} className="px-2 py-2 text-right text-sm font-extrabold">Total {year}</td>
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
      <BudgetTotals items={all} currency={currency} />
      <ConfirmDelete item={applying ? {} : null} danger={false} testId="budget-quick-apply" confirmLabel="Apply to all years" cancelLabel="Not now"
        title={`Quick apply ${money(applying ? costOf(applying) : 0, currency)} to "${applying?.label || "this item"}"?`}
        note={`The cost of "${applying?.label || "this item"}" becomes ${money(applying ? costOf(applying) : 0, currency)} in ${budgetYears().filter((y) => y !== year).join(", ")}. Years without this item get it added.`}
        onClose={() => setApplying(null)} onConfirm={quickApply} />
      <TextDialog open={!!linkFor} title="Web link" testId="budget-url" inputType="url" placeholder="www.example.com/product" confirmLabel="Save"
        description={`Where do you buy ${linkFor?.product || linkFor?.label || "this"}? Leave it empty to remove the link.`} initial={linkFor?.url || ""}
        onConfirm={saveLink} onClose={() => setLinkFor(null)} />
      <OpeningStore url={opening?.url || ""} onDone={() => setOpening(null)} onEdit={() => { const it = opening; setOpening(null); if (guard()) setLinkFor(it); }} />
      <ConfirmDelete item={doomed ? { name: doomed.label || "this budget item" } : null} testId="budget-delete" note="It comes off your Boat Budget."
        onClose={() => setDoomed(null)} onConfirm={() => { remove(doomed); setDoomed(null); }} />
    </div>
  );
};
