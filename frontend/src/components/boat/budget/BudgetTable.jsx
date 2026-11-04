import { useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Plus } from "lucide-react";
import { TextDialog } from "@/components/boat/TextDialog";
import { BudgetRow } from "@/components/boat/budget/BudgetRow";
import { BudgetTotals } from "@/components/boat/budget/BudgetTotals";
import { OpeningStore } from "@/components/boat/budget/OpeningStore";
import { Lock, LockOpen } from "lucide-react";
import { copyYear, ledgerYear, money, newBudgetItem, storeUrl, sumAll, thisYear, tracked } from "@/lib/budget";

export const BudgetTable = ({ items: all, setItems, currency, guard, year }) => {
  const [unlocked, setUnlocked] = useState([]);
  const items = all.filter((i) => ledgerYear(i) === year);
  const locked = year < thisYear() && !unlocked.includes(year);
  const prior = all.some((i) => ledgerYear(i) === year - 1);
  const [linkFor, setLinkFor] = useState(null);
  const [opening, setOpening] = useState(null);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState([]);
  const allOpen = items.length > 0 && items.every((i) => openIds.includes(i.id));
  const toggleRow = (id) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const update = (id, patch) => !locked && guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, ...tracked(i, patch) } : i)));
  const remove = (item) => {
    if (locked || !guard()) return;
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
    update(linkFor.id, { url: storeUrl(raw) });
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
      {locked && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-slate-50 px-3 py-2 text-sm" data-testid="budget-locked-banner">
          <Lock className="h-4 w-4 shrink-0 text-[var(--navy)]" /> <span className="min-w-0 flex-1"><b>{year}</b> is a past year, so it's locked to keep your records intact.</span>
          <button type="button" className="btn-ghost h-9 min-h-0 gap-1 px-3 text-xs" onClick={() => setUnlocked((u) => [...u, year])} data-testid="budget-unlock-btn"><LockOpen className="h-4 w-4" /> Unlock to correct</button>
        </div>
      )}
      {!locked && year < thisYear() && <p className="text-xs font-bold text-amber-800" data-testid="budget-unlocked-note">{year} is unlocked. Every change is kept in each row's change history.</p>}
      {!items.length && prior && !locked && (
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
              <BudgetRow key={item.id} item={item} open={openIds.includes(item.id)} onOpen={() => toggleRow(item.id)} onChange={(p) => update(item.id, p)} onDelete={() => remove(item)} locked={locked}
                onLink={() => (item.url ? setOpening(item) : !locked && guard() && setLinkFor(item))} />
            ))}
            {!items.length && <tr><td colSpan={4} className="p-4 text-center text-[var(--muted)]" data-testid="budget-empty">No budget items in {year} yet.{locked ? "" : " Add one below."}</td></tr>}
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
      {!locked && <form onSubmit={add} className="flex gap-2" data-testid="budget-add-form">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="New budget item..." aria-label="New budget item" className="field-input" data-testid="budget-add-input" />
        <button type="submit" className="btn-solid shrink-0 gap-1 px-4" data-testid="budget-add-btn"><Plus className="h-4 w-4" /> Add</button>
      </form>}
      <BudgetTotals items={all} currency={currency} total={money(sumAll(all), currency)} />
      <TextDialog open={!!linkFor} title="Web link" testId="budget-url" inputType="url" placeholder="www.example.com/product" confirmLabel="Save"
        description={`Where do you buy ${linkFor?.product || linkFor?.label || "this"}? Leave it empty to remove the link.`} initial={linkFor?.url || ""}
        onConfirm={saveLink} onClose={() => setLinkFor(null)} />
      <OpeningStore url={opening?.url || ""} onDone={() => setOpening(null)} onEdit={() => { const it = opening; setOpening(null); if (guard()) setLinkFor(it); }} />
    </div>
  );
};
