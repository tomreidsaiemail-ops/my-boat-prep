import { attrText } from "@/lib/maint";

// Step 3: what will be created, before anything is saved. Empty tabs are listed but skipped.
export const ImportPreview = ({ built, empty }) => (
  <div className="flex flex-col gap-3" data-testid="import-preview">
    {built.map((b, n) => {
      const cols = b.defs.slice(0, 2);
      const rows = b.items.filter((i) => i.indent);
      return (
        <section key={n} className="flex min-w-0 flex-col gap-1.5 rounded-md border p-2.5" data-testid={`import-preview-list-${n}`}>
          <p className="text-sm font-extrabold">{b.name}</p>
          <p className="text-xs text-[var(--muted)]">{rows.length} {rows.length === 1 ? "item" : "items"} · {b.defs.length} {b.defs.length === 1 ? "attribute" : "attributes"}{b.defs.length ? `: ${b.defs.map((d) => d.name).join(", ")}` : ""}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr><th className="py-1 pr-2">Description</th>{cols.map((c) => <th key={c.key} className="py-1 pr-2">{c.name}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 5).map((i) => (
                  <tr key={i.id} className="border-t"><td className="py-1 pr-2">{i.label}</td>{cols.map((c) => <td key={c.key} className="py-1 pr-2">{attrText(c, i.attrs)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <p className="text-xs text-[var(--muted)]">...and {rows.length - 5} more</p>}
        </section>
      );
    })}
    {empty.length > 0 && (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="import-preview-empty">
        <p className="font-bold">Empty tabs, skipped:</p>
        <ul className="list-disc pl-5">{empty.map((t, n) => <li key={n}>{t.file}{t.tab !== t.file ? ` - ${t.tab}` : ""}</li>)}</ul>
      </div>
    )}
  </div>
);
