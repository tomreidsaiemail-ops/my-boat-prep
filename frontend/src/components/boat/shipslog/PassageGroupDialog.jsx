import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { entryDate, niceDate, passageName, topLevel } from "@/lib/logFolders";

const FALLBACK = [
  { label: "Group a passage into one tidy folder." },
  { label: "Pick the first log of the passage as the Start log and the last one as the End log.", indent: true },
  { label: "Check the Source, Destination and dates; the folder is named Source - Destination - Date range.", indent: true },
  { label: "Everything from the Start log to the End log goes into the folder. Tap the folder to open or close it, or Ungroup to put the logs back.", indent: true },
];
const SEEN = "mbp_log_group_help_seen";
const short = (i, labelFor) => { const t = labelFor(i) || i.label || ""; const d = niceDate(entryDate(i)); return `${d ? `${d}: ` : ""}${t.length > 60 ? `${t.slice(0, 60)}...` : t}`; };

const HelpLines = ({ items }) => (
  <div className="space-y-1.5 text-sm leading-relaxed" data-testid="log-group-help-lines">
    {items.map((i, k) => <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : "font-semibold"}>{i.label}</p>)}
  </div>
);

const Pick = ({ id, label, value, options, onChange, labelFor }) => (
  <label className="flex flex-col gap-1"><span className="field-label">{label}</span>
    <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value) || e.target.value)} className="field-input" data-testid={id}>
      <option value="">Choose a log...</option>
      {options.map((i) => <option key={i.id} value={i.id}>{short(i, labelFor)}</option>)}
    </select>
  </label>
);

const Field = ({ id, label, ...p }) => (
  <label className="flex min-w-0 flex-col gap-1"><span className="field-label">{label}</span><input {...p} className="field-input" data-testid={id} /></label>
);

// Pick a start and end log, then name the folder Source - Destination - Date range.
export const PassageGroupDialog = ({ items, labelFor, boat, help, onGroup, onClose }) => {
  const options = topLevel(items).filter((i) => i.folder !== "year");
  const [showHelp, setShowHelp] = useState(() => localStorage.getItem(SEEN) !== "1");
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [src, setSrc] = useState(boat.route_start || "");
  const [dst, setDst] = useState(boat.route_dest || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const dateOf = (id) => entryDate(options.find((i) => i.id === id) || {});
  const pickStart = (id) => { setStart(id); if (!from) setFrom(dateOf(id)); };
  const pickEnd = (id) => { setEnd(id); if (!to) setTo(dateOf(id)); };
  const closeHelp = () => { localStorage.setItem(SEEN, "1"); setShowHelp(false); };
  const save = () => {
    if (!start || !end) { setError("Choose a Start log and an End log."); return; }
    if (!src.trim() || !dst.trim()) { setError("Enter the Source and Destination."); return; }
    if (from && to && from > to) { setError("The From date is after the To date."); return; }
    onGroup(start, end, { src, dst, from, to });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="log-group-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 font-display text-xl font-extrabold">Group a passage
            <button type="button" className="icon-btn" onClick={() => setShowHelp((v) => !v)} aria-label="How grouping works" data-testid="log-group-help-btn"><HelpCircle className="h-5 w-5" /></button>
          </DialogTitle>
          <DialogDescription className="sr-only">Put the logs of one passage into a folder</DialogDescription>
        </DialogHeader>
        {showHelp && (
          <div className="rounded-lg border-2 border-[var(--navy)] bg-sky-50 p-3" data-testid="log-group-help">
            <HelpLines items={help?.length ? help : FALLBACK} />
            <button type="button" className="btn-solid mt-3 h-9 min-h-0 px-4 text-sm" onClick={closeHelp} data-testid="log-group-help-ok">Got it</button>
          </div>
        )}
        {options.length < 1 ? <p className="text-sm" data-testid="log-group-empty">There are no logs to group yet.</p> : (
          <div className="flex flex-col gap-3">
            <Pick id="log-group-start" label="Start log" value={start} options={options} onChange={pickStart} labelFor={labelFor} />
            <Pick id="log-group-end" label="End log" value={end} options={options} onChange={pickEnd} labelFor={labelFor} />
            <div className="grid grid-cols-2 gap-2">
              <Field id="log-group-src" label="Source" value={src} maxLength={60} placeholder="e.g. Auckland" onChange={(e) => setSrc(e.target.value)} />
              <Field id="log-group-dst" label="Destination" value={dst} maxLength={60} placeholder="e.g. Russell" onChange={(e) => setDst(e.target.value)} />
              <Field id="log-group-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Field id="log-group-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <p className="text-sm" data-testid="log-group-preview">Folder name: <b>{passageName(src, dst, from, to)}</b></p>
            {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="log-group-error">{error}</p>}
          </div>
        )}
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose} data-testid="log-group-cancel-btn">Cancel</button>
          {options.length > 0 && <button type="button" className="btn-solid px-4" onClick={save} data-testid="log-group-save-btn">Group logs</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
