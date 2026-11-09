import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Stars } from "@/components/boat/charter/Stars";

// Once the owner ends the charter, the charter skipper gives it a quick star rating; only the owner sees it.
export const CharterFeedback = ({ boat, online }) => {
  const [state, setState] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!online) return;
    api.get("/charter-feedback", { params: { boat_id: boat.boat_id } }).then(({ data }) => {
      setState(data); setRating(data.feedback?.rating || 0); setComment(data.feedback?.comment || "");
    }).catch(() => {});
  }, [boat.boat_id, online]);
  if (!state?.can_rate) return null;
  const send = async () => {
    if (!rating) { toast.error("Pick 1 to 5 stars first"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/charter-feedback", { rating, comment }, { params: { boat_id: boat.boat_id } });
      setState((s) => ({ ...s, feedback: data.feedback })); toast.success(`Thanks! ${boat.charter.owner_name || "The owner"} can see your rating`);
    } catch (e) { toast.error(apiError(e, "Couldn't send your rating, please try again")); } finally { setBusy(false); }
  };
  const sent = state.feedback && state.feedback.rating === rating && (state.feedback.comment || "") === comment.trim();
  return (
    <section className="flex flex-col gap-2 rounded-lg border-2 border-[var(--navy)] bg-white px-4 py-3" data-testid="charter-feedback-card">
      <h3 className="font-display text-base font-extrabold uppercase">How was your charter?</h3>
      <p className="text-sm text-[var(--muted)]">Rate your charter of {boat.charter.vessel}. Only {boat.charter.owner_name || "the owner"} sees it.</p>
      <Stars value={rating} onPick={setRating} testId="charter-feedback-stars" />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Anything the owner should know? (optional)"
        className="field-input min-h-[80px] py-2" data-testid="charter-feedback-comment" />
      <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={busy || !online || sent} onClick={send} data-testid="charter-feedback-send-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sent ? "Rating sent" : state.feedback ? "Update my rating" : "Send my rating"}
      </button>
    </section>
  );
};
