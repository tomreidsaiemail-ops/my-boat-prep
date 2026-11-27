import { Check, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SourceTag } from "@/components/boat/MpaBadges";
import { initialsFor } from "@/lib/mpa";

// Pick the one meal plan this trip is provisioned from; it's cleared again when a trip is archived.
export const TripMealPlanDialog = ({ open, lists, value, onPick, onClose }) => {
  const tags = initialsFor(lists.map((l) => l.name));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="trip-meal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><UtensilsCrossed className="h-5 w-5" /> Select Trip Meal Plan</DialogTitle>
          <DialogDescription>Pick the meal plan for this trip. The Trip Shopping List is made from it and your Provisions.</DialogDescription>
        </DialogHeader>
        <p className="field-label">Meal plans</p>
        {lists.length === 0 && <p className="rounded-md bg-amber-50 p-3 text-sm" data-testid="trip-meal-none">No meal plans yet. Use Create List, e.g. Create a Meal Plan using the Magic Provisioner.</p>}
        <div className="flex flex-col gap-2">
          {lists.map((l, i) => {
            const on = value === l.id;
            return (
              <button key={l.id} type="button" onClick={() => onPick(l.id)} data-testid={`trip-meal-option-${l.id}`}
                className={`flex min-h-[44px] items-center gap-3 rounded-md border-[1.5px] px-3 text-left [transition:background-color_.15s] ${on ? "border-emerald-500 bg-emerald-50" : "border-[var(--line)] hover:bg-slate-50"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-[var(--navy)]"}`}>{on && <Check className="h-3 w-3" strokeWidth={4} />}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{l.name}</span>
                <span className="text-xs text-[var(--muted)]">{l.meals.length} {l.meals.length === 1 ? "meal" : "meals"}</span>
                <SourceTag tag={tags[i]} />
              </button>
            );
          })}
        </div>
        {value && <button type="button" className="btn-ghost h-10 justify-center text-sm" onClick={() => onPick("")} data-testid="trip-meal-clear-btn">No Trip Meal Plan</button>}
      </DialogContent>
    </Dialog>
  );
};
