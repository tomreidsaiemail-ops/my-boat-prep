import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";

// Admin only: change this one step's line in its "Admin - Model Vessel - *" list, and add placeholder steps around it.
export const EditStepDialog = ({ open, wizard, step, raw, onSaved, onClose }) => {
  const [text, setText] = useState(raw);
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setText(raw); setBefore(0); setAfter(0); } }, [open, raw]);
  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/wizard-step", { wizard: wizard.key, step, expect: raw, text, before, after });
      const added = before + after;
      toast.success(`Step ${step + before + 1} saved to ${wizard.title}${added ? `, with ${added} new ${added === 1 ? "step" : "steps"} to fill in` : ""}.`);
      onSaved(before);
    } catch (e) { toast.error(apiError(e, "Couldn't save that step. Please try again.")); }
    setBusy(false);
  };
  const Add = ({ n, set, label, id }) => (
    <button type="button" className="btn-ghost h-11 flex-1 justify-center gap-1 text-sm" onClick={() => set(n + 1)} data-testid={`edit-step-add-${id}-btn`}>
      <Plus className="h-4 w-4" /> {label}{n ? ` (${n})` : ""}
    </button>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-w-md flex-col gap-3 rounded-lg border-2 border-[var(--navy)]" data-testid="edit-step-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Edit Step {step + 1}</DialogTitle>
          <DialogDescription>Only this step&apos;s line in &quot;Admin - Model Vessel - {wizard.title}&quot; is changed. &quot;Press Next&quot; is added for you if it isn&apos;t at the end.</DialogDescription>
        </DialogHeader>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={4000} className="field-input !h-auto min-h-[9rem] resize-y py-2 text-base leading-snug" aria-label="Step text" data-testid="edit-step-text" />
        <div className="flex gap-2">
          <Add n={before} set={setBefore} label="Add step before" id="before" />
          <Add n={after} set={setAfter} label="Add step after" id="after" />
        </div>
        {(before > 0 || after > 0) && <p className="text-sm text-[var(--muted)]" data-testid="edit-step-added-note">{before + after} placeholder {before + after === 1 ? "step" : "steps"} will be added. Use Back and Next to reach them, then Edit Step to write them.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="edit-step-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" disabled={busy || !text.trim()} onClick={save} data-testid="edit-step-ok-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
