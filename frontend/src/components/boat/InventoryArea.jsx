import { useState } from "react";
import { Highlight } from "@/components/boat/Highlight";
import { Check, ChevronDown, Link2, Pencil, Plus, Trash2 } from "lucide-react";

const ContentRow = ({ item, readOnly, onToggle, onEdit, onDelete, query }) => (
  <li className={`flex items-center border-t border-[var(--line)] ${item.onboard ? "is-checked bg-emerald-50/60" : ""}`} data-testid={`inventory-item-${item.id}`}>
    <button type="button" role="checkbox" aria-checked={!!item.onboard} onClick={readOnly ? undefined : onToggle} disabled={readOnly}
      className="flex min-h-[52px] flex-1 items-center gap-3 py-2 pl-3 text-left" data-testid={`inventory-item-toggle-${item.id}`}>
      <span className="tick-box">{item.onboard && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
      <span className="item-text flex-1" data-testid={`inventory-item-name-${item.id}`}><Highlight text={item.name} query={query} /></span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-sm font-bold text-[var(--navy)]" data-testid={`inventory-item-qty-${item.id}`}>&times;{item.qty}</span>
    </button>
    {!readOnly && (
      <div className="flex shrink-0 items-center pr-1">
        <button type="button" className="icon-btn" aria-label="Edit item" onClick={onEdit} data-testid={`inventory-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
        <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete item" onClick={onDelete} data-testid={`inventory-item-delete-${item.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
    )}
  </li>
);

// A checklist item tagged with this cupboard; its tick is the checklist tick.
const LinkedRow = ({ link, query, onToggle }) => (
  <li className={`flex items-center border-t border-[var(--line)] ${link.item.checked ? "is-checked bg-emerald-50/60" : ""}`} data-testid={`inventory-linked-${link.key}`}>
    <button type="button" role="checkbox" aria-checked={!!link.item.checked} onClick={onToggle} disabled={!onToggle}
      className="flex min-h-[52px] flex-1 items-center gap-3 py-2 pl-3 pr-3 text-left" data-testid={`inventory-linked-toggle-${link.key}`}>
      <span className="tick-box">{link.item.checked && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
      <span className="item-text flex-1" data-testid={`inventory-linked-text-${link.key}`}>
        <span className="font-bold text-[var(--navy)]">{link.listName}</span> - <Highlight text={link.text} query={query} />
      </span>
      <Link2 className="h-4 w-4 shrink-0 text-sky-700" aria-label={`From ${link.listName}`} />
    </button>
  </li>
);

const AddContent = ({ areaId, onAdd }) => {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const n = Number(qty);
    if (!name.trim()) { setError("Enter what's in this cupboard"); return; }
    if (!Number.isInteger(n) || n < 1 || n > 9999) { setError("Quantity must be a whole number from 1 to 9999"); return; }
    const res = onAdd({ name: name.trim(), qty: n });
    if (typeof res === "string") { setError(res); return; }
    setName(""); setQty("1"); setError("");
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-1 border-t border-[var(--line)] bg-slate-50 p-2" data-testid={`inventory-add-form-${areaId}`}>
      <div className="flex gap-2">
        <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Add item, e.g. Spare impeller" aria-label="Item name"
          className="field-input h-11 !w-0 min-w-0 flex-1" data-testid={`inventory-add-name-${areaId}`} />
        <input type="number" inputMode="numeric" min={1} max={9999} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity"
          className="field-input h-11 !w-20 shrink-0" data-testid={`inventory-add-qty-${areaId}`} />
        <button type="submit" className="btn-solid h-11 w-11 shrink-0 justify-center p-0" aria-label="Add item" data-testid={`inventory-add-btn-${areaId}`}><Plus className="h-5 w-5" /></button>
      </div>
      {error && <p className="text-sm font-semibold text-[var(--red)]" data-testid={`inventory-add-error-${areaId}`}>{error}</p>}
    </form>
  );
};

export const InventoryArea = ({ area, readOnly, onAdd, onToggle, onEditItem, onDeleteItem, onRename, onDelete, query = "", visible, linked = [], visibleLinked, onToggleLinked }) => {
  const [openState, setOpen] = useState(false);
  const open = openState || !!query;
  const items = area.items || [];
  const listed = visible || items;
  const shownLinks = visibleLinked || linked;
  const onboard = items.filter((i) => i.onboard).length + linked.filter((l) => l.item.checked).length;
  const total = items.length + linked.length;
  return (
    <li className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid={`inventory-area-${area.id}`}>
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[56px] flex-1 items-center gap-3 px-3 text-left" data-testid={`inventory-area-toggle-${area.id}`}>
          <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--navy)] [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
          <span className="flex flex-1 flex-col py-2">
            <span className="font-bold text-[var(--navy)]" data-testid={`inventory-area-name-${area.id}`}><Highlight text={area.name} query={query} /></span>
            <span className="text-xs font-bold text-[var(--muted)]" data-testid={`inventory-area-count-${area.id}`}>{onboard}/{total} on board</span>
          </span>
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center pr-1">
            <button type="button" className="icon-btn" aria-label="Rename cupboard" onClick={onRename} data-testid={`inventory-area-rename-${area.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
            <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label="Delete cupboard" onClick={onDelete} data-testid={`inventory-area-delete-${area.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
          </div>
        )}
      </div>
      {open && (
        <>
          {total === 0 && <p className="border-t border-[var(--line)] px-3 py-3 text-sm text-[var(--muted)]" data-testid={`inventory-area-empty-${area.id}`}>Nothing listed in here yet.</p>}
          <ul>
            {listed.map((i) => (
              <ContentRow key={i.id} item={i} readOnly={readOnly} query={query} onToggle={() => onToggle(i)} onEdit={() => onEditItem(i)} onDelete={() => onDeleteItem(i)} />
            ))}
            {shownLinks.map((l) => <LinkedRow key={l.key} link={l} query={query} onToggle={onToggleLinked && (() => onToggleLinked(l))} />)}
          </ul>
          {!readOnly && !query && <AddContent areaId={area.id} onAdd={onAdd} />}
        </>
      )}
    </li>
  );
};
