import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { WHERE_MAX } from "@/components/boat/inventory/AreaEditDialog";

// Zone screen: quickly create empty cupboards (name + optional location) to Magic Scan later in a batch.
export const QuickCupboards = ({ zone, onAdd, onDone, t }) => {
  const [name, setName] = useState("");
  const [where, setWhere] = useState("");
  const [added, setAdded] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { setName(""); setWhere(""); setAdded([]); setError(""); }, [zone.label]);
  const save = () => {
    const n = name.trim();
    if (!n) { setError("Please enter the cupboard name"); return null; }
    const res = onAdd(n.slice(0, 120), where.trim().slice(0, WHERE_MAX));
    if (typeof res === "string") { setError(res); return null; }
    setAdded((a) => [...a, { id: res.id, name: n }]);
    setName(""); setWhere(""); setError("");
    return res.id;
  };
  const add = (e) => { e.preventDefault(); save(); };
  // Done also adds a name that's typed but not added yet.
  const done = () => {
    if (name.trim() && !save()) return;
    onDone(added[0].id);
  };
  return (
    <form onSubmit={add} className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-[var(--panel)] p-3" data-testid={`${t}-quick`}>
      <b className="text-sm text-[var(--navy)]">Quick add {zone.label} cupboards</b>
      <span className="text-xs text-[var(--muted)]">Name each cupboard now and Magic Scan them later in a batch. Names only need to be unique within {zone.label}.</span>
      {added.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" data-testid={`${t}-quick-added`}>
          {added.map((a) => <li key={a.id} className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-900" data-testid={`${t}-quick-added-${a.id}`}><Check className="h-3 w-3" />{a.name}</li>)}
        </ul>
      )}
      <input value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={`Cupboard name, e.g. ${zone.label} - fire extinguisher locker`} aria-label="Cupboard name" className="field-input" data-testid={`${t}-quick-name`} />
      <input value={where} maxLength={WHERE_MAX} onChange={(e) => setWhere(e.target.value)} placeholder="Where is it? e.g. Under the port bunk (optional)" aria-label="Where the cupboard is" className="field-input" data-testid={`${t}-quick-where`} />
      {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid={`${t}-quick-error`}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-ghost h-11 flex-1 justify-center gap-1.5 text-sm" data-testid={`${t}-quick-add-btn`}><Plus className="h-4 w-4" /> {added.length ? "Add another" : "Add cupboard"}</button>
        {added.length > 0 && <button type="button" className="btn-solid h-11 flex-1 justify-center text-sm" onClick={done} data-testid={`${t}-quick-done-btn`}>Done</button>}
      </div>
    </form>
  );
};
