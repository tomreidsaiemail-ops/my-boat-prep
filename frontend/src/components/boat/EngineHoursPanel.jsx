import { useState } from "react";
import { Gauge, Trash2 } from "lucide-react";

const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

export const EngineHoursPanel = ({ entries, today, onAdd, onDelete }) => {
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.hours - a.hours);
  const last = sorted[0];

  const submit = (e) => {
    e.preventDefault();
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h < 0) { setError("Enter the engine hours"); return; }
    if (onAdd({ id: Date.now(), hours: h, date, notes: notes.trim() }) === false) return;
    setHours(""); setNotes(""); setError("");
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="engine-hours-panel">
      <div className="flex items-center gap-2 font-display text-base font-extrabold"><Gauge className="h-5 w-5" /> Engine Hours Log</div>
      <div className="text-sm" data-testid="engine-last-service">
        <span className="field-label">Last service </span>
        {last ? <b>{last.hours} hrs on {fmtDate(last.date)}</b> : <span className="font-semibold text-[var(--muted)]">none logged yet</span>}
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1"><span className="field-label">Engine hours</span>
          <input type="number" inputMode="decimal" min="0" step="0.1" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 1250" className="field-input" data-testid="engine-hours-input" /></label>
        <label className="flex flex-col gap-1"><span className="field-label">Service date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="field-input" data-testid="engine-date-input" /></label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) e.g. 250hr service" className="field-input col-span-2" data-testid="engine-notes-input" />
        {error && <div role="alert" className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="engine-hours-error">{error}</div>}
        <button type="submit" className="btn-solid col-span-2" data-testid="engine-log-add-btn">Log Service</button>
      </form>
      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-[var(--line)]" data-testid="engine-log-list">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center gap-2 pl-3" data-testid={`engine-log-entry-${e.id}`}>
              <div className="min-w-0 flex-1 py-2 text-sm"><b className="font-mono">{e.hours} hrs</b> · {fmtDate(e.date)}{e.notes && <span className="block text-[var(--muted)]">{e.notes}</span>}</div>
              <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete entry" onClick={() => onDelete(e.id)} data-testid={`engine-log-delete-${e.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
