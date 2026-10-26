import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

const statusOf = (due, today) => {
  if (due.checked) return { cls: "bg-slate-100 text-slate-700", text: `${fmtDate(due.due)} · ticked off in My To Do List` };
  const days = Math.round((Date.parse(due.due) - Date.parse(today)) / 86400000);
  if (days < 0) return { cls: "bg-red-50 text-red-800", text: `${fmtDate(due.due)} · overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "overdue" };
  const when = days === 0 ? "due today" : `in ${days} day${days === 1 ? "" : "s"}`;
  return days <= 30 ? { cls: "bg-amber-50 text-amber-900", text: `${fmtDate(due.due)} · ${when}`, tone: "soon" } : { cls: "bg-emerald-50 text-emerald-900", text: `${fmtDate(due.due)} · ${when}`, tone: "ok" };
};

// Next-service reminder: the date lives on a My To Do List item so it shows up there too.
export const ServiceDue = ({ prefix, label, due, today, onSet }) => {
  const [date, setDate] = useState(due?.due || "");
  useEffect(() => { setDate(due?.due || ""); }, [due?.due]);
  const status = due && statusOf(due, today);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--line)] p-2" data-testid={`${prefix}-due`}>
      <span className="field-label flex items-center gap-1"><BellRing className="h-4 w-4" /> Next service due</span>
      {status && <p className={`rounded px-2 py-1 text-sm font-bold ${status.cls}`} data-testid={`${prefix}-due-status`} data-tone={status.tone || "done"}>{status.text}</p>}
      <div className="flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input min-w-0 flex-1" aria-label="Next service due date" data-testid={`${prefix}-due-input`} />
        <button type="button" className="btn-ghost shrink-0 px-3" disabled={!date || date === due?.due} onClick={() => onSet(date)} data-testid={`${prefix}-due-set-btn`}>Set reminder</button>
        {due && <button type="button" className="icon-btn shrink-0 hover:text-[var(--red)]" aria-label="Remove reminder" title="Remove reminder" onClick={() => onSet(null)} data-testid={`${prefix}-due-clear-btn`}><X className="h-[18px] w-[18px]" /></button>}
      </div>
      <p className="text-xs text-[var(--muted)]">Adds &ldquo;{label} due &hellip;&rdquo; to your My To Do List.</p>
    </div>
  );
};
