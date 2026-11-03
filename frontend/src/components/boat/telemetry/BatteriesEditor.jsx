import { Plus, X } from "lucide-react";
import { CHEMS, ROLES, batteriesOf } from "@/lib/telemetry";

const Select = ({ value, onChange, options, testId, label }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="field-input !h-10 min-w-0 px-1.5 text-sm" data-testid={testId}>
    {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
);

const BatteryRow = ({ b, onChange, onDelete }) => (
  <li className="flex flex-col gap-2 rounded-md border-[1.5px] border-[var(--line)] p-2.5" data-testid={`battery-${b.id}`}>
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-sm font-extrabold">{ROLES[b.role]}</span>
      {b.role === "portable" && (
        <button type="button" onClick={onDelete} aria-label="Remove this battery" className="icon-btn h-8 w-8 text-[var(--muted)] hover:text-[var(--red)]" data-testid={`battery-delete-${b.id}`}><X className="h-4 w-4" /></button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <input value={b.make} onChange={(e) => onChange({ make: e.target.value })} maxLength={60} placeholder="Make, e.g. Victron" aria-label="Battery make" className="field-input !h-10 px-2 text-sm" data-testid={`battery-make-${b.id}`} />
      <input value={b.ah} onChange={(e) => /^\d{0,5}$/.test(e.target.value) && onChange({ ah: e.target.value })} inputMode="numeric" placeholder="Amp hours (Ah)" aria-label="Amp hours" className="field-input !h-10 px-2 text-sm" data-testid={`battery-ah-${b.id}`} />
      <Select value={b.volts} onChange={(v) => onChange({ volts: v })} label="Voltage" testId={`battery-volts-${b.id}`} options={[["", "Voltage"], ["12", "12V"], ["24", "24V"], ["48", "48V"]]} />
      <Select value={b.chem} onChange={(v) => onChange({ chem: v })} label="Battery type" testId={`battery-chem-${b.id}`} options={[["", "Battery type"], ...Object.entries(CHEMS)]} />
    </div>
    <input value={b.notes} onChange={(e) => onChange({ notes: e.target.value })} maxLength={200} placeholder="Capabilities, e.g. 240V inverter, USB-C, solar input" aria-label="Capabilities" className="field-input !h-10 px-2 text-sm" data-testid={`battery-notes-${b.id}`} />
  </li>
);

export const BatteriesEditor = ({ boat, onChange }) => {
  const list = batteriesOf(boat);
  const set = (next) => onChange("batteries", next);
  return (
    <div className="col-span-2 flex flex-col gap-2" data-testid="batteries-editor">
      <span className="field-label">Batteries</span>
      <ul className="flex flex-col gap-2">
        {list.map((b) => <BatteryRow key={b.id} b={b} onChange={(p) => set(list.map((x) => (x.id === b.id ? { ...x, ...p } : x)))} onDelete={() => set(list.filter((x) => x.id !== b.id))} />)}
      </ul>
      <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm" disabled={list.length >= 12}
        onClick={() => set([...list, { id: `p${Date.now()}`, role: "portable", make: "", volts: "", ah: "", chem: "", notes: "" }])} data-testid="battery-add-portable-btn">
        <Plus className="h-4 w-4" /> Add a portable battery
      </button>
    </div>
  );
};
