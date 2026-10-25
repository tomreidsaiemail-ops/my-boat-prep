import { ArrowDown, ArrowRight, ArrowUp, Link2 } from "lucide-react";
import { OrderNumber } from "@/components/boat/OrderNumber";

export const MoveRow = ({ row, n, total, target, targets, ordering, onChange, onTarget, onShift, onPlace }) => (
  <li className={`flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2 ${row.pick ? "" : "opacity-60"}`} data-testid={`move-row-${n}`}>
    <div className="flex items-center gap-2">
      {ordering && <OrderNumber id={row.key} pos={n + 1} total={total} onPlace={onPlace} prefix="move-row" />}
      <input type="checkbox" checked={row.pick} onChange={(e) => onChange({ pick: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--navy)]"
        aria-label={`Move ${row.name}`} data-testid={`move-row-pick-${n}`} />
      <span className="item-text min-w-0 flex-1 break-words" data-testid={`move-row-name-${n}`}>
        {row.kind === "link" && <Link2 className="mr-1 inline h-4 w-4 text-sky-700" aria-label="From a checklist" />}{row.name}
        {row.kind === "item" && <span className="ml-1 font-mono text-sm font-bold text-[var(--muted)]">&times;{row.max}</span>}
      </span>
      {ordering && (
        <span className="flex shrink-0">
          <button type="button" className="prio-btn" onClick={() => onShift(-1)} disabled={n === 0} aria-label="Move up" data-testid={`move-row-up-${n}`}><ArrowUp className="h-5 w-5" /></button>
          <button type="button" className="prio-btn" onClick={() => onShift(1)} disabled={n === total - 1} aria-label="Move down" data-testid={`move-row-down-${n}`}><ArrowDown className="h-5 w-5" /></button>
        </span>
      )}
    </div>
    {row.pick && (
      <div className="flex items-center gap-2">
        {row.kind === "item" && (
          <label className="flex shrink-0 items-center gap-1 text-sm font-semibold">
            <input value={row.qty} inputMode="numeric" onChange={(e) => onChange({ qty: e.target.value.replace(/\D/g, "") })} disabled={row.max === 1}
              className="field-input h-10 !w-14 px-2 text-center disabled:bg-slate-100 disabled:text-[var(--muted)]" aria-label={`How many of ${row.name} to move`} data-testid={`move-row-qty-${n}`} />
            <span className="text-[var(--muted)]">of {row.max}</span>
          </label>
        )}
        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--navy)]" />
        <select value={target} onChange={(e) => onTarget(e.target.value)} className="field-input h-10 min-w-0 flex-1 px-2 text-sm"
          aria-label={`Target boat area for ${row.name}`} data-testid={`move-row-target-${n}`}>
          {targets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
    )}
  </li>
);
