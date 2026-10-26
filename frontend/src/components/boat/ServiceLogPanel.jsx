import { useState } from "react";
import { Gauge, Trash2, Zap } from "lucide-react";

const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

const KINDS = {
  engine_log: {
    title: "Engine Service History", Icon: Gauge, prefix: "engine", panelId: "engine-hours-panel", fieldId: "engine-hours-input", errorId: "engine-hours-error",
    field: "hours", fieldLabel: "Engine hours", placeholder: "e.g. 1250", numeric: true, missing: "Enter the engine hours",
    summary: (e) => <><b className="font-mono">{e.hours} hrs</b> · {fmtDate(e.date)}</>,
  },
  electrical_log: {
    title: "Electrical Service History", Icon: Zap, prefix: "electrical", panelId: "electrical-service-panel", fieldId: "electrical-name-input", errorId: "electrical-name-error",
    field: "electrician", fieldLabel: "Electrician's name", placeholder: "e.g. Sam Watts", numeric: false, missing: "Enter the electrician's name",
    summary: (e) => <><b>{e.electrician}</b> · {fmtDate(e.date)}</>,
  },
};

const Entry = ({ e, k, onDelete }) => (
  <li className="flex items-center gap-2 pl-3" data-testid={`${k.prefix}-log-entry-${e.id}`}>
    <div className="min-w-0 flex-1 py-2 text-sm">
      {k.summary(e)}
      {e.items?.length > 0 && <span className="block font-semibold" data-testid={`${k.prefix}-log-items-${e.id}`}>{e.items.join(" · ")}</span>}
      {e.notes && <span className="block text-[var(--muted)]">{e.notes}</span>}
    </div>
    <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete entry" onClick={() => onDelete(e.id)} data-testid={`${k.prefix}-log-delete-${e.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
  </li>
);

export const ServiceLogPanel = ({ kind, entries, today, ticked, onAdd, onDelete }) => {
  const k = KINDS[kind];
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const last = sorted[0];

  const submit = (e) => {
    e.preventDefault();
    const v = k.numeric ? Number(value) : value.trim();
    if (!String(value).trim() || (k.numeric && (Number.isNaN(v) || v < 0))) { setError(k.missing); return; }
    if (onAdd({ id: Date.now(), [k.field]: v, date, notes: notes.trim() }) === false) return;
    setValue(""); setNotes(""); setError("");
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid={k.panelId}>
      <div className="flex items-center gap-2 font-display text-base font-extrabold"><k.Icon className="h-5 w-5" /> {k.title}</div>
      <div className="text-sm" data-testid={`${k.prefix}-last-service`}>
        <span className="field-label">Last service </span>
        {last ? <b>{k.numeric ? `${last.hours} hrs on ${fmtDate(last.date)}` : `by ${last.electrician} on ${fmtDate(last.date)}`}</b>
          : <span className="font-semibold text-[var(--muted)]">none logged yet</span>}
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1"><span className="field-label">{k.fieldLabel}</span>
          <input type={k.numeric ? "number" : "text"} inputMode={k.numeric ? "decimal" : "text"} min="0" step="0.1" maxLength={80} value={value}
            onChange={(e) => setValue(e.target.value)} placeholder={k.placeholder} className="field-input" data-testid={k.fieldId} /></label>
        <label className="flex flex-col gap-1"><span className="field-label">Service date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="field-input" data-testid={`${k.prefix}-date-input`} /></label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Notes (optional) e.g. 250hr service" className="field-input col-span-2" data-testid={`${k.prefix}-notes-input`} />
        <p className="col-span-2 text-sm" data-testid={`${k.prefix}-ticked-summary`}>
          {ticked.length ? <><span className="field-label">Will log </span><b>{ticked.join(" · ")}</b></> : <span className="text-[var(--muted)]">No items ticked. Tick the jobs you did above to add them to the history.</span>}
        </p>
        {error && <div role="alert" className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid={k.errorId}>{error}</div>}
        <button type="submit" className="btn-solid col-span-2" data-testid={`${k.prefix}-log-add-btn`}>Log Service</button>
      </form>
      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-[var(--line)]" data-testid={`${k.prefix}-log-list`}>
          {sorted.map((e) => <Entry key={e.id} e={e} k={k} onDelete={onDelete} />)}
        </ul>
      )}
    </section>
  );
};
