import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BudgetHeader } from "@/components/boat/budget/BudgetHeader";
import { BudgetComments } from "@/components/boat/budget/BudgetComments";
import { BudgetTable } from "@/components/boat/budget/BudgetTable";
import { budgetCurrency } from "@/lib/budget";

export const BudgetList = ({ items, setItems, boat, onBoatChange, premium, online, onUpgrade, guard, onDeleteList }) => {
  const [editing, setEditing] = useState(false);
  const currency = budgetCurrency(boat);
  return (
    <section className="flex flex-col gap-4" data-testid="budget-list">
      <BudgetHeader boat={boat} currency={currency} onBoatChange={onBoatChange} open={editing} onOpenChange={setEditing} />
      <BudgetComments boat={boat} currency={currency} paused={editing} onBoatChange={onBoatChange} premium={premium} online={online} onUpgrade={onUpgrade} />
      <BudgetTable items={items} setItems={setItems} currency={currency} guard={guard} />
      <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 self-end px-3 text-sm text-[var(--red)]" onClick={onDeleteList} data-testid="budget-delete-list-btn">
        <Trash2 className="h-4 w-4" /> Delete this list
      </button>
    </section>
  );
};
