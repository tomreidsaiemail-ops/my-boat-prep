import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/api";

export const FeedbackDialog = ({ open, onClose }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setError(""); }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Please enter a title"); return; }
    if (!message.trim()) { setError("Please enter your feedback"); return; }
    if (!navigator.onLine) { setError("You're offline. Please send your feedback when you have signal."); return; }
    setBusy(true);
    try {
      await api.post("/feedback", { title: title.trim(), message: message.trim() }, { timeout: 30000 });
      toast.success("Thanks! Your feedback has been sent");
      setTitle(""); setMessage("");
      onClose();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : d?.[0]?.msg?.replace("Value error, ", "") || "Couldn't send your feedback, please try again");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">Submit feedback</DialogTitle>
          <DialogDescription>Ideas, problems or praise: it goes straight to the My Boat Prep team.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="field-label flex flex-col gap-1">Title
            <input autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Idea for the Ship's Log"
              className="field-input text-base normal-case tracking-normal" data-testid="feedback-title-input" />
          </label>
          <label className="field-label flex flex-col gap-1">Feedback
            <textarea rows={5} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us more..."
              className="field-input min-h-[120px] resize-y py-3 text-base normal-case tracking-normal" data-testid="feedback-message-input" />
          </label>
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="feedback-error">{error}</div>}
          <DialogFooter className="flex-row justify-end gap-2">
            <button type="button" className="btn-ghost px-5" disabled={busy} onClick={onClose} data-testid="feedback-cancel-btn">Cancel</button>
            <button type="submit" className="btn-solid flex items-center gap-2 px-6" disabled={busy} data-testid="feedback-send-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Sending" : "Send"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
