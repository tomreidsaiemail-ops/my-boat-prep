import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { api, apiError } from "@/lib/api";
import { fmtDay, onOrDayBefore } from "@/lib/charter";

const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Owner only: ends the charter, unlocks their boat and brings the charter skipper's Ship's Log and To Do entries back.
export const EndCharter = ({ c, vessel, online, onEnded, className = "btn-solid h-10 flex-1 justify-center gap-2" }) => {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = async () => {
    setAsking(false); setBusy(true);
    try {
      const { data } = await api.post(`/charters/${c.charter_id}/return`);
      toast.success(`Charter ended. ${vessel} is yours again, with ${counted(data.log_entries, "Ship's Log entry", "Ship's Log entries")} and ${counted(data.todo_entries, "To Do item", "To Do items")} from ${c.name}.${data.emailed ? ` We emailed ${c.name} a thank-you.` : ""}`);
      window.dispatchEvent(new Event("mbp:refresh-boat"));
      onEnded?.();
    } catch (err) { toast.error(apiError(err, "Couldn't end the charter, please try again")); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={className} disabled={busy || !online} onClick={() => setAsking(true)} data-testid={`charter-end-btn-${c.charter_id}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} End charter
      </button>
      <ConfirmDelete item={asking ? {} : null} danger={false} testId="charter-end" title={`End ${c.name}'s charter?`} confirmLabel="End charter" cancelLabel="Not yet"
        note={`${vessel} unlocks for you and your crew. ${c.name}'s Ship's Log and My To Do List entries are added to yours, labelled with their name. Their copy stays read only for 7 days, then it is deleted. We email ${c.name} a short thank-you.`}
        warning={onOrDayBefore(c.end) ? null : `Today isn't the last day of the charter or the day before. It ends ${fmtDay(c.end)}. End it anyway?`}
        onConfirm={end} onClose={() => setAsking(false)} />
    </>
  );
};
