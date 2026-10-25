import { useState } from "react";

export const OrderNumber = ({ id, pos, total, onPlace, prefix = "checklist-item" }) => {
  const [value, setValue] = useState(null);
  const commit = () => {
    const n = Number(value);
    setValue(null);
    if (Number.isInteger(n) && n >= 1 && n !== pos) onPlace(Math.min(n, total));
  };
  if (value === null) {
    return (
      <button type="button" className="order-num" onClick={() => setValue(String(pos))} aria-label={`Item ${pos} of ${total}, tap to change position`}
        title="Change position" data-testid={`${prefix}-number-${id}`}>{pos}</button>
    );
  }
  return (
    <input type="number" inputMode="numeric" min={1} max={total} value={value} autoFocus onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setValue(null); }}
      aria-label={`New position, 1 to ${total}`} className="order-num order-num-input" data-testid={`${prefix}-number-input-${id}`} />
  );
};
