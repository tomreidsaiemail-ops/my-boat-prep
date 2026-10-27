import { Fragment, useState } from "react";
import { FileDown, Gauge, Loader2, Lock, Trash2, Zap } from "lucide-react";
import { ValidationBar } from "@/components/boat/ActionBar";
import { ServiceDue } from "@/components/boat/ServiceDue";

const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

const KINDS = {
  engine_log: {
    title: "Engine Service History", Icon: Gauge, prefix: "engine", panelId: "engine-hours-panel", fieldId: "engine-hours-input", errorId: "engine-hours-error",
    field: "hours", fieldLabel: "Engine hours", placeholder: "e.g. 1250", numeric: true, missing: "Enter the engine hours", notesHint: "e.g. 250hr service", dueLabel: "Engine service",
    summary: (e) => <><b className="font-mono">{e.hours} hrs</b> · {fmtDate(e.date)}</>,
  },
  electrical_log: {
    title: "Electrical Service History", Icon: Zap, prefix: "electrical", panelId: "electrical-service-panel", fieldId: "electrical-name-input", errorId: "electrical-name-error",
    field: "electrician", fieldLabel: "Electrician's name", placeholder: "e.g. Sam Watts", numeric: false, missing: "Enter the electrician's name", notesHint: "e.g. house battery 12.4V, replaced fuse", dueLabel: "Electrical service",
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

const EngineTypeHead = ({ type }) => (
  <li className="bg-[var(--panel)] px-3 py-1.5 text-sm" data-testid="engine-type-heading"><span className="field-label">Engine type </span><b>{type}</b></li>
);

export const ServiceLogPanel = ({ kind, entries, today, ticked, warn, onAdd, onDelete, due, onSetDue, dueWarn, onExport, locked, exporting }) => {
  const k = KINDS[kind];
  const engine = kind === "engine_log";
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const last = sorted[0];
  const [engineType, setEngineType] = useState(() => sorted.find((e) => e.engine_type)?.engine_type || "");

  const submit = (e) => {
    e.preventDefault();
    const v = k.numeric ? Number(value) : value.trim();
    if (!String(value).trim() || (k.numeric && (Number.isNaN(v) || v < 0))) { setError(k.missing); return; }
    const type = engine && engineType.trim() ? { engine_type: engineType.trim() } : {};
    if (onAdd({ id: Date.now(), [k.field]: v, date, notes: notes.trim(), ...type }) === false) return;
    setValue(""); setNotes(""); setError("");
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid={k.panelId}>
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-2 font-display text-base font-extrabold"><k.Icon className="h-5 w-5" /> {k.title}</span>
        <button type="button" className="btn-ghost h-10 shrink-0 px-3 text-sm" onClick={onExport} disabled={exporting} data-testid={`${k.prefix}-export-btn`}>
          {locked ? <Lock className="h-4 w-4" data-testid={`${k.prefix}-export-lock`} /> : exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Export PDF
        </button>
      </div>
      <div className="text-sm" data-testid={`${k.prefix}-last-service`}>
        <span className="field-label">Last service </span>
        {last ? <b>{k.numeric ? `${last.hours} hrs on ${fmtDate(last.date)}` : `by ${last.electrician} on ${fmtDate(last.date)}`}</b>
          : <span className="font-semibold text-[var(--muted)]">none logged yet</span>}
      </div>
      <ServiceDue prefix={k.prefix} label={k.dueLabel} due={due} today={today} onSet={onSetDue} warn={dueWarn} />
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <div className={`col-span-2 grid gap-2 ${engine ? "grid-cols-[1.25fr_0.85fr_1.4fr] items-end" : "grid-cols-2"}`}>
        {engine && <label className="flex min-w-0 flex-col gap-1"><span className="field-label">Engine type</span>
          <input value={engineType} onChange={(e) => setEngineType(e.target.value)} maxLength={80} placeholder="e.g. Yanmar 3JH" className="field-input min-w-0 px-2 text-sm" data-testid="engine-type-input" /></label>}
        <label className="flex min-w-0 flex-col gap-1"><span className="field-label">{k.fieldLabel}</span>
          <input type={k.numeric ? "number" : "text"} inputMode={k.numeric ? "decimal" : "text"} min="0" step="0.1" maxLength={80} value={value}
            onChange={(e) => setValue(e.target.value)} placeholder={k.placeholder} className={`field-input min-w-0 ${engine ? "px-1.5 text-sm" : ""}`} data-testid={k.fieldId} /></label>
        <label className="flex min-w-0 flex-col gap-1"><span className="field-label">Service date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`field-input min-w-0 ${engine ? "px-1.5 text-sm" : ""}`} data-testid={`${k.prefix}-date-input`} /></label>
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder={`Notes (optional) ${k.notesHint}`} className="field-input col-span-2" data-testid={`${k.prefix}-notes-input`} />
        <p className="col-span-2 text-sm" data-testid={`${k.prefix}-ticked-summary`}>
          {ticked.length ? <><span className="field-label">Will log </span><b>{ticked.join(" · ")}</b></> : <span className="text-[var(--muted)]">No items ticked. Tick the jobs you did in the list below to add them to the history.</span>}
        </p>
        {error && <div role="alert" className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid={k.errorId}>{error}</div>}
        <div className="col-span-2"><ValidationBar show={warn} testId={`${k.prefix}-validation-bar`} /></div>
        <button type="submit" className="btn-solid col-span-2" data-testid={`${k.prefix}-log-add-btn`}>Log Service</button>
      </form>
      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-md border border-[var(--line)]" data-testid={`${k.prefix}-log-list`}>
          {sorted.map((e, i) => (
            <Fragment key={e.id}>
              {engine && e.engine_type && e.engine_type !== sorted[i - 1]?.engine_type && <EngineTypeHead type={e.engine_type} />}
              <Entry e={e} k={k} onDelete={onDelete} />
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
};
