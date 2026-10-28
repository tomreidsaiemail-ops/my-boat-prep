import { useState } from "react";
import { Check, Plus } from "lucide-react";

export const RolePicker = ({ options, selected, onChange }) => {
  const [custom, setCustom] = useState("");
  const all = [...options, ...selected.filter((r) => !options.some((o) => o.toLowerCase() === r.toLowerCase()))];
  const isOn = (r) => selected.some((s) => s.toLowerCase() === r.toLowerCase());
  const toggle = (r) => onChange(isOn(r) ? selected.filter((s) => s.toLowerCase() !== r.toLowerCase()) : [...selected, r]);
  const add = () => {
    const r = custom.replace(/\s+/g, " ").trim().slice(0, 40);
    if (r && !isOn(r)) onChange([...selected, r]);
    setCustom("");
  };
  return (
    <div className="flex flex-col gap-2" data-testid="crew-role-picker">
      <span className="field-label">Crew roles</span>
      {all.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {all.map((r, i) => (
            <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={isOn(r)} data-testid={`crew-role-chip-${i}`}
              className={`flex items-center gap-1 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold [transition:background-color_.15s,color_.15s] ${isOn(r) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"}`}>
              {isOn(r) && <Check className="h-3.5 w-3.5" />}{r}
            </button>
          ))}
        </div>
      ) : <p className="text-xs text-[var(--muted)]" data-testid="crew-roles-empty">Add roles to your Crew Roles list, or type one below.</p>}
      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={40} placeholder="Add another role, e.g. Fish Whisperer"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="field-input min-w-0 flex-1 text-base normal-case tracking-normal" data-testid="crew-role-custom-input" />
        <button type="button" className="btn-ghost h-11 px-3" onClick={add} aria-label="Add role" data-testid="crew-role-add-btn"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
};
