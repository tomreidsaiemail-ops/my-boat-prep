import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { api, apiError } from "@/lib/api";

const daysLeft = (iso) => Math.max(1, Math.ceil((new Date(iso) - Date.now()) / 86400000));

// In the Add a boat window: boats deleted in the last 7 days, each with Bring back.
export const DeletedBoats = ({ open, online, onRestore }) => {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!open || !online) return;
    api.get("/me/deleted-boats", { timeout: 10000 }).then(({ data }) => setList(data.boats || [])).catch(() => setList([]));
  }, [open, online]);
  if (!list.length) return null;
  const bring = async (b) => {
    setBusy(b.boat_id);
    try { await onRestore(b); setList((l) => l.filter((x) => x.boat_id !== b.boat_id)); }
    catch (e) { toast.error(apiError(e, "Couldn't bring it back, please try again")); }
    finally { setBusy(""); }
  };
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3" data-testid="deleted-boats">
      <p className="field-label">Deleted boats you can bring back</p>
      <ul className="flex flex-col gap-2">
        {list.map((b) => (
          <li key={b.boat_id} className="flex items-center gap-2 rounded-md border-[1.5px] border-[var(--line)] bg-white p-2.5" data-testid={`deleted-boat-${b.boat_id}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold" data-testid={`deleted-boat-name-${b.boat_id}`}>{b.vessel || [b.make, b.model].filter(Boolean).join(" ") || "Boat with no name"}</div>
              <div className="text-xs text-[var(--muted)]" data-testid={`deleted-boat-days-${b.boat_id}`}>
                {daysLeft(b.expires_at)} {daysLeft(b.expires_at) === 1 ? "day" : "days"} left{b.crew_count ? ` · ${b.crew_count} crew come back too` : ""}
              </div>
            </div>
            <button type="button" className="btn-ghost h-10 shrink-0 gap-1.5 px-3" disabled={!!busy} onClick={() => bring(b)} data-testid={`deleted-boat-restore-${b.boat_id}`}>
              {busy === b.boat_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Bring back
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
