import { useState } from "react";

// `label` is what shows (e.g. 5.2); `pos`/`total` are the position the typed number refers to (sub-items count within their group).
export const OrderNumber = ({ id, pos, total, onPlace, onPath, label = pos, prefix = "checklist-item" }) => {
  const [value, setValue] = useState(null);
  const commit = () => {
    const raw = String(value ?? "").trim();
    const parts = String(label).split(".");
    const typed = raw.split(".");
    setValue(null);
    // With onPath, a full number like 10.2.1 moves the item anywhere it fits; otherwise dotted numbers only work under the same parent.
    if (onPath && typed.length > 1) { if (raw !== String(label)) onPath(raw); return; }
    const n = typed.length > 1 ? (typed.length === parts.length && typed.slice(0, -1).join(".") === parts.slice(0, -1).join(".") ? Number(typed[typed.length - 1]) : NaN) : Number(raw);
    if (Number.isInteger(n) && n >= 1 && n !== pos) onPlace(Math.min(n, total));
    else if (raw && !Number.isInteger(n) && onPath) onPath(raw);
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
      aria-label={onPath ? `New position, e.g. ${pos} or 10.2.1` : `New position, 1 to ${total}`} className="order-num order-num-input" data-testid={`${prefix}-number-input-${id}`} />
  );
};
