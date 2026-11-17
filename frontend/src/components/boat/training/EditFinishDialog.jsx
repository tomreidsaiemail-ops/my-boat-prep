import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";

const IF_ONLY = /^\s*\?\?\?\s*IF\s+\S+\s+\S/i;
const lineOk = (l) => (IF_ONLY.test(l) && !/\bthen\s+goto\b/i.test(l)) || (/^\s*(--|\$\$|%%)/.test(l) && l.replace(/^\s*(-+|\$+|%+)/, "").trim());

// Admin only: rewrite the Finish panel lines (--, ---, $$, $$$) at the end of this "Admin - Model Vessel - *" list.
export const EditFinishDialog = ({ open, wizard, raw, onSaved, onClose }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => { if (open) setText(raw.join("\n")); }, [open, raw]);
  // Start at the first line, not scrolled down.
  useEffect(() => { if (open) setTimeout(() => { if (box.current) box.current.scrollTop = 0; box.current?.closest("[role=dialog]")?.scrollTo?.(0, 0); }, 50); }, [open]);
  const lines = text.split("\n").filter((l) => l.trim());
  const bad = lines.map((l, n) => (lineOk(l) ? 0 : n + 1)).filter(Boolean);
  const save = async () => {
    setBusy(true);
    try {
      await api.post("/admin/wizard-finish", { wizard: wizard.key, expect: raw, lines });
      toast.success(`Finish panel saved to ${wizard.title}.`);
      onSaved();
    } catch (e) { toast.error(apiError(e, "Couldn't save the Finish panel. Please try again.")); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-w-2xl flex-col gap-3 rounded-lg border-2 border-[var(--navy)]" data-testid="edit-finish-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Edit Final</DialogTitle>
          <DialogDescription>
            One line each: -- bold heading, --- ticked item, $$ idea, $$$ link to another walkthrough by its name (e.g. $$$ Crew Registration and Invites...), %% closing paragraph (shown at the bottom, after the links). Put ???IF Q1 Yes on the line before a goal to show it only when question Q1 was answered Yes.
            These replace the Finish panel lines at the end of &quot;Admin - Model Vessel - {wizard.title}&quot;. The steps are not changed.
          </DialogDescription>
        </DialogHeader>
        <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={12} className="field-input !h-auto min-h-[16rem] resize-y !py-2 font-mono !text-sm leading-snug" aria-label="Finish panel lines" data-testid="edit-finish-text" />
        {bad.length > 0 && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="edit-finish-error">Every line must start with --, ---, $$, $$$, %% or ???IF and have some text. Check line {bad.slice(0, 5).join(", ")}.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="edit-finish-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" disabled={busy || bad.length > 0} onClick={save} data-testid="edit-finish-ok-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
