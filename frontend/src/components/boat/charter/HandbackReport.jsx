import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { fmtPeriod } from "@/lib/charter";
import { localWhen } from "@/lib/timeAgo";
import { Stars } from "@/components/boat/charter/Stars";

const Part = ({ title, children, testId }) => (
  <section className="flex flex-col gap-1.5 break-inside-avoid" data-testid={testId}>
    <h3 className="border-b border-[var(--line)] pb-1 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</h3>
    {children}
  </section>
);

const Items = ({ items, empty, testId, ticks }) => (items.length
  ? <ul className="flex flex-col gap-1 text-sm" data-testid={testId}>{items.map((i, k) => (
      <li key={k} className="flex gap-2"><span className="shrink-0 font-bold">{ticks ? (i.checked ? "☑" : "☐") : "•"}</span>
        <span className="min-w-0 break-words">{i.label}{i.ts && <span className="block text-xs text-[var(--muted)]">{localWhen(i.ts)}</span>}</span></li>))}</ul>
  : <p className="text-sm text-[var(--muted)]" data-testid={`${testId}-empty`}>{empty}</p>);

// One page for the owner once a charter ends: what the charter skipper logged, left to do, walked through and thought of it.
export const HandbackReport = ({ charterId, vessel, onClose }) => {
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/charters/${charterId}/report`).then(({ data }) => setR(data)).catch((e) => setError(apiError(e, "Couldn't load the report"))); }, [charterId]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="print-area flex max-h-[92vh] max-w-xl flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)] print:max-h-none print:overflow-visible" data-testid="handback-report">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase">Charter Handback Report</DialogTitle>
          <DialogDescription className="text-left" data-testid="handback-summary">
            {r ? `${vessel}: ${r.name} (${r.email}), ${fmtPeriod(r)}.` : error || "Loading..."}
          </DialogDescription>
        </DialogHeader>
        {!r && !error && <Loader2 className="h-6 w-6 animate-spin self-center" />}
        {r && <>
          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2" data-testid="handback-dates">
            {r.handed_at && <span><b>Handed over:</b> {localWhen(r.handed_at)}</span>}
            {r.returned_at && <span><b>Handed back:</b> {localWhen(r.returned_at)}</span>}
            <span><b>Terms accepted:</b> {r.terms_accepted_at ? localWhen(r.terms_accepted_at) : "Not accepted"}</span>
          </div>
          <Part title="Charter skipper's rating" testId="handback-feedback">
            {r.feedback ? <>
              <Stars value={r.feedback.rating} size="h-5 w-5" testId="handback-stars" />
              {r.feedback.comment && <p className="whitespace-pre-wrap text-sm" data-testid="handback-comment">&ldquo;{r.feedback.comment}&rdquo;</p>}
              <span className="text-xs text-[var(--muted)]">{localWhen(r.feedback.at)}</span>
            </> : <p className="text-sm text-[var(--muted)]" data-testid="handback-no-feedback">{r.name} hasn&apos;t rated the charter yet.</p>}
          </Part>
          <Part title={`Zone Map Walk Through (${(r.walk_stops || []).length} ${(r.walk_stops || []).length === 1 ? "stop" : "stops"})`} testId="handback-walk">
            <Items items={(r.walk_stops || []).map((label) => ({ label, checked: true }))} ticks empty="No walkthrough signed off." testId="handback-walk-list" />
          </Part>
          <Part title={`Ship's Log (${r.ship_log.length})`} testId="handback-log">
            <Items items={r.ship_log} empty="Nothing logged." testId="handback-log-list" />
          </Part>
          <Part title={`My To Do List (${r.todo.length})`} testId="handback-todo">
            <Items items={r.todo} ticks empty="Nothing left to do." testId="handback-todo-list" />
          </Part>
        </>}
        <div className="flex gap-2 print:hidden">
          <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" disabled={!r} onClick={() => window.print()} data-testid="handback-print-btn"><Printer className="h-4 w-4" /> Print / Save as PDF</button>
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="handback-close-btn">Close</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
