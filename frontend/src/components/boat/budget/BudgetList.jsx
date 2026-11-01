import { Trash2 } from "lucide-react";
import { BudgetHeader } from "@/components/boat/budget/BudgetHeader";
import { BudgetComments } from "@/components/boat/budget/BudgetComments";
import { BudgetTable } from "@/components/boat/budget/BudgetTable";

export const BudgetList = ({ items, setItems, boat, onBoatChange, premium, online, onUpgrade, guard, onDeleteList }) => (
  <section className="flex flex-col gap-4" data-testid="budget-list">
    <BudgetHeader boat={boat} onBoatChange={onBoatChange} />
    <BudgetComments boat={boat} onBoatChange={onBoatChange} premium={premium} online={online} onUpgrade={onUpgrade} />
    <BudgetTable items={items} setItems={setItems} currency={boat.budget_currency || ""} guard={guard} />
    <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 self-end px-3 text-sm text-[var(--red)]" onClick={onDeleteList} data-testid="budget-delete-list-btn">
      <Trash2 className="h-4 w-4" /> Delete this list
    </button>
  </section>
);
