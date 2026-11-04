import { useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Plus } from "lucide-react";
import { MaintRow } from "@/components/boat/maint/MaintRow";
import { PriorityTools } from "@/components/boat/Checklist";
import { OrderNumber } from "@/components/boat/OrderNumber";
import { SettingToggle } from "@/components/boat/AddItemForm";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { dueTone, effectiveDue } from "@/lib/maint";
import { flagOutline, moveOutline, outlineInfo, placeOutline, setIndent } from "@/lib/outline";

const NEW_CAT = "__new";
const groupEnd = (items, n) => { let e = n + 1; while (e < items.length && items[e].indent) e += 1; return e; };

export const MaintTable = ({ items, setItems, defs, cols, ctx, guard, ordering, onOrderingChange, promptDelete, onPromptDeleteChange }) => {
  const [openIds, setOpenIds] = useState([]);
  const [draft, setDraft] = useState("");
  const [doomed, setDoomed] = useState(null);
  const heads = items.filter((i) => !i.indent);
  const [under, setUnder] = useState("");
  const target = under === NEW_CAT || heads.some((h) => String(h.id) === under) ? under : heads.length ? String(heads[heads.length - 1].id) : NEW_CAT;
  const kids = items.filter((i) => i.indent);
  const allOpen = kids.length > 0 && kids.every((i) => openIds.includes(i.id));
  const toggleRow = (id) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const update = (id, patch) => guard() && setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const tools = ordering && !ctx.readOnly;
  const info = tools ? outlineInfo(items) : {};
  const reorder = (fn) => guard() && setItems(fn);
  const remove = (item) => {
    if (!guard()) return;
    const start = items.findIndex((i) => i.id === item.id);
    const gone = item.indent ? [item] : items.slice(start, groupEnd(items, start));
    const ids = gone.map((g) => g.id);
    setItems((list) => list.filter((i) => !ids.includes(i.id)));
    const undo = () => setItems((list) => (list.some((i) => i.id === item.id) ? list : [...list.slice(0, start), ...gone, ...list.slice(start)]));
    toast(`Deleted "${item.label}"${gone.length > 1 ? ` and its ${gone.length - 1} ${gone.length === 2 ? "item" : "items"}` : ""}`, { duration: 6000, action: { label: "Undo", onClick: undo } });
  };
  const askRemove = (item) => {
    if (!promptDelete) { remove(item); return; }
    const n = items.findIndex((i) => i.id === item.id);
    setDoomed({ item, subs: item.indent ? 0 : groupEnd(items, n) - n - 1 });
  };
  const add = (e) => {
    e.preventDefault();
    const label = draft.trim();
    if (!label || !guard("bottom")) return;
    const row = { id: Math.max(Date.now(), ...items.map((i) => Number(i.id) || 0)) + 1, label, checked: false, maint: true, attrs: {} };
    setItems((list) => {
      if (target === NEW_CAT) return [...list, row];
      const n = list.findIndex((i) => String(i.id) === target);
      if (n < 0) return [...list, row];
      const end = groupEnd(list, n);
      return [...list.slice(0, end), { ...row, indent: true }, ...list.slice(end)];
    });
    if (target === NEW_CAT) setUnder(String(row.id));
    setDraft("");
  };
  const dues = items.map((_, n) => effectiveDue(items, n));
  const tones = items.map((i, n) => (i.indent ? dueTone(dues[n].date) : ""));
  const overdue = tones.filter((t) => t === "red").length;
  const soon = tones.filter((t) => t === "orange").length;
  return (
    <div className="flex flex-col gap-3">
      {(overdue > 0 || soon > 0) && (
        <p className="text-sm font-bold" data-testid="maint-due-summary">
          {overdue > 0 && <span className="mr-3 text-[var(--red)]">{overdue} overdue</span>}
          {soon > 0 && <span className="text-orange-700">{soon} due within 30 days</span>}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="maint-table-wrap">
        <table className="w-full min-w-[320px] table-fixed border-collapse text-sm" data-testid="maint-table">
          <colgroup><col />{(cols || [0, 1]).map((c, n) => <col key={c.key || n} className={cols ? "w-[92px]" : "w-[80px]"} />)}<col className="w-[28px]" /></colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-1 py-1.5 text-left">
                <button type="button" onClick={() => setOpenIds(allOpen ? [] : kids.map((i) => i.id))} aria-expanded={allOpen} data-testid="maint-expand-all-btn"
                  className="field-label inline-flex h-8 items-center gap-1 rounded px-1 hover:text-[var(--navy)]" title={allOpen ? "Hide the details of every item" : "Show the details of every item"}>
                  <ChevronsUpDown className="h-4 w-4" /> Description
                </button>
              </th>
              {cols ? cols.map((c) => <th key={c.key} className="field-label break-words px-1 py-1.5 text-left" data-testid={`maint-col-head-${c.key}`}>{c.name}</th>) : <>
                <th className="field-label px-1 py-1.5 text-left">Last service</th>
                <th className="field-label px-1 py-1.5 text-left">Service due</th>
              </>}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, n) => {
              const inf = info[item.id];
              return (
                <MaintRow key={item.id} item={item} due={dues[n]} cols={cols} open={openIds.includes(item.id)} onOpen={() => toggleRow(item.id)} defs={defs} ctx={ctx}
                  onChange={(p) => update(item.id, p)} onDelete={() => askRemove(item)}
                  number={tools && inf && <OrderNumber key={`${item.id}-${inf.num}`} id={item.id} pos={inf.pos} label={inf.num} total={inf.total} prefix="maint-item"
                    onPlace={(p) => reorder((list) => placeOutline(list, item.id, p))} />}
                  tools={tools && inf && <PriorityTools item={item} info={{ ...inf, canIndent: inf.canIndent && !inf.subs }} onFlag={() => reorder((list) => flagOutline(list, item.id))}
                    onMove={(d) => reorder((list) => moveOutline(list, item.id, d))} onIndent={(v) => reorder((list) => setIndent(list, item.id, v))} />} />
              );
            })}
            {!items.length && <tr><td colSpan={2 + (cols ? cols.length : 2)} className="p-4 text-center text-[var(--muted)]" data-testid="maint-empty">No items yet. Add a category below.</td></tr>}
          </tbody>
        </table>
      </div>
      {!ctx.readOnly && (
        <form onSubmit={add} className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid="maint-add-form">
          <div className="flex flex-wrap items-center gap-x-6">
            <SettingToggle checked={!!ordering} onChange={onOrderingChange} label="Show List Ordering Icons" testId="ordering-toggle" />
            <SettingToggle checked={!!promptDelete} onChange={onPromptDeleteChange} label="Prompt on delete" testId="prompt-delete-toggle" />
          </div>
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder={target === NEW_CAT ? "New category..." : "New item..."} aria-label="New item" className="field-input" data-testid="maint-add-input" />
            <button type="submit" className="btn-solid shrink-0 gap-1 px-4" data-testid="maint-add-btn"><Plus className="h-4 w-4" /> Add</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="field-label shrink-0">Add to</span>
            <select value={target} onChange={(e) => setUnder(e.target.value)} className="field-input h-10 !text-sm" data-testid="maint-add-under-select">
              {heads.map((h) => <option key={h.id} value={String(h.id)}>{h.label}</option>)}
              <option value={NEW_CAT}>As a new category</option>
            </select>
          </label>
        </form>
      )}
      <ConfirmDelete item={doomed ? { name: doomed.item.label } : null} testId="maint-item-delete" onClose={() => setDoomed(null)}
        note={doomed?.subs ? `This category and its ${doomed.subs} ${doomed.subs === 1 ? "item" : "items"} will be removed from this list.` : "It will be removed from this list."}
        onConfirm={() => { remove(doomed.item); setDoomed(null); }} />
    </div>
  );
};
