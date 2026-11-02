import { useEffect, useState } from "react";
import { ChevronRight, Link2, X } from "lucide-react";
import { ageTone, shortDate } from "@/lib/budget";

const COST_RE = /^\d{0,9}([.,]\d{0,2})?$/;
const TONES = { orange: "bg-orange-100", red: "bg-red-100" };

const Cell = ({ value, onSave, testId, filter, className = "budget-cell", ...rest }) => {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  return (
    <input value={v} onChange={(e) => (!filter || filter.test(e.target.value)) && setV(e.target.value)} data-testid={testId}
      onBlur={() => { const next = v.trim(); if (next !== (value || "")) onSave(next); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={className} {...rest} />
  );
};

// Compact dd/mm/yy text over an invisible native date picker, so the date column stays narrow on a phone.
const DateCell = ({ value, onChange, testId }) => (
  <span className="relative block">
    <span className={`budget-cell flex items-center overflow-hidden !px-1 font-mono !text-[13px] tracking-tight ${value ? "" : "text-slate-400"}`}>{value ? shortDate(value).replace(/\/(\d{2})(\d{2})$/, "/$2") : "Date"}</span>
    <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} aria-label="Date paid"
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-testid={testId} />
  </span>
);

export const BudgetRow = ({ item, open, onOpen, onChange, onLink, onDelete }) => {
  const tone = ageTone(item);
  const id = item.id;
  const extra = !!(item.product || item.url);
  return (
    <>
      <tr className={`border-t border-[var(--line)] ${TONES[tone] || ""}`} data-testid={`budget-row-${id}`} data-tone={tone || "none"}>
        <td className="p-1">
          <div className="flex items-center">
            <button type="button" onClick={onOpen} aria-expanded={open} aria-label={open ? "Hide product and web link" : "Show product and web link"} data-testid={`budget-expand-${id}`}
              className={`inline-flex h-9 w-6 shrink-0 items-center justify-center ${extra ? "text-[var(--navy)]" : "text-slate-400"}`}>
              <ChevronRight className={`h-4 w-4 [transition:transform_.15s] ${open ? "rotate-90" : ""}`} />
            </button>
            <Cell value={item.label} placeholder="Description" maxLength={200} aria-label="Description" testId={`budget-desc-${id}`} onSave={(v) => onChange({ label: v })} />
          </div>
        </td>
        <td className="p-1"><DateCell value={item.paid} onChange={(v) => onChange({ paid: v })} testId={`budget-date-${id}`} /></td>
        <td className="p-1"><Cell value={item.cost} placeholder="0.00" inputMode="decimal" filter={COST_RE} aria-label="Cost" testId={`budget-cost-${id}`} className="budget-cell text-right font-mono" onSave={(v) => onChange({ cost: v.replace(",", ".") })} /></td>
        <td className="p-0 text-center">
          <button type="button" onClick={onDelete} aria-label={`Delete ${item.label || "budget item"}`} className="inline-flex h-9 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--red)]" data-testid={`budget-delete-${id}`}>
            <X className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {open && (
        <tr className={TONES[tone] || ""} data-testid={`budget-details-${id}`}>
          <td colSpan={4} className="px-1 pb-2">
            <div className="flex items-center gap-2 pl-6">
              <Cell value={item.product} placeholder="Description - Product/Organisation" maxLength={200} aria-label="Product" testId={`budget-product-${id}`} className="budget-cell !border-[var(--line)] bg-white placeholder:text-[12px] placeholder:tracking-tight" onSave={(v) => onChange({ product: v })} />
              <button type="button" onClick={onLink} aria-label={item.url ? "Open the web link" : "Add a web link"} title={item.url || "Add a web link"}
                className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-md border-[1.5px] px-2 text-xs font-bold [transition:background-color_.15s] ${item.url ? "border-[#7c4a1e] bg-[#7c4a1e] text-white" : "border-dashed border-[var(--line)] bg-white text-[var(--muted)] hover:bg-slate-100"}`}
                data-testid={`budget-url-btn-${id}`} data-has-url={item.url ? "yes" : "no"}>
                <Link2 className="h-4 w-4" /> {item.url ? "Web link" : "Add web link"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
