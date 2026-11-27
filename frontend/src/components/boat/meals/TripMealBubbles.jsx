import { ShoppingCart, UtensilsCrossed } from "lucide-react";

const PILL = "inline-flex h-8 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-extrabold shadow-sm active:scale-95 [transition:background-color_.15s,transform_.1s]";

// Provisions: a hop to the Trip Shopping List, then the trip's meal plan (light red until one is picked; then a light green
// bubble named for it that opens it, with a "Trip Meal Plan..." link below to change it).
export const TripMealBubbles = ({ plan, onPick, onShop, onOpenPlan }) => (
  <>
    <button type="button" onClick={onShop} className={`${PILL} border-[var(--navy)] bg-white text-[var(--navy)] hover:bg-slate-100`} data-testid="provisions-trip-shop-btn">
      <ShoppingCart className="h-3.5 w-3.5" /> Trip Shopping List
    </button>
    {plan ? (
      <span className="inline-flex flex-col items-center gap-0.5">
        <button type="button" onClick={onOpenPlan} className={`${PILL} max-w-[14rem] border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`} data-testid="provisions-trip-meal-open-btn">
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{plan.name}</span>
        </button>
        <button type="button" onClick={onPick} className="text-xs font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-950" data-testid="provisions-trip-meal-btn">Trip Meal Plan...</button>
      </span>
    ) : (
      <button type="button" onClick={onPick} className={`${PILL} border-red-300 bg-red-50 text-red-900 hover:bg-red-100`} data-testid="provisions-trip-meal-btn">
        <UtensilsCrossed className="h-3.5 w-3.5" /> Select Trip Meal Plan
      </button>
    )}
  </>
);
