import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS = [["overwrite", "Will be overwritten"], ["add", "Will be added"], ["unchanged", "Already the same"], ["skip", "Skipped"]];

const download = (data) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `my-boat-prep-template-lists-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const Preview = ({ plan, busy, onConfirm, onClose }) => {
  const changes = plan.lists.filter((l) => l.action === "add" || l.action === "overwrite").length;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="template-restore-preview">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Restore template lists?</DialogTitle>
          <DialogDescription>Lists with the same name are overwritten, missing ones are added, and lists not in the backup are kept.</DialogDescription>
        </DialogHeader>
        {GROUPS.map(([k, label]) => {
          const rows = plan.lists.filter((l) => l.action === k);
          return rows.length > 0 && (
            <div key={k} className="flex flex-col gap-1" data-testid={`template-restore-${k}`}>
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">{label} ({rows.length})</p>
              <ul className="rounded-md border-[1.5px] border-[var(--line)] text-sm">
                {rows.map((l, n) => (
                  <li key={`${l.name}-${n}`} className="flex justify-between gap-2 border-b border-[var(--line)] px-3 py-1.5 last:border-b-0" data-testid={`template-restore-${k}-${n}`}>
                    <span className="min-w-0 break-words font-bold">{l.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">{l.reason || `${l.items} ${l.items === 1 ? "item" : "items"}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" disabled={busy} onClick={onClose} data-testid="template-restore-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1 disabled:opacity-40" disabled={busy || !changes} onClick={onConfirm} data-testid="template-restore-confirm-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : changes ? `Restore ${changes} ${changes === 1 ? "list" : "lists"}` : "Nothing to restore"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Export every master template list to a file, and restore them from one.
export const TemplateBackup = ({ onRestored }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [backup, setBackup] = useState(null);
  const [plan, setPlan] = useState(null);
  const exportAll = async () => {
    setBusy("export");
    try { const { data } = await api.get("/admin/template-lists/export", { timeout: 30000 }); download(data); toast.success(`${data.lists.length} template lists exported`); }
    catch (e) { toast.error(apiError(e, "Couldn't export the template lists")); } finally { setBusy(""); }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast.error("That file isn't a template lists backup"); return; }
    setBusy("import");
    try { const { data: p } = await api.post("/admin/template-lists/import", { kind: data.kind, lists: data.lists || [], dry_run: true }, { timeout: 30000 }); setBackup(data); setPlan(p); }
    catch (err) { toast.error(apiError(err, "That file isn't a template lists backup")); } finally { setBusy(""); }
  };
  const restore = async () => {
    setBusy("restore");
    try {
      const { data } = await api.post("/admin/template-lists/import", { kind: backup.kind, lists: backup.lists, dry_run: false }, { timeout: 60000 });
      const n = data.lists.filter((l) => l.action === "add" || l.action === "overwrite").length;
      toast.success(`${n} template ${n === 1 ? "list" : "lists"} restored`);
      setPlan(null); setBackup(null); onRestored();
    } catch (err) { toast.error(apiError(err, "Couldn't restore the template lists")); } finally { setBusy(""); }
  };
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="template-backup">
      <button type="button" className="btn-ghost h-11 justify-center gap-2 text-sm" disabled={!!busy} onClick={exportAll} data-testid="template-export-btn">
        {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export all lists
      </button>
      <button type="button" className="btn-ghost h-11 justify-center gap-2 text-sm" disabled={!!busy} onClick={() => input.current?.click()} data-testid="template-import-btn">
        {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Restore from backup
      </button>
      <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={pick} data-testid="template-import-input" />
      {plan && <Preview plan={plan} busy={busy === "restore"} onConfirm={restore} onClose={() => { setPlan(null); setBackup(null); }} />}
    </div>
  );
};
