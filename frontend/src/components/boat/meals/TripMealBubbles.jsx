import { ShoppingCart, UtensilsCrossed } from "lucide-react";

const PILL = "inline-flex h-8 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-extrabold shadow-sm active:scale-95 [transition:background-color_.15s,transform_.1s]";

// Provisions: the trip's meal plan (light red until one is picked, then light green with its name) and a hop to the Trip Shopping List.
export const TripMealBubbles = ({ plan, onPick, onShop }) => (
  <>
    <span className="inline-flex flex-col items-center gap-0.5">
      <button type="button" onClick={onPick} data-testid="provisions-trip-meal-btn"
        className={`${PILL} ${plan ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"}`}>
        <UtensilsCrossed className="h-3.5 w-3.5" /> {plan ? "Trip Meal Plan" : "Select Trip Meal Plan"}
      </button>
      {plan && <span className="max-w-[12rem] truncate text-xs font-bold text-emerald-800" data-testid="provisions-trip-meal-name">{plan.name}</span>}
    </span>
    <button type="button" onClick={onShop} className={`${PILL} border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-slate-100`} data-testid="provisions-trip-shop-btn">
      <ShoppingCart className="h-3.5 w-3.5" /> Trip Shopping List
    </button>
  </>
);
