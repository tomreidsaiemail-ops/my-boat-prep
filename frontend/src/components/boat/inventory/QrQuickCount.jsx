import { AlertTriangle, CircleCheck } from "lucide-react";
import { quickCount } from "@/lib/qrStock";

// Shown after a QR card save: "Fridge now holds 17 items", with anything down to 1 or none left highlighted.
export const QrQuickCount = ({ area, items, onDone }) => {
  const c = quickCount(items);
  return (
    <div className="flex flex-col gap-3" data-testid="qr-quick-count">
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3">
        <CircleCheck className="h-10 w-10 shrink-0 text-[var(--green)]" />
        <div>
          <p className="font-display text-lg font-extrabold leading-tight" data-testid="qr-quick-count-total">{area.name} now holds {c.total} {c.total === 1 ? "item" : "items"}</p>
          <p className="text-xs text-[var(--muted)]">{c.lines} different {c.lines === 1 ? "thing" : "things"} in place</p>
        </div>
      </div>
      {c.low.length > 0 ? (
        <div className="flex flex-col gap-1.5" data-testid="qr-quick-count-low">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-800"><AlertTriangle className="h-4 w-4" /> Low stock ({c.low.length})</p>
          <ul className="flex flex-col gap-1">
            {c.low.map((i, n) => (
              <li key={i.id || n} className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-bold ${i.left ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`} data-testid={`qr-quick-count-low-${n}`}>
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="shrink-0 pl-2 text-xs">{i.left ? "Only 1 left" : "None left"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-sm font-semibold text-emerald-800" data-testid="qr-quick-count-ok">Nothing is running low.</p>}
      <button type="button" className="btn-solid h-12 justify-center" onClick={onDone} data-testid="qr-quick-count-done-btn">Done</button>
    </div>
  );
};
