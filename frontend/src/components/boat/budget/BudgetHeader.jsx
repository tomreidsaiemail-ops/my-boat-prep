import { useState } from "react";
import { Pencil } from "lucide-react";
import { AdditionalDetailsDialog } from "@/components/boat/AdditionalDetailsDialog";
import { CURRENCIES } from "@/lib/budget";

const Fact = ({ label, value, testId }) => (
  <div className="min-w-0 rounded-md border-[1.5px] border-[var(--line)] bg-white px-3 py-2" data-testid={testId}>
    <p className="field-label">{label}</p>
    <p className={`truncate text-sm font-bold ${value ? "" : "text-[var(--muted)]"}`}>{value || "Not set"}</p>
  </div>
);

export const BudgetHeader = ({ boat, onBoatChange }) => {
  const [open, setOpen] = useState(false);
  const missing = !(boat.make || "").trim() || !(boat.model || "").trim();
  return (
    <div className="flex flex-col gap-2" data-testid="budget-header">
      <div className="grid grid-cols-3 gap-2">
        <Fact label="Boat type" value={boat.boat_type} testId="budget-boat-type" />
        <Fact label="Make" value={boat.make} testId="budget-boat-make" />
        <Fact label="Model" value={boat.model} testId="budget-boat-model" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={`${missing ? "btn-solid" : "btn-ghost"} h-10 min-h-0 gap-1.5 px-3 text-sm`} onClick={() => setOpen(true)} data-testid="budget-edit-details-btn">
          <Pencil className="h-4 w-4" /> {missing ? "Fill in make and model" : "Edit make and model"}
        </button>
        <label className="flex items-center gap-2" htmlFor="budget-currency">
          <span className="field-label">Currency</span>
          <select id="budget-currency" value={boat.budget_currency || ""} onChange={(e) => onBoatChange("budget_currency", e.target.value)}
            className="field-input !h-10 !w-28 py-0 text-sm" data-testid="budget-currency-select">
            <option value="">Pick...</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <AdditionalDetailsDialog open={open} boat={boat} onChange={onBoatChange} onClose={() => setOpen(false)} />
    </div>
  );
};
