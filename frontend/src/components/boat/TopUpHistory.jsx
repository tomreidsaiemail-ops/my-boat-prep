import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Receipt } from "lucide-react";
import { api } from "@/lib/api";

const money = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "nzd").toUpperCase() }).format(amount || 0); } catch { return `${amount}`; }
};

// Past Magic top-ups with links to their Stripe receipts, shown in My plan.
export const TopUpHistory = () => {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/payments/topups").then(({ data }) => setRows(data)).catch(() => setRows("error")); }, []);
  return (
    <section className="flex flex-col gap-2 border-t border-[var(--line)] pt-3" data-testid="topup-history">
      <h3 className="flex items-center gap-1.5 text-sm font-extrabold"><Receipt className="h-4 w-4" /> Magic top-ups</h3>
      {!rows && <Loader2 className="h-4 w-4 animate-spin" />}
      {rows === "error" && <p className="text-xs text-[var(--red)]" data-testid="topup-history-error">Couldn't load your top-ups. Check your signal and try again.</p>}
      {Array.isArray(rows) && rows.length === 0 && <p className="text-xs text-[var(--muted)]" data-testid="topup-history-empty">No top-ups yet.</p>}
      {Array.isArray(rows) && rows.length > 0 && (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.session_id} className="flex items-center gap-2" data-testid={`topup-row-${r.session_id}`}>
              <span className="w-24 shrink-0 text-xs text-[var(--muted)]">{r.date ? new Date(r.date).toLocaleDateString() : ""}</span>
              <span className="flex-1 font-semibold">+{r.pack_size} Magic</span>
              <span className="text-xs">{money(r.amount, r.currency)}</span>
              {r.receipt_url
                ? <a href={r.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--blue)] underline" data-testid={`topup-receipt-${r.session_id}`}>Receipt<ExternalLink className="h-3 w-3" /></a>
                : <span className="text-xs text-[var(--muted)]">No receipt yet</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
