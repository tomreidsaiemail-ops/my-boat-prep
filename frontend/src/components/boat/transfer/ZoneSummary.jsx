import { qtyText } from "@/lib/transfer";

// Every zone and cupboard opened out, so the seller can scroll the whole inventory the new owner gets.
export const ZoneSummary = ({ tree }) => (
  <div className="flex flex-col gap-3" data-testid="transfer-summary">
    {!tree.length && <p className="text-sm text-[var(--muted)]" data-testid="transfer-summary-empty">There are no cupboards on this boat yet.</p>}
    {tree.map((g, gi) => (
      <section key={g.zone + gi} className="rounded-md border-[1.5px] border-[var(--line)]" style={{ borderLeft: `6px solid ${g.hex}` }} data-testid={`transfer-summary-zone-${gi}`}>
        <h4 className="px-3 pt-2 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{g.zone} · {g.rows.length} {g.rows.length === 1 ? "cupboard" : "cupboards"}</h4>
        <ul className="flex flex-col gap-1 px-3 pb-2 pt-1">
          {g.rows.map(({ area, depth, food, items }) => (
            <li key={area.id} style={{ paddingLeft: depth * 14 }} data-testid={`transfer-summary-area-${area.id}`}>
              <p className="text-sm font-bold">{area.name || "Cupboard"}
                {food && <span className="ml-2 rounded bg-amber-100 px-1.5 text-[11px] font-extrabold text-amber-900">F&amp;D · emptied on sale</span>}
              </p>
              {food ? null : items.length
                ? <p className="text-xs text-[var(--muted)]">{items.map((i) => `${i.name}${qtyText(i)}`).join(", ")}</p>
                : <p className="text-xs italic text-[var(--muted)]">Empty</p>}
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);
