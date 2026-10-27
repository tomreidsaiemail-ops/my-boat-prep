import { useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Plus } from "lucide-react";
import { MediaRow } from "@/components/boat/MediaRow";
import { MediaDialog } from "@/components/boat/MediaDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { SettingToggle } from "@/components/boat/AddItemForm";

const COPY = {
  youtube: { noun: "channel", intro: "Sailing YouTube channels picked by the My Boat Prep team. Tap one to watch." },
  movies: { noun: "movie", intro: "Sailing movies picked by the My Boat Prep team. Tap one to find out more." },
};

export const MediaList = ({ list, store, admin, online, own, ordering, onOrderingChange }) => {
  const edits = admin || own;
  const { kind, name } = list;
  const { noun, intro } = COPY[kind];
  const items = store.items;
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [doomed, setDoomed] = useState(null);

  const run = async (fn) => {
    if (!online && !own) { toast.error(`Go online to update ${name}`); return "You're offline"; }
    setBusy(true);
    try { await fn(); return true; }
    catch (e) { const msg = e.response?.data?.detail; const text = typeof msg === "string" ? msg : msg?.[0]?.msg?.replace("Value error, ", "") || (!e.response && e.message) || "Couldn't save, please try again"; toast.error(text); return text; }
    finally { setBusy(false); }
  };
  const move = (i, dir) => { const ids = items.map((m) => m.id); [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]; run(() => store.reorder(ids)); };
  const confirm = async (form) => {
    const res = await run(() => (dialog.item ? store.edit(dialog.item.id, form) : store.add(form)));
    if (res === true) { setDialog(null); toast.success(dialog.item ? "Saved" : `${form.name} added`); }
    return res;
  };

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-sky-200 bg-sky-50 p-3.5 text-sm leading-relaxed text-sky-950" data-testid="media-intro">
        <Clapperboard className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{own ? `Your own copy. Add, edit and delete ${noun}s here, and tick Show List Ordering Icons to put them in your order.` : admin ? `You're the admin: add, edit, reorder and delete ${noun}s here. Every skipper sees this list.` : intro}</p>
      </div>
      <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="media-list">
        {items.length === 0 && <li className="p-4 text-sm font-medium text-[var(--muted)]" data-testid="media-empty">{edits ? `No ${noun}s yet. Add the first one below.` : "Nothing here yet. Check back soon."}</li>}
        {items.map((m, i) => (
          <MediaRow key={m.id} item={m} kind={kind} admin={edits} arrows={admin || (own && ordering)} busy={busy} first={i === 0} last={i === items.length - 1}
            onEdit={() => setDialog({ item: m })} onDelete={() => setDoomed(m)} onMove={(d) => move(i, d)} />
        ))}
      </ul>
      {own && <SettingToggle checked={!!ordering} onChange={onOrderingChange} label="Show List Ordering Icons" testId="ordering-toggle" />}
      {edits && (
        <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" disabled={busy} onClick={() => (online || own ? setDialog({}) : toast.error(`Go online to update ${name}`))} data-testid="media-add-btn">
          <Plus className="h-5 w-5" strokeWidth={3} /> Add a {noun}
        </button>
      )}
      <MediaDialog open={!!dialog} title={dialog?.item ? `Edit ${noun}` : `Add a ${noun}`} kindLabel={noun} initial={dialog?.item}
        onConfirm={confirm} onClose={() => setDialog(null)} />
      <ConfirmDelete item={doomed} onClose={() => setDoomed(null)}
        onConfirm={async () => { const m = doomed; setDoomed(null); if ((await run(() => store.remove(m.id))) === true) toast.success(`${m.name} deleted`); }} />
    </>
  );
};
