import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const EMPTY = { question: "", answer: "" };

export const FaqDialog = ({ open, initial, onConfirm, onClose }) => {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setForm({ ...EMPTY, ...initial }); setError(""); } }, [open, initial]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question) { setError("Please enter the question"); return; }
    if (!answer) { setError("Please enter the answer"); return; }
    setBusy(true);
    const res = await onConfirm({ question, answer });
    setBusy(false);
    if (typeof res === "string") setError(res);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="faq-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">{initial ? "Edit FAQ" : "Add a FAQ"}</DialogTitle>
          <DialogDescription>Every skipper will see this question and answer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="field-label flex flex-col gap-1">Question
            <textarea autoFocus rows={2} maxLength={300} value={form.question} onChange={set("question")} placeholder="e.g. Does the app work with no signal?"
              className="field-input min-h-[56px] resize-none py-3 text-base normal-case tracking-normal" data-testid="faq-question-input" />
          </label>
          <label className="field-label flex flex-col gap-1">Answer
            <textarea rows={5} maxLength={3000} value={form.answer} onChange={set("answer")} placeholder="Type the answer..."
              className="field-input min-h-[120px] resize-y py-3 text-base normal-case tracking-normal" data-testid="faq-answer-input" />
          </label>
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="faq-dialog-error">{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" disabled={busy} onClick={onClose} data-testid="faq-dialog-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid flex items-center gap-2 px-6" disabled={busy} data-testid="faq-dialog-confirm-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Saving" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
