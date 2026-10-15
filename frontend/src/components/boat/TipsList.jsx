import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { AddItemForm } from "@/components/boat/AddItemForm";
import { TextDialog } from "@/components/boat/TextDialog";

const TipRow = ({ tip, n, admin, first, last, onEdit, onDelete, onMove, busy }) => (
  <li className="checklist-row" data-testid={`tip-item-${tip.id}`}>
    <div className="flex min-h-[56px] flex-1 items-start gap-3 py-3 pl-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 font-mono text-xs font-bold text-amber-900">{n}</span>
      <span className="item-text pt-0.5" data-testid={`tip-text-${tip.id}`}>{tip.label}</span>
    </div>
    {admin && (
      <div className="flex shrink-0 items-start pr-1 pt-1.5">
        <button type="button" className="prio-btn" disabled={first || busy} onClick={() => onMove(-1)} aria-label="Move tip up" data-testid={`tip-up-${tip.id}`}><ArrowUp className="h-5 w-5" /></button>
        <button type="button" className="prio-btn" disabled={last || busy} onClick={() => onMove(1)} aria-label="Move tip down" data-testid={`tip-down-${tip.id}`}><ArrowDown className="h-5 w-5" /></button>
        <button type="button" className="icon-btn" disabled={busy} onClick={onEdit} aria-label="Edit tip" data-testid={`tip-edit-${tip.id}`}><Pencil className="h-[18px] w-[18px]" /></button>
        <button type="button" className="icon-btn hover:text-[var(--red)]" disabled={busy} onClick={onDelete} aria-label="Delete tip" data-testid={`tip-delete-${tip.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
    )}
  </li>
);

export const TipsList = ({ tips, admin, online, onSave }) => {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const isDup = (text, exceptId) => tips.some((t) => t.id !== exceptId && t.label.toLowerCase() === text.toLowerCase());

  const commit = async (next) => {
    if (!online) { toast.error("Go online to update Skipper's Tips"); return false; }
    setBusy(true);
    try { await onSave(next); return true; }
    catch (e) { toast.error(e.response?.data?.detail || "Couldn't save tips"); return false; }
    finally { setBusy(false); }
  };
  const add = (text) => {
    if (!text) return "Nothing to add";
    if (isDup(text)) return `${text} already exists`;
    commit([...tips, { id: Date.now(), label: text }]);
    return true;
  };
  const move = (i, dir) => { const next = [...tips]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; commit(next); };
  const saveEdit = (text) => {
    if (!text) return "Tip text cannot be empty";
    if (isDup(text, editing.id)) return `${text} already exists`;
    commit(tips.map((t) => (t.id === editing.id ? { ...t, label: text } : t)));
    setEditing(null);
    return true;
  };

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-950" data-testid="tips-intro">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{admin ? "You're the admin: add, edit, reorder and delete tips here. Every skipper sees this list." : "Handy tips from the My Boat Prep team, updated for every skipper."}</p>
      </div>
      <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="tips-list">
        {tips.length === 0 && <li className="p-4 text-sm font-medium text-[var(--muted)]" data-testid="tips-empty">{admin ? "No tips yet. Add the first one below." : "No tips yet. Check back soon."}</li>}
        {tips.map((t, i) => (
          <TipRow key={t.id} tip={t} n={i + 1} admin={admin} busy={busy} first={i === 0} last={i === tips.length - 1}
            onEdit={() => setEditing(t)} onDelete={() => commit(tips.filter((x) => x.id !== t.id))} onMove={(d) => move(i, d)} />
        ))}
      </ul>
      {admin && <AddItemForm onAdd={add} placeholder="Add a Skipper's Tip..." />}
      {admin && !online && <p className="text-center text-xs font-bold text-[var(--muted)]" data-testid="tips-offline-hint">Go online to update Skipper's Tips</p>}
      <TextDialog open={!!editing} title="Edit Tip" confirmLabel="Save" testId="edit-tip" initial={editing?.label || ""}
        onConfirm={saveEdit} onClose={() => setEditing(null)} />
    </>
  );
};
