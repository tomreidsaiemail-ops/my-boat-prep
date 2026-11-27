import { ShoppingBasket, ShoppingCart } from "lucide-react";
import { mealExtras, mealKeyLabel, shopText } from "@/lib/shoppers";

// Provisions: the meal-plan ingredients from the Trip Shopping List, in blue, aisle by aisle with who is buying them.
export const MealPlanExtras = ({ rows, onOpen }) => {
  const groups = mealExtras(rows);
  if (!groups.length) return null;
  const from = mealKeyLabel(rows);
  return (
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-blue-200 bg-blue-50/60 p-3" data-testid="provisions-meal-extras">
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-blue-800">From the Trip Meal Plan</h3>
        {from && <p className="text-xs font-semibold text-blue-800/80" data-testid="provisions-meal-extras-from">{from}</p>}
      </div>
      {groups.map((g) => (
        <div key={g.id} data-testid={`provisions-meal-extras-aisle-${g.id}`}>
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-[var(--navy)]">
            {g.aisle}
            {g.shopper
              ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900" data-testid={`provisions-meal-extras-shopper-${g.id}`}><ShoppingBasket className="h-3 w-3" />{g.shopper}</span>
              : <span className="text-xs font-semibold text-[var(--muted)]">No shopper yet</span>}
          </p>
          <ul className="mt-0.5 flex list-disc flex-col gap-0.5 pl-5">
            {g.rows.map((r) => <li key={r.id} className={`text-sm font-semibold text-blue-700 ${r.checked ? "line-through opacity-60" : ""}`} data-testid={`provisions-meal-extras-item-${r.id}`}>{shopText(r)}</li>)}
          </ul>
        </div>
      ))}
      <button type="button" className="btn-ghost h-9 gap-1.5 self-start bg-white px-3 text-xs" onClick={onOpen} data-testid="provisions-meal-extras-open-btn">
        <ShoppingCart className="h-3.5 w-3.5" /> Tick these off in the Trip Shopping List
      </button>
    </section>
  );
};
