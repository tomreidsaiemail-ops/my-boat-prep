import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, Download, Loader2, Upload } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const BACKUP_KIND = "my-boat-prep-template-lists";
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
                    <span className="shrink-0 text-xs text-[var(--muted)]">{l.reason || `${l.items} ${l.items === 1 ? "item" : "items"}${l.version ? ` · becomes v${l.version}` : ""}`}</span>
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
  const [pasting, setPasting] = useState(null);
  const check = async (text, what = "That file isn't a template lists backup") => {
    let data;
    try { data = JSON.parse(text); } catch { toast.error(what); return; }
    (data.lists || []).forEach((l) => { l.items = (l.items || []).map((i, n) => ({ id: n + 1, ...i })); });
    setBusy("import");
    try { const { data: p } = await api.post("/admin/template-lists/import", { kind: data.kind, lists: data.lists || [], dry_run: true }, { timeout: 30000 }); setBackup(data); setPlan(p); setPasting(null); }
    catch (err) { toast.error(apiError(err, what)); } finally { setBusy(""); }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) check(await file.text());
  };
  // Paste list: what Copy list put on the clipboard (on the live app or preview). If the browser won't share the clipboard, paste it in a box.
  const paste = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { text = ""; }
    if (text.includes(BACKUP_KIND)) check(text, "That isn't a copied template list");
    else setPasting("");
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
      <button type="button" className="btn-ghost col-span-2 h-11 justify-center gap-2 text-sm" disabled={!!busy} onClick={paste} data-testid="template-paste-btn">
        <ClipboardPaste className="h-4 w-4" /> Paste list (from Copy list on another app)
      </button>
      <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={pick} data-testid="template-import-input" />
      <p className="col-span-2 text-xs text-[var(--muted)]" data-testid="template-backup-note">Saves every admin list and every built-in master you have edited. Built-in lists you never edited come with the app, so they don't need a backup.</p>
      {pasting !== null && (
        <Dialog open onOpenChange={(o) => !o && setPasting(null)}>
          <DialogContent className="flex max-w-md flex-col gap-3 rounded-lg border-2 border-[var(--navy)]" data-testid="template-paste-dialog">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-extrabold">Paste list</DialogTitle>
              <DialogDescription>Tap Copy list next to a list in the other app&apos;s Admin, then paste it here.</DialogDescription>
            </DialogHeader>
            <textarea value={pasting} onChange={(e) => setPasting(e.target.value)} rows={6} className="field-input min-h-[140px] py-2 font-mono text-xs" placeholder="Paste here" data-testid="template-paste-text" />
            <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={!pasting.trim() || !!busy} onClick={() => check(pasting, "That isn't a copied template list")} data-testid="template-paste-check-btn">
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />} Check pasted list
            </button>
          </DialogContent>
        </Dialog>
      )}
      {plan && <Preview plan={plan} busy={busy === "restore"} onConfirm={restore} onClose={() => { setPlan(null); setBackup(null); }} />}
    </div>
  );
};
