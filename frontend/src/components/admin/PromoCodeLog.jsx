import { ScrollText } from "lucide-react";

const when = (iso) => new Date(iso).toLocaleString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Auckland" });
const tone = { created: "text-emerald-800", edited: "text-sky-800", deleted: "text-[var(--red)]" };

// Who created, edited or deleted which promo code, newest first.
export const PromoCodeLog = ({ log = [] }) => (
  <section className="flex flex-col gap-2" data-testid="promo-log">
    <h3 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]"><ScrollText className="h-4 w-4" /> Change log</h3>
    <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white text-xs" data-testid="promo-log-list">
      {log.length === 0 && <li className="p-3 text-[var(--muted)]" data-testid="promo-log-empty">No changes logged yet</li>}
      {log.map((l, k) => (
        <li key={`${l.at}-${k}`} className="border-b border-[var(--line)] p-2.5 last:border-b-0" data-testid={`promo-log-row-${k}`}>
          <span className="text-[var(--muted)]">{when(l.at)} · {l.by}</span>
          <p><b className="font-mono">{l.code}</b> <b className={tone[l.action] || ""}>{l.action}</b>: {l.detail}</p>
        </li>
      ))}
    </ul>
  </section>
);
