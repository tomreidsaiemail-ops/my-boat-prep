import { useState } from "react";

// `label` is what shows (e.g. 5.2); `pos`/`total` are the position the typed number refers to (sub-items count within their group).
export const OrderNumber = ({ id, pos, total, onPlace, label = pos, prefix = "checklist-item" }) => {
  const [value, setValue] = useState(null);
  const commit = () => {
    const raw = String(value ?? "").trim();
    const parts = String(label).split(".");
    const typed = raw.split(".");
    // "6.1.2" is only accepted on an item under 6.1; any item takes a plain number for its position among its own level.
    const n = typed.length > 1 ? (typed.length === parts.length && typed.slice(0, -1).join(".") === parts.slice(0, -1).join(".") ? Number(typed[typed.length - 1]) : NaN) : Number(raw);
    setValue(null);
    if (Number.isInteger(n) && n >= 1 && n !== pos) onPlace(Math.min(n, total));
  };
  if (value === null) {
    const len = String(label).length;
    return (
      <button type="button" className={`order-num ${len > 5 ? "!w-auto !min-w-[3rem] px-1.5" : len > 3 ? "!w-12" : ""}`} onClick={() => setValue(String(pos))}
        aria-label={`Item ${label}, tap to change position`} title="Change position" data-testid={`${prefix}-number-${id}`}>{label}</button>
    );
  }
  return (
    <input type="text" inputMode="decimal" value={value} autoFocus onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setValue(null); }}
      aria-label={`New position, 1 to ${total}`} className="order-num order-num-input" data-testid={`${prefix}-number-input-${id}`} />
  );
};
