import { ShoppingBasket } from "lucide-react";

// Shown for 2 seconds after crew accept the agreement while Provisions opens on their shopping.
export const ShoppingAheadBar = () => (
  <div role="status" className="fixed inset-x-3 top-3 z-[1000000000] mx-auto max-w-md overflow-hidden rounded-lg border-2 border-amber-600 bg-amber-50 shadow-lg" data-testid="shopping-ahead-bar">
    <p className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-amber-900"><ShoppingBasket className="h-5 w-5 shrink-0" /> You have shopping to buy before coming on board</p>
    <div className="h-1.5 bg-amber-200"><div className="h-full origin-left bg-amber-600 [animation:shop-bar-fill_2s_linear_forwards]" data-testid="shopping-ahead-progress" /></div>
  </div>
);
