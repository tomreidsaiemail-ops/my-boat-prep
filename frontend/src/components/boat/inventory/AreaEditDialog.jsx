import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const WHERE_MAX = 80;
export const AREA_COMMENT_MAX = 300;

// Rename a cupboard and say where it is in its zone, e.g. "Under the port saloon seat, aft end".
export const AreaEditDialog = ({ area, zoneName, onSave, onClose }) => {
  const [name, setName] = useState("");
  const [where, setWhere] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (area) { setName(area.name || ""); setWhere(area.where || ""); setComment(area.comment || ""); setError(""); } }, [area]);
  const submit = (e) => {
    e.preventDefault();
    const res = onSave(name.trim(), where.trim().slice(0, WHERE_MAX), comment.trim().slice(0, AREA_COMMENT_MAX));
    if (typeof res === "string") setError(res);
  };
  return (
    <Dialog open={!!area} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="inventory-rename-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Edit {area?.parent_id ? "folder or box" : "cupboard"}</DialogTitle>
          <DialogDescription>Crew find things faster when they know exactly where it is{zoneName ? ` in the ${zoneName}` : ""}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1"><span className="field-label">Name</span>
            <input autoFocus value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setError(""); }} className="field-input" data-testid="inventory-rename-input" /></label>
          <label className="flex flex-col gap-1"><span className="field-label">Where is it{zoneName ? ` in the ${zoneName}` : " in the zone"}? (optional)</span>
            <input value={where} maxLength={WHERE_MAX} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Under the port saloon seat, aft end" className="field-input" data-testid="inventory-where-input" />
            <span className="text-right text-xs text-[var(--muted)]" data-testid="inventory-where-count">{where.length}/{WHERE_MAX}</span></label>
          {!area?.parent_id && (
            <label className="flex flex-col gap-1"><span className="field-label">Cupboard comment (optional)</span>
              <textarea value={comment} maxLength={AREA_COMMENT_MAX} rows={2} onChange={(e) => setComment(e.target.value)} placeholder="e.g. The seacock is behind the bin, close it before leaving the boat"
                className="field-input !h-auto min-h-[64px] !py-2" data-testid="inventory-comment-input" />
              <span className="flex justify-between gap-2 text-xs text-[var(--muted)]"><span>Crew see it on this cupboard&apos;s stop in the walkthrough, if you keep it as a stop.</span><span data-testid="inventory-comment-count">{comment.length}/{AREA_COMMENT_MAX}</span></span></label>
          )}
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="inventory-rename-error">{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid="inventory-rename-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid px-6" data-testid="inventory-rename-confirm-btn">Save</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
