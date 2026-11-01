import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api, apiError } from "@/lib/api";

export const BudgetComments = ({ boat, onBoatChange, premium, online, onUpgrade }) => {
  const [busy, setBusy] = useState(false);
  const tried = useRef("");
  const notes = boat.budget_notes || "";
  const has = !!((boat.make || "").trim() || (boat.model || "").trim());
  const key = [boat.make, boat.model, boat.boat_type, boat.budget_currency].join("|");
  const ask = async (quiet = false) => {
    if (!premium) { onUpgrade(); return; }
    if (!has) { if (!quiet) toast.error("Fill in your boat's make and model first"); return; }
    if (!online) { if (!quiet) toast.error("The Magic Mariner needs a signal to write budgeting comments"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/budget", { make: boat.make || "", model: boat.model || "", boat_type: boat.boat_type || "", currency: boat.budget_currency || "",
        loa: boat.loa || "", units: boat.units === "ft" ? "ft" : "m" }, { timeout: 90000 });
      onBoatChange("budget_notes", data.answer);
    } catch (e) { toast.error(apiError(e, "The Magic Mariner couldn't write budgeting comments right now. Please try again.")); }
    setBusy(false);
  };
  useEffect(() => {
    if (premium && online && has && !notes.trim() && !busy && tried.current !== key) { tried.current = key; ask(true); }
  }, [premium, online, has, notes, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-1.5" data-testid="budget-comments">
      <div className="flex items-center justify-between gap-2">
        <span className="field-label flex items-center gap-1.5" data-testid="budget-comments-label"><Sparkles className="h-3.5 w-3.5" /> MAGIC MARINER BUDGETING COMMENTS</span>
        <button type="button" className="btn-ghost h-9 min-h-0 gap-1.5 px-2.5 text-xs" onClick={() => ask()} disabled={busy} data-testid="budget-comments-refresh-btn" title="Ask the Magic Mariner again">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {busy ? "Thinking..." : "Refresh"}
        </button>
      </div>
      <textarea rows={5} value={notes} maxLength={4000} onChange={(e) => onBoatChange("budget_notes", e.target.value)} data-testid="budget-comments-input"
        placeholder={!premium ? "Go Pro and the Magic Mariner suggests a yearly budget for your boat. You can also type your own notes here."
          : has ? "The Magic Mariner's yearly budget for your boat appears here." : "Fill in your boat's make and model and the Magic Mariner suggests a yearly budget."}
        className="field-input !h-auto resize-y py-2 text-sm leading-relaxed" />
    </div>
  );
};
