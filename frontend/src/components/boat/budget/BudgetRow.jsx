import { useEffect, useState } from "react";
import { ChevronRight, CopyCheck, Link2, X } from "lucide-react";
import { mismatched, shortDate } from "@/lib/budget";
import { DatePopover } from "@/components/boat/DatePopover";

const COST_RE = /^\d{0,9}([.,]\d{0,2})?$/;
const TONES = { red: "bg-red-100" };

const Cell = ({ value, onSave, testId, filter, className = "budget-cell", ...rest }) => {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  return (
    <input value={v} onChange={(e) => (!filter || filter.test(e.target.value)) && setV(e.target.value)} data-testid={testId}
      onBlur={() => { const next = v.trim(); if (next !== (value || "")) onSave(next); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={className} {...rest} />
  );
};

// Compact dd/mm/yy text that opens a calendar limited to the budget year, so the date column stays narrow on a phone.
const DateCell = ({ value, onChange, testId, year }) => (
  <DatePopover value={value} onChange={onChange} min={`${year}-01-01`} max={`${year}-12-31`} label="Date paid" testId={testId}>
    <span className={`budget-cell flex cursor-pointer items-center overflow-hidden !px-1 font-mono !text-[13px] tracking-tight ${value ? "" : "text-slate-400"}`}>{value ? shortDate(value).replace(/\/(\d{2})(\d{2})$/, "/$2") : "Date"}</span>
  </DatePopover>
);

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const History = ({ item }) => (item.history?.length ? (
  <ul className="flex flex-col gap-0.5 pl-6 pt-1.5 text-[11px] text-[var(--muted)]" data-testid={`budget-history-${item.id}`}>
    <li className="field-label">Change history</li>
    {[...item.history].reverse().map((h, n) => (
      <li key={n}>{h.field === "Created" ? h.to : `${h.field} ${(h.field === "Date paid" ? shortDate(h.from) : h.from) || "(blank)"} to ${(h.field === "Date paid" ? shortDate(h.to) : h.to) || "(blank)"}`}, {when(h.at)}</li>
    ))}
  </ul>
) : null);

export const BudgetRow = ({ item, open, onOpen, onChange, onLink, onDelete, onQuickApply, year }) => {
  const tone = mismatched(item, year) ? "red" : "";
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
        <td className="p-1"><DateCell value={item.paid} year={year} onChange={(v) => onChange({ paid: v })} testId={`budget-date-${id}`} /></td>
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
              <button type="button" onClick={onQuickApply} disabled={!String(item.cost || "").trim() || !item.label?.trim()} title="Use this cost for this item in every budget year"
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border-[1.5px] border-[var(--navy)] bg-white px-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40" data-testid={`budget-quick-apply-btn-${id}`}>
                <CopyCheck className="h-4 w-4" /> Quick apply
              </button>
            </div>
            {tone && <p className="pl-6 pt-1 text-[11px] font-bold text-[var(--red)]" data-testid={`budget-mismatch-${id}`}>This row doesn't belong to {year}. Pick a {year} date or delete it.</p>}
            <History item={item} />
          </td>
        </tr>
      )}
    </>
  );
};
