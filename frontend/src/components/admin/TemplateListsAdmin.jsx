import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { TemplateListEditor } from "@/components/admin/TemplateListEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const Row = ({ t, onEdit, onDelete }) => (
  <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-3 last:border-b-0" data-testid={`template-list-row-${t.id}`}>
    <div className="min-w-0">
      <div className="truncate font-bold" data-testid={`template-list-name-${t.id}`}>{t.name}</div>
      <div className="text-xs text-[var(--muted)]">{t.items.length} {t.items.length === 1 ? "item" : "items"} · updated {fmt(t.updated_at)}</div>
    </div>
    <div className="flex shrink-0 gap-1">
      <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${t.name}`} data-testid={`template-list-edit-${t.id}`}><Pencil className="h-4 w-4" /></button>
      <button type="button" className="icon-btn" onClick={onDelete} aria-label={`Delete ${t.name}`} data-testid={`template-list-delete-${t.id}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  </li>
);

export const TemplateListsAdmin = () => {
  const [lists, setLists] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    api.get("/admin/template-lists").then(({ data }) => setLists(data)).catch(() => { toast.error("Couldn't load template lists"); setLists([]); });
  }, []);

  const save = async (body) => {
    if (editing === "new") {
      const { data } = await api.post("/admin/template-lists", body);
      setLists((l) => [...l, data]);
      toast.success(`${data.name} published: it now appears on every boat`);
    } else {
      const { data } = await api.put(`/admin/template-lists/${editing.id}`, body);
      setLists((l) => l.map((x) => (x.id === data.id ? data : x)));
      toast.success(`${data.name} saved`);
    }
    setEditing(null);
  };
  const remove = async () => {
    const t = removing;
    setRemoving(null);
    try {
      await api.delete(`/admin/template-lists/${t.id}`);
      setLists((l) => l.filter((x) => x.id !== t.id));
      toast.success(`${t.name} removed from templates`);
    } catch { toast.error("Couldn't delete, please try again"); }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="template-lists-admin">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">Template lists</h2>
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Create a new list, like "Prep your trip", and it appears on every skipper's boats, Free plan included. Skippers who already have it keep their copy when you edit it, and see an Updated note with "Get latest items".
      </p>
      {editing ? <TemplateListEditor key={editing.id || "new"} initial={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
        : <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" onClick={() => setEditing("new")} data-testid="template-list-new-btn"><ListPlus className="h-5 w-5" /> New template list</button>}
      {!lists ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="template-lists">
          {lists.length === 0 && <li className="p-4 text-center text-sm text-[var(--muted)]" data-testid="template-lists-empty">No template lists yet</li>}
          {lists.map((t) => <Row key={t.id} t={t} onEdit={() => setEditing(t)} onDelete={() => setRemoving(t)} />)}
        </ul>
      )}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="template-list-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold">Delete {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-[var(--navy)]">
              It stops being added to boats. Skippers who already have it keep their copy as one of their own lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="template-list-delete-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction className="btn-solid px-5" onClick={remove} data-testid="template-list-delete-confirm-btn">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
