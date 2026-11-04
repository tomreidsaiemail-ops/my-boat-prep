import { TYPE_OPTIONS } from "@/components/boat/maint/CustomListBuilder";

const TYPES = TYPE_OPTIONS.filter(([t]) => t !== "image" && t !== "pdf");

// Step 2: every tab's columns with a type each (default Text). The first column becomes the item description.
export const ImportColumns = ({ plan, onChange }) => (
  <div className="flex flex-col gap-3" data-testid="import-columns">
    {plan.map((t, n) => (
      <section key={`${t.file}-${t.tab}-${n}`} className="flex min-w-0 flex-col gap-2 rounded-md border bg-[var(--panel)] p-2.5" data-testid={`import-tab-${n}`}>
        <p className="text-xs font-bold text-[var(--muted)]">{t.file}{t.tab !== t.file ? ` · tab "${t.tab}"` : ""}</p>
        {t.empty ? <p className="text-sm font-semibold text-amber-800" data-testid={`import-tab-empty-${n}`}>Empty tab: it will be skipped.</p> : (
          <>
            <label className="flex flex-col gap-1">
              <span className="field-label">List name</span>
              <input value={t.name} maxLength={80} onChange={(e) => onChange(n, { name: e.target.value })} className="field-input h-10 !text-sm" data-testid={`import-name-${n}`} />
            </label>
            <ul className="flex flex-col gap-1.5">
              {t.headers.map((h, c) => (
                <li key={c} className="flex items-center gap-2" data-testid={`import-col-${n}-${c}`}>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{h}</span>
                  {c === 0 ? <span className="shrink-0 text-xs font-bold text-[var(--muted)]">Item description</span> : (
                    <select value={t.types[c]} onChange={(e) => onChange(n, { types: t.types.map((x, k) => (k === c ? e.target.value : x)) })}
                      className="field-input h-9 !w-40 shrink-0 !px-2 !text-sm" aria-label={`Type for ${h}`} data-testid={`import-type-${n}-${c}`}>
                      {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)]">{t.rows.length} {t.rows.length === 1 ? "row" : "rows"}{t.cut ? " (only the first 2000 are imported)" : ""}</p>
          </>
        )}
      </section>
    ))}
  </div>
);
