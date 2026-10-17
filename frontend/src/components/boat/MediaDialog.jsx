import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const EMPTY = { name: "", url: "", note: "" };

const Field = ({ label, testId, ...props }) => (
  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
    {label}
    <input className="field-input text-base normal-case tracking-normal text-[var(--ink,inherit)]" data-testid={testId} {...props} />
  </label>
);

export const MediaDialog = ({ open, title, kindLabel, initial, onConfirm, onClose }) => {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setForm({ ...EMPTY, ...initial }); setError(""); } }, [open, initial]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name) { setError(`Please enter the ${kindLabel} name`); return; }
    if (!url) { setError("Please add the web link"); return; }
    setBusy(true);
    const res = await onConfirm({ name, url, note: form.note.trim() });
    setBusy(false);
    if (typeof res === "string") setError(res);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="media-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">{title}</DialogTitle>
          <DialogDescription>We'll fetch a picture from the link automatically where we can.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Name" testId="media-name-input" autoFocus value={form.name} onChange={set("name")} maxLength={120} placeholder={kindLabel === "movie" ? "e.g. Master and Commander" : "e.g. Sailing La Vagabonde"} />
          <Field label="Link" testId="media-url-input" type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" value={form.url} onChange={set("url")} maxLength={1000} placeholder="https://..." />
          <Field label="Note (optional)" testId="media-note-input" value={form.note} onChange={set("note")} maxLength={160} placeholder="One line, e.g. Great heavy weather tips" />
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="media-dialog-error">{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" disabled={busy} onClick={onClose} data-testid="media-dialog-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid flex items-center gap-2 px-6" disabled={busy} data-testid="media-dialog-confirm-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Saving" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
