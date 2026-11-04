import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BudgetHeader } from "@/components/boat/budget/BudgetHeader";
import { BudgetComments } from "@/components/boat/budget/BudgetComments";
import { BudgetTable } from "@/components/boat/budget/BudgetTable";
import { budgetCurrency, budgetYears, thisYear, withYears } from "@/lib/budget";

export const BudgetList = ({ items, setItems, boat, onBoatChange, premium, online, onUpgrade, guard, onDeleteList }) => {
  const [editing, setEditing] = useState(false);
  const currency = budgetCurrency(boat);
  const [year, setYear] = useState(thisYear());
  const years = budgetYears(items);
  useEffect(() => { if (items.some((i) => !i.year)) setItems(withYears); }, [items, setItems]);
  return (
    <section className="flex flex-col gap-4" data-testid="budget-list">
      <BudgetHeader boat={boat} currency={currency} onBoatChange={onBoatChange} open={editing} onOpenChange={setEditing} />
      <BudgetComments boat={boat} currency={currency} paused={editing} onBoatChange={onBoatChange} premium={premium} online={online} onUpgrade={onUpgrade} />
      <label className="flex items-center gap-2 self-start text-sm font-bold" htmlFor="budget-year">
        Budget year
        <select id="budget-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="field-input !h-10 !w-28 py-0 text-sm" data-testid="budget-year-select">
          {[thisYear() + 1, ...years].filter((y, n, a) => a.indexOf(y) === n).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}{y === thisYear() ? " (this year)" : ""}</option>)}
        </select>
      </label>
      <BudgetTable items={items} setItems={setItems} currency={currency} guard={guard} year={year} />
      <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 self-end px-3 text-sm text-[var(--red)]" onClick={onDeleteList} data-testid="budget-delete-list-btn">
        <Trash2 className="h-4 w-4" /> Delete this list
      </button>
    </section>
  );
};
