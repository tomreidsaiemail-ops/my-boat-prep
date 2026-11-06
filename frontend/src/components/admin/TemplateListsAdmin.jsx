import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, Check, ListPlus, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { TemplateListEditor } from "@/components/admin/TemplateListEditor";
import { TemplateBackup } from "@/components/admin/TemplateBackup";
import { Highlight, matches } from "@/components/boat/Highlight";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (iso) => new Date(iso).toLocaleDateString("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const Row = ({ t, q, hits = [], onEdit, onDelete }) => (
  <li className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-3 last:border-b-0" data-testid={`template-list-row-${t.id}`}>
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-bold" data-testid={`template-list-name-${t.id}`}><Highlight text={t.name} query={q} /></span>
        {t.private && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700" data-testid={`template-list-private-${t.id}`}><Check className="h-3 w-3" />Admin use only</span>}
      </div>
      <div className="text-xs text-[var(--muted)]">{t.items.length} {t.items.length === 1 ? "item" : "items"} · updated {fmt(t.updated_at)}</div>
      {hits.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-xs" data-testid={`template-list-hits-${t.id}`}>
          {hits.slice(0, 3).map((i, n) => <li key={n} className="break-words text-[var(--navy)]" data-testid={`template-list-hit-${t.id}-${n}`}>· <Highlight text={i.label} query={q} /></li>)}
          {hits.length > 3 && <li className="text-[var(--muted)]" data-testid={`template-list-hits-more-${t.id}`}>+ {hits.length - 3} more matching {hits.length - 3 === 1 ? "line" : "lines"}</li>}
        </ul>
      )}
    </div>
    <div className="flex shrink-0 gap-1">
      <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${t.name}`} data-testid={`template-list-edit-${t.id}`}><Pencil className="h-4 w-4" /></button>
      <button type="button" className="icon-btn" onClick={onDelete} aria-label={`Delete ${t.name}`} data-testid={`template-list-delete-${t.id}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  </li>
);

const FILTERS = [
  ["all", "All", () => true], ["private", "Admin use only", (t) => t.private], ["published", "Published", (t) => !t.private],
  ["help", "Help Panels", (t) => /^\s*admin\s*-\s*help panel/i.test(t.name)], ["admin", "Admin lists", (t) => /^\s*admin\s*-/i.test(t.name)],
];
const SORTS = {
  az: ["Name A-Z", (a, b) => a.name.localeCompare(b.name)], za: ["Name Z-A", (a, b) => b.name.localeCompare(a.name)],
  updated: ["Recently updated", (a, b) => String(b.updated_at).localeCompare(String(a.updated_at))], size: ["Most items", (a, b) => b.items.length - a.items.length],
};

const Controls = ({ q, setQ, filter, setFilter, sort, setSort, shown, total }) => (
  <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="template-list-controls">
    <div className="flex flex-col gap-2 sm:flex-row">
      <span className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search list names and lines..." aria-label="Search template lists" className="field-input w-full !pl-9" data-testid="template-list-search" />
      </span>
      <label className="flex shrink-0 items-center gap-1.5">
        <ArrowDownUp className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort template lists" className="field-input !w-auto" data-testid="template-list-sort">
          {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter template lists">
      {FILTERS.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} data-testid={`template-list-filter-${k}`}
          className={`h-8 rounded-full border-[1.5px] px-3 text-xs font-bold [transition:background-color_.15s] ${filter === k ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>{label}</button>
      ))}
    </div>
    <p className="text-xs text-[var(--muted)]" data-testid="template-list-count">Showing {shown} of {total} lists</p>
  </div>
);

export const TemplateListsAdmin = () => {
  const [lists, setLists] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("az");
  const query = q.trim().toLowerCase();
  const hitsOf = (t) => (query ? t.items.filter((i) => matches(i.label, query)) : []);
  const found = (t) => !query || matches(t.name, query) || matches(t.description || "", query) || hitsOf(t).length > 0;
  const visible = (lists || []).filter((t) => FILTERS.find(([k]) => k === filter)[2](t) && found(t)).sort(SORTS[sort][1]);
  const reload = () => api.get("/admin/template-lists").then(({ data }) => setLists(data)).catch(() => toast.error("Couldn't load template lists"));

  useEffect(() => {
    api.get("/admin/template-lists").then(({ data }) => setLists(data)).catch(() => { toast.error("Couldn't load template lists"); setLists([]); });
  }, []);

  const save = async (body) => {
    if (editing === "new") {
      const { data } = await api.post("/admin/template-lists", body);
      setLists((l) => [...l, data]);
      toast.success(data.private ? `${data.name} saved for Admin use only` : `${data.name} published: it now appears on every boat`);
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
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Create a new list, like "Prep your trip", and it appears on every skipper's boats, Free plan included. Skippers who already have it keep their copy when you edit it, and see an Updated note with "Get latest items".
        Tick "Private to admin user" for system lists that stay here only: Admin - Food Synonyms and Admin - Food Noise Words drive the Provisioning Assistant's matching.
      </p>
      {editing ? <TemplateListEditor key={editing.id || "new"} initial={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />
        : <button type="button" className="btn-solid flex h-12 items-center justify-center gap-2" onClick={() => setEditing("new")} data-testid="template-list-new-btn"><ListPlus className="h-5 w-5" /> New template list</button>}
      {!editing && <TemplateBackup onRestored={reload} />}
      {!lists ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <>
        {lists.length > 0 && <Controls q={q} setQ={setQ} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} shown={visible.length} total={lists.length} />}
        <ul className="overflow-hidden rounded-lg border-[1.5px] border-[var(--line)] bg-white" data-testid="template-lists">
          {lists.length === 0 && <li className="p-4 text-center text-sm text-[var(--muted)]" data-testid="template-lists-empty">No template lists yet</li>}
          {lists.length > 0 && !visible.length && <li className="p-4 text-center text-sm text-[var(--muted)]" data-testid="template-lists-no-match">No lists match. Clear the search or pick All.</li>}
          {visible.map((t) => <Row key={t.id} t={t} q={query} hits={hitsOf(t)} onEdit={() => setEditing(t)} onDelete={() => setRemoving(t)} />)}
        </ul>
        </>
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
