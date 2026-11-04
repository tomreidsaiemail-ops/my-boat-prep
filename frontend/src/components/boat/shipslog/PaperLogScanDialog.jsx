import { useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, Loader2, RotateCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { niceDate } from "@/lib/logFolders";
import usePaperQueue from "@/components/boat/shipslog/usePaperQueue";

const MAX = 20;
const STATUS = {
  queued: [Clock, "Waiting", "text-[var(--muted)]"], scanning: [Loader2, "Processing...", "text-sky-800"],
  done: [CheckCircle2, "Read", "text-emerald-800"], error: [RotateCw, "Didn't work", "text-[var(--red)]"],
};

const Status = ({ p, n, onRetry }) => {
  const [Icon, label, tone] = STATUS[p.status];
  return (
    <p className={`flex items-center gap-1.5 text-xs font-bold ${tone}`} data-testid={`paper-page-status-${n}`} data-status={p.status}>
      <Icon className={`h-3.5 w-3.5 ${p.status === "scanning" ? "animate-spin" : ""}`} /> {label}
      {p.status === "error" && <><span className="font-semibold">{p.error}</span><button type="button" className="ml-1 underline" onClick={onRetry} data-testid={`paper-page-retry-${n}`}>Try again</button></>}
    </p>
  );
};

const Fields = ({ p, n, onPatch }) => (
  <div className="grid min-w-0 flex-1 gap-2">
    <input value={p.title} maxLength={120} placeholder="Ship's Log title" onChange={(e) => onPatch({ title: e.target.value })} className="field-input" aria-label="Title" data-testid={`paper-page-title-${n}`} />
    <input type="date" value={p.date} onChange={(e) => onPatch({ date: e.target.value })} className="field-input" aria-label="Date" data-testid={`paper-page-date-${n}`} />
  </div>
);

const Page = ({ p, n, onPatch, onRemove, onRetry }) => (
  <li className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2.5" data-testid={`paper-page-${n}`}>
    <div className="flex items-start gap-2.5">
      <img src={p.url} alt={`Page ${n + 1}`} className="h-16 w-12 shrink-0 rounded object-cover" />
      <Fields p={p} n={n} onPatch={onPatch} />
      <button type="button" className="icon-btn shrink-0" onClick={onRemove} aria-label={`Remove page ${n + 1}`} data-testid={`paper-page-remove-${n}`}><Trash2 className="h-4 w-4" /></button>
    </div>
    <Status p={p} n={n} onRetry={onRetry} />
  </li>
);

const Review = ({ rows, onPatch }) => (
  <ul className="flex flex-col gap-3" data-testid="paper-review">
    {rows.map((p, n) => (
      <li key={p.key} className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2.5" data-testid={`paper-review-row-${n}`}>
        <div className="flex items-start gap-2.5">
          <img src={p.url} alt={`Page ${n + 1}`} className="h-16 w-12 shrink-0 rounded object-cover" />
          <Fields p={p} n={n} onPatch={(x) => onPatch(p.key, x)} />
        </div>
        <textarea value={p.text} rows={5} maxLength={1800} onChange={(e) => onPatch(p.key, { text: e.target.value })} className="field-input min-h-[110px] py-2 text-sm" aria-label="Page text" data-testid={`paper-page-text-${n}`} />
      </li>
    ))}
  </ul>
);

const Progress = ({ q }) => {
  const failed = q.pages.filter((p) => p.status === "error").length;
  const read = q.pages.filter((p) => p.status === "done").length;
  return (
    <p className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${failed && !q.position ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900"}`} role="status" data-testid="paper-scan-progress">
      {q.position ? <><Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Processing {q.position} of {q.pages.length}{q.pending > 1 ? ` · ${q.pending - 1} waiting` : ""}</>
        : failed ? <><RotateCw className="h-4 w-4 shrink-0" /> {read} read · {failed} didn&apos;t work (tap Try again)</>
          : <><CheckCircle2 className="h-4 w-4 shrink-0" /> All {q.pages.length} {q.pages.length === 1 ? "page" : "pages"} processed</>}
    </p>
  );
};

// Photos of paper log pages: reading starts straight away in the background while the skipper titles and dates each page, then a review step adds the rows.
export const PaperLogScanDialog = ({ boatId, onAdd, onClose }) => {
  const q = usePaperQueue(boatId);
  const [step, setStep] = useState("pages");
  const [error, setError] = useState("");
  const input = useRef(null);
  const done = q.pages.filter((p) => p.status === "done" && p.text.trim());
  const addFiles = (e) => {
    q.add([...(e.target.files || [])].filter((f) => f.type.startsWith("image/")).slice(0, MAX - q.pages.length));
    e.target.value = "";
  };
  const close = () => {
    const parts = [done.length && `${done.length} scanned ${done.length === 1 ? "page" : "pages"}`, q.position && "the page being read now (its Magic use is already spent)"].filter(Boolean);
    if (!parts.length || window.confirm(`Discard ${parts.join(" and ")}? The Magic uses can't be given back.`)) onClose();
  };
  const commit = () => {
    if (done.some((p) => !p.title.trim() || !p.date)) { setError("Give every log row a title and a date."); return; }
    onAdd(done.map((p, k) => ({ id: Date.now() + k, label: `${p.title.trim()} - ${niceDate(p.date)}: ${p.text.trim()}`.slice(0, 2000), log_date: p.date, paper: true, checked: false })));
  };
  const review = step === "review";
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="paper-scan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{review ? "Review your log rows" : "Batch Magic Scan Paper Logs"}</DialogTitle>
          <DialogDescription className="text-left text-sm">{review
            ? "Check each row's title, date and text, then tap OK to add them to the Ship's Log."
            : "Add all your log page photos at once. The Magic Mariner reads them in the background while you give each page its title and date. One Magic use per page."}</DialogDescription>
        </DialogHeader>
        {q.pages.length > 0 && !review && <Progress q={q} />}
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} data-testid="paper-scan-file-input" />
        {review ? <Review rows={done} onPatch={q.patch} /> : (
          <ul className="flex flex-col gap-2" data-testid="paper-pages">
            {q.pages.map((p, n) => <Page key={p.key} p={p} n={n} onPatch={(x) => q.patch(p.key, x)} onRemove={() => q.remove(p.key)} onRetry={() => q.retry(p.key)} />)}
          </ul>
        )}
        {!review && q.pages.length < MAX && (
          <button type="button" className="btn-ghost h-11 justify-center gap-2" onClick={() => input.current?.click()} data-testid="paper-scan-add-btn">
            <Camera className="h-4 w-4" /> {q.pages.length ? "Add more pages" : "Add page photos"} ({q.pages.length} of {MAX})
          </button>
        )}
        {error && review && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="paper-scan-error">{error}</p>}
        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          {review
            ? <button type="button" className="btn-ghost px-4" onClick={() => { setError(""); setStep("pages"); }} data-testid="paper-review-back-btn">Back</button>
            : <button type="button" className="btn-ghost px-4" onClick={close} data-testid="paper-scan-cancel-btn">Cancel</button>}
          {review
            ? <button type="button" className="btn-solid px-6" onClick={commit} data-testid="paper-review-ok-btn">OK, add {done.length} {done.length === 1 ? "row" : "rows"}</button>
            : <button type="button" className="btn-solid px-4" disabled={q.pending > 0 || !done.length} onClick={() => setStep("review")} data-testid="paper-scan-review-btn">
              {q.pending > 0 ? "Processing..." : `Review ${done.length} log ${done.length === 1 ? "row" : "rows"}`}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
