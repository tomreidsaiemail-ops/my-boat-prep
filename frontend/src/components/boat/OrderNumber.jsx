import { useState } from "react";

// `label` is what shows (e.g. 5.2); `pos`/`total` are the position the typed number refers to (sub-items count within their group).
export const OrderNumber = ({ id, pos, total, onPlace, label = pos, prefix = "checklist-item" }) => {
  const [value, setValue] = useState(null);
  const commit = () => {
    const raw = String(value ?? "").trim();
    const [parent, sub] = String(label).split(".");
    // "5.2" is only accepted on a sub-item of 5; top-level items take a plain number.
    const n = raw.includes(".") ? (sub !== undefined && raw.split(".")[0] === parent ? Number(raw.split(".")[1]) : NaN) : Number(raw);
    setValue(null);
    if (Number.isInteger(n) && n >= 1 && n !== pos) onPlace(Math.min(n, total));
  };
  if (value === null) {
    return (
      <button type="button" className={`order-num ${String(label).length > 3 ? "!w-12" : ""}`} onClick={() => setValue(String(pos))}
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
