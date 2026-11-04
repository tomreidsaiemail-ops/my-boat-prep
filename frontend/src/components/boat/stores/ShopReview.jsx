import { Sparkles } from "lucide-react";
import { fmtWeight } from "@/lib/stores";

// Check what the MPA found; change amounts or the boat area each item goes into.
export const ShopReview = ({ rows, setRows, dests, units, scanning }) => {
  const set = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  if (!rows.length) return <p className="py-6 text-center text-sm text-[var(--muted)]" data-testid="shop-review-empty">{scanning ? "The MPA is still scanning your photos..." : "No items found yet. Go back and add photos."}</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="shop-review-rows">
      {rows.map((r) => (
        <li key={r.key} className={`flex flex-col gap-1 rounded-md border border-[var(--line)] p-2 ${r.keep ? "" : "opacity-50"}`} data-testid={`shop-row-${r.key}`}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={r.keep} onChange={(e) => set(r.key, { keep: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--navy)]" aria-label={`Keep ${r.name}`} data-testid={`shop-row-keep-${r.key}`} />
            <input value={r.name} maxLength={80} onChange={(e) => set(r.key, { name: e.target.value })} className="field-input h-10 !w-0 min-w-0 flex-1 !text-sm" aria-label="Item name" data-testid={`shop-row-name-${r.key}`} />
            <input value={r.qty} inputMode="numeric" onChange={(e) => set(r.key, { qty: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="field-input h-10 !w-14 shrink-0 !text-sm" aria-label="Quantity" data-testid={`shop-row-qty-${r.key}`} />
          </div>
          <div className="flex items-center gap-2 pl-7">
            <select value={r.dest} onChange={(e) => set(r.key, { dest: e.target.value, learned: false })} className="field-input h-9 !w-0 min-w-0 flex-1 !py-0 !text-sm" aria-label="Boat area" data-testid={`shop-row-dest-${r.key}`}>
              {dests.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span className="shrink-0 font-mono text-xs text-[var(--muted)]" data-testid={`shop-row-weight-${r.key}`}>~{fmtWeight(r.unitW * (+r.qty || 0), units)}</span>
          </div>
          {r.learned && <span className="flex items-center gap-1 pl-7 text-[11px] font-semibold text-sky-800" data-testid={`shop-row-learned-${r.key}`}><Sparkles className="h-3 w-3" /> Remembered: you put this in {dests.find((d) => d.id === r.dest)?.name} last time</span>}
        </li>
      ))}
    </ul>
  );
};
