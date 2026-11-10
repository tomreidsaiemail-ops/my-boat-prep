import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const HOLD_MS = 450;

// "Done" tick; hover (or press and hold on a phone) shows which crew member ticked it.
export const TickBadge = ({ item }) => {
  const [held, setHeld] = useState(false);
  const timer = useRef(null);
  const fired = useRef(false);
  const by = String(item.checked_by || "").trim();
  if (!by) return <span className="tick-badge" data-testid={`checklist-item-ticked-${item.id}`}><CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> Done</span>;
  const stop = () => clearTimeout(timer.current);
  const start = () => {
    fired.current = false;
    stop();
    timer.current = setTimeout(() => { fired.current = true; setHeld(true); setTimeout(() => setHeld(false), 3000); }, HOLD_MS);
  };
  // A press and hold shows the name without also unticking the item.
  const swallow = (e) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } };
  return (
    <span className="tick-badge group select-none [-webkit-touch-callout:none]" title={`Ticked by ${by}`} data-testid={`checklist-item-ticked-${item.id}`} data-ticked-by={by}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClickCapture={swallow} onContextMenu={(e) => e.preventDefault()}>
      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> Done
      <span className={`whitespace-nowrap normal-case tracking-normal ${held ? "inline" : "hidden [@media(hover:hover)]:group-hover:inline"}`} data-testid={`checklist-item-ticked-by-${item.id}`}>· Ticked by {by}</span>
    </span>
  );
};

// Ticks that changed carry who ticked them (crew name), or lose any old name (skipper's own ticks).
export const stampTicks = (before, after, by) => {
  const was = new Map(before.map((i) => [i.id, !!i.checked]));
  return after.map((i) => {
    if (!was.has(i.id) || was.get(i.id) === !!i.checked) return i;
    const { checked_by, ...rest } = i; // eslint-disable-line no-unused-vars
    return i.checked && by ? { ...rest, checked_by: by } : rest;
  });
};
