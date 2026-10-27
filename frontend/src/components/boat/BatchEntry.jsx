import { useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ScanRows, checkRows } from "@/components/boat/ScanReviewDialog";

const STATUS = {
  queued: { text: "Waiting to scan", cls: "bg-slate-100 text-slate-700" },
  scanning: { text: "Scanning...", cls: "bg-sky-100 text-sky-900" },
  done: { text: "Ready to review", cls: "bg-amber-100 text-amber-900" },
  error: { text: "Scan failed", cls: "bg-red-100 text-[var(--red)]" },
};

export const BatchEntry = ({ entry, n, existing, onPatch, onDelete, onRetry }) => {
  const [error, setError] = useState("");
  const st = entry.ticked ? { text: "Reviewed", cls: "bg-green-100 text-green-900" } : STATUS[entry.status];
  const tick = (v) => {
    if (!v) { onPatch({ ticked: false }); return; }
    const res = checkRows(entry.rows);
    if (typeof res === "string") { setError(res); return; }
    setError("");
    onPatch({ ticked: true });
  };
  return (
    <li className={`flex flex-col gap-2 rounded-lg border-[1.5px] p-3 ${entry.ticked ? "border-green-600 bg-green-50" : "border-[var(--line)] bg-white"}`} data-testid={`batch-entry-${n}`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={!!entry.ticked} disabled={entry.status !== "done"} onChange={(e) => tick(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-green-700 disabled:opacity-30" aria-label={`Contents of ${entry.name} reviewed`} data-testid={`batch-entry-tick-${n}`} />
        <img src={entry.preview} alt="" className="h-12 w-12 shrink-0 rounded-md border border-[var(--line)] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold" data-testid={`batch-entry-name-${n}`}>{entry.name}</div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`} data-testid={`batch-entry-status-${n}`}>
            {entry.status === "scanning" && <Loader2 className="h-3 w-3 animate-spin" />}{entry.ticked && <Check className="h-3 w-3" />}
            {st.text}{entry.status === "done" && !entry.ticked ? ` · ${entry.found} found` : ""}
          </span>
        </div>
        {entry.status === "error" && <button type="button" className="icon-btn" aria-label="Retry scan" onClick={onRetry} data-testid={`batch-entry-retry-${n}`}><RotateCcw className="h-[18px] w-[18px]" /></button>}
        <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label={`Remove ${entry.name} from batch`} onClick={onDelete} data-testid={`batch-entry-delete-${n}`}><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
      {existing && <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-900" data-testid={`batch-entry-replace-${n}`}><AlertTriangle className="h-4 w-4 shrink-0" /> Replaces the contents of your existing {existing.name}.</p>}
      {entry.status === "error" && <p className="text-sm font-semibold text-[var(--red)]" data-testid={`batch-entry-error-${n}`}>{entry.error}. Tap retry to scan it again.</p>}
      {entry.status === "done" && !entry.ticked && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-2">
          <p className="text-sm">{entry.found ? "Fix names or quantities, untick anything wrong, or add what it missed. Then tick the box above." : "Magic Scan couldn't spot any items. Add them below, then tick the box above."}</p>
          <ScanRows rows={entry.rows} setRows={(fn) => onPatch((e) => ({ rows: fn(e.rows) }))} prefix={`batch-${n}`} />
          {error && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid={`batch-entry-rows-error-${n}`}>{error}</p>}
        </div>
      )}
    </li>
  );
};
