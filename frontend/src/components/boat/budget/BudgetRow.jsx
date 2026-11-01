import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";
import { ageTone } from "@/lib/budget";

const COST_RE = /^\d{0,9}([.,]\d{0,2})?$/;
const TONES = { orange: "bg-orange-100", red: "bg-red-100" };

const Cell = ({ value, onSave, testId, filter, ...rest }) => {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  return (
    <input value={v} onChange={(e) => (!filter || filter.test(e.target.value)) && setV(e.target.value)} data-testid={testId}
      onBlur={() => { const next = v.trim(); if (next !== (value || "")) onSave(next); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="budget-cell" {...rest} />
  );
};

export const BudgetRow = ({ item, onChange, onLink, onDelete }) => {
  const tone = ageTone(item);
  const id = item.id;
  return (
    <tr className={`border-t border-[var(--line)] ${TONES[tone] || ""}`} data-testid={`budget-row-${id}`} data-tone={tone || "none"}>
      <td className={`sticky left-0 z-10 p-1 ${TONES[tone] || "bg-white"}`}><Cell value={item.label} placeholder="Description" maxLength={200} aria-label="Description" testId={`budget-desc-${id}`} onSave={(v) => onChange({ label: v })} /></td>
      <td className="p-1"><Cell value={item.product} placeholder="Product" maxLength={200} aria-label="Product" testId={`budget-product-${id}`} onSave={(v) => onChange({ product: v })} /></td>
      <td className="p-1 text-center">
        <button type="button" onClick={onLink} aria-label={item.url ? "Open the reorder store" : "Add a reorder store link"} title={item.url || "Add a reorder store link"}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border-[1.5px] [transition:background-color_.15s] ${item.url ? "border-[#7c4a1e] bg-[#7c4a1e] text-white" : "border-dashed border-[var(--line)] text-[var(--muted)] hover:bg-slate-100"}`}
          data-testid={`budget-url-btn-${id}`} data-has-url={item.url ? "yes" : "no"}>
          <Link2 className="h-4 w-4" />
        </button>
      </td>
      <td className="p-1"><input type="date" value={item.paid || ""} onChange={(e) => onChange({ paid: e.target.value })} aria-label="Date paid" className="budget-cell" data-testid={`budget-date-${id}`} /></td>
      <td className="p-1"><Cell value={item.cost} placeholder="0.00" inputMode="decimal" filter={COST_RE} aria-label="Cost" testId={`budget-cost-${id}`} className="budget-cell text-right font-mono" onSave={(v) => onChange({ cost: v.replace(",", ".") })} /></td>
      <td className="p-1 text-center">
        <button type="button" onClick={onDelete} aria-label={`Delete ${item.label || "budget item"}`} className="inline-flex h-9 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--red)]" data-testid={`budget-delete-${id}`}>
          <X className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};
