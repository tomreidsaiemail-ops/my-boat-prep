import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, TableProperties, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { slug } from "@/lib/maint";

export const TYPE_OPTIONS = [
  ["char", "Text"], ["char(8000)", "Web link / long text"], ["picklist", "Picklist"], ["date", "Date"], ["integer", "Whole number"], ["integer age", "Age (years old)"],
  ["decimal", "Decimal number"], ["decimal length", "Length"], ["decimal area", "Area"], ["decimal weight", "Weight"], ["decimal cost", "Cost"], ["image", "Photo"], ["pdf", "PDF"],
];
const MAX_COLS = 2;
const CONDITION = { key: "condition", name: "Condition", type: "picklist", options: ["Good", "Fair", "Worn", "Replace"] };
const typeLabel = (d) => (d.type === "char" && d.max > 1000 ? "Web link / long text" : TYPE_OPTIONS.find(([t]) => t === d.type)?.[1] || "Text");
const defOf = (name, type, values, taken) => {
  let key = slug(name) || "attribute";
  for (let n = 2; taken.includes(key); n += 1) key = `${slug(name)}_${n}`;
  if (type === "picklist") return { key, name, type, options: [...new Set(values.split(",").map((v) => v.trim()).filter(Boolean))].slice(0, 60) };
  if (type.startsWith("char")) return { key, name, type: "char", max: type === "char" ? 1000 : 8000 };
  return { key, name, type };
};

const OwnAttribute = ({ taken, onAdd }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("char");
  const [values, setValues] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const n = name.trim();
    if (!n) { setError("Name the attribute first"); return; }
    if (type === "picklist" && !values.split(",").some((v) => v.trim())) { setError("Add the picklist choices, separated by commas"); return; }
    onAdd(defOf(n.slice(0, 60), type, values, taken));
    setName(""); setValues(""); setType("char"); setError("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-2.5" data-testid="builder-own">
      <span className="field-label">Make your own</span>
      <div className="flex gap-2">
        <input value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Condition" className="field-input h-10 !w-0 min-w-0 flex-1 !text-sm" aria-label="Attribute name" data-testid="builder-own-name" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="field-input h-10 !w-[132px] shrink-0 !px-1 !text-sm" aria-label="Attribute type" data-testid="builder-own-type">
          {TYPE_OPTIONS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
        </select>
      </div>
      {type === "picklist" && <input value={values} maxLength={1000} onChange={(e) => { setValues(e.target.value); setError(""); }} placeholder="Choices, e.g. Good, Fair, Worn, Replace"
        className="field-input h-10 !text-sm" aria-label="Picklist choices" data-testid="builder-own-values" />}
      {error && <p className="text-xs font-bold text-[var(--red)]" data-testid="builder-own-error">{error}</p>}
      <button type="button" onClick={add} className="btn-ghost h-9 min-h-0 self-start gap-1 px-3 text-sm" data-testid="builder-own-add-btn"><Plus className="h-4 w-4" /> Add attribute</button>
    </div>
  );
};

const Chosen = ({ list, setList }) => {
  const cols = list.filter((d) => d.col).length;
  const set = (key, p) => setList((l) => l.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const move = (n, dir) => setList((l) => { const c = [...l]; [c[n], c[n + dir]] = [c[n + dir], c[n]]; return c; });
  if (!list.length) return <p className="text-sm text-[var(--muted)]" data-testid="builder-none">No attributes yet. Pick some below or make your own.</p>;
  return (
    <ul className="flex flex-col gap-1.5" data-testid="builder-chosen">
      {list.map((d, n) => (
        <li key={d.key} className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2 py-1" data-testid={`builder-chosen-${d.key}`}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{d.name}</span>
            <span className="block truncate text-[11px] text-[var(--muted)]">{typeLabel(d)}{d.options ? `: ${d.options.join(", ")}` : ""}</span></span>
          <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold" title={`Show as a table column (up to ${MAX_COLS})`}>
            <Checkbox checked={!!d.col} disabled={!d.col && cols >= MAX_COLS} onCheckedChange={(v) => set(d.key, { col: !!v })} data-testid={`builder-col-${d.key}`} /> Column
          </label>
          <button type="button" className="icon-btn !h-8 !w-7" disabled={!n} onClick={() => move(n, -1)} aria-label="Move up" data-testid={`builder-up-${d.key}`}><ArrowUp className="h-4 w-4" /></button>
          <button type="button" className="icon-btn !h-8 !w-7" disabled={n === list.length - 1} onClick={() => move(n, 1)} aria-label="Move down" data-testid={`builder-down-${d.key}`}><ArrowDown className="h-4 w-4" /></button>
          <button type="button" className="icon-btn !h-8 !w-7 hover:text-[var(--red)]" onClick={() => setList((l) => l.filter((x) => x.key !== d.key))} aria-label={`Remove ${d.name}`} data-testid={`builder-remove-${d.key}`}><X className="h-4 w-4" /></button>
        </li>
      ))}
    </ul>
  );
};

// Name a list, choose master attributes or make your own, mark up to 2 as table columns, then Create.
export const CustomListBuilder = ({ master, names, onCreate, onClose }) => {
  const [name, setName] = useState("");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const taken = list.map((d) => d.key);
  const pool = [...master, ...(master.some((d) => d.key === CONDITION.key) ? [] : [CONDITION])].filter((d) => !taken.includes(d.key));
  const add = (d) => setList((l) => [...l, { ...d, on: undefined, col: l.filter((x) => x.col).length < MAX_COLS && !["image", "pdf"].includes(d.type) }]);
  const create = () => {
    const n = name.trim();
    if (!n) { setError("Please name your list"); return; }
    if (names.some((x) => x.trim().toLowerCase() === n.toLowerCase())) { setError(`You already have a list called ${n}`); return; }
    if (!list.length) { setError("Add at least one attribute"); return; }
    onCreate({ name: n.slice(0, 60), attrs: list.map(({ col, on, ...d }) => d), columns: list.filter((d) => d.col).map((d) => d.key) });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overflow-x-hidden rounded-lg border-2 border-[var(--navy)] [&>*]:min-w-0" data-testid="builder-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><TableProperties className="h-5 w-5" /> Custom Attribute List Builder</DialogTitle>
          <DialogDescription className="text-left text-sm">Choose the details you want to collect for each item. Tick Column on up to {MAX_COLS} to show them in the table beside the Description; the rest open when you tap an item.</DialogDescription>
        </DialogHeader>
        <input value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="List name, e.g. Lines and Ropes" className="field-input" aria-label="List name" data-testid="builder-name-input" />
        <Chosen list={list} setList={setList} />
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Pick from master attributes</span>
          <div className="flex flex-wrap gap-1.5" data-testid="builder-pool">
            {pool.map((d) => (
              <button key={d.key} type="button" onClick={() => add(d)} data-testid={`builder-pick-${d.key}`}
                className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-[var(--line)] bg-white px-2.5 py-1 text-xs font-bold [transition:border-color_.15s] hover:border-[var(--navy)]">
                <Plus className="h-3 w-3" /> {d.name} <span className="font-medium text-[var(--muted)]">{typeLabel(d)}</span>
              </button>
            ))}
          </div>
        </div>
        <OwnAttribute taken={[...taken, ...master.map((d) => d.key)]} onAdd={add} />
        {error && <p className="text-sm font-bold text-[var(--red)]" data-testid="builder-error">{error}</p>}
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose} data-testid="builder-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid px-6" onClick={create} data-testid="builder-create-btn">Create</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
