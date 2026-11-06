import { Copy, Plus, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MagicProvisionerIcon } from "@/components/boat/meals/MagicProvisionerIcon";

const Option = ({ icon, title, sub, onClick, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className="flex min-h-[64px] w-full items-center gap-3 rounded-md border-2 border-[var(--navy)] bg-white px-3 py-2 text-left text-[var(--navy)] hover:bg-sky-50 active:scale-[0.99] [transition:background-color_.15s,transform_.1s]">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--navy)] text-white">{icon}</span>
    <span className="min-w-0">
      <span className="block text-sm font-extrabold leading-snug">{title}</span>
      {sub && <span className="block text-xs text-[var(--muted)]">{sub}</span>}
    </span>
  </button>
);

// "+" on the list bar: every way to make a new list. Galley crew only see the meal plan options.
export const CreateListOptions = ({ open, listName, galleyOnly, onPick, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="create-list-options">
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Create List</DialogTitle>
        <DialogDescription>Pick how you'd like to make your new list.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {!galleyOnly && <Option icon={<Copy className="h-6 w-6" strokeWidth={2.5} />} title="Clone the selected list" sub={listName ? `Makes a copy of ${listName}` : undefined} onClick={() => onPick("clone")} testId="create-option-clone" />}
        {!galleyOnly && <Option icon={<Plus className="h-6 w-6" strokeWidth={3} />} title="Create a standard list using the Create List window" onClick={() => onPick("standard")} testId="create-option-standard" />}
        <Option icon={<UtensilsCrossed className="h-6 w-6" strokeWidth={2.2} />} title="Create a Meal Plan using common meals, and add your own, and remember them" onClick={() => onPick("common")} testId="create-option-common-meals" />
        <Option icon={<MagicProvisionerIcon />} title="Ask the Magic Provisioner to Create a Meal Plan using what is onboard" sub="Uses the food in your Food (F) boat areas" onClick={() => onPick("onboard")} testId="create-option-magic-onboard" />
        <Option icon={<MagicProvisionerIcon />} title="Create a Meal Plan using the Magic Provisioner" sub="Fresh ideas for every meal of the trip" onClick={() => onPick("fresh")} testId="create-option-magic-fresh" />
      </div>
    </DialogContent>
  </Dialog>
);
