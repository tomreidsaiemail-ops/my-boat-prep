import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { niceDate } from "@/lib/logFolders";

const MAX = 20;
let seq = 0;

const Page = ({ p, n, onPatch, onRemove, busy }) => (
  <li className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-2.5" data-testid={`paper-page-${n}`}>
    <div className="flex items-start gap-2.5">
      <img src={p.url} alt={`Page ${n + 1}`} className="h-16 w-12 shrink-0 rounded object-cover" />
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        <input value={p.title} maxLength={120} placeholder="Ship's Log title" disabled={busy} onChange={(e) => onPatch({ title: e.target.value })} className="field-input col-span-2" aria-label="Title" data-testid={`paper-page-title-${n}`} />
        <input type="date" value={p.date} disabled={busy} onChange={(e) => onPatch({ date: e.target.value })} className="field-input col-span-2" aria-label="Date" data-testid={`paper-page-date-${n}`} />
      </div>
      <button type="button" className="icon-btn shrink-0" onClick={onRemove} disabled={busy} aria-label={`Remove page ${n + 1}`} data-testid={`paper-page-remove-${n}`}><Trash2 className="h-4 w-4" /></button>
    </div>
    {p.status === "scanning" && <p className="flex items-center gap-2 text-sm font-semibold" data-testid={`paper-page-busy-${n}`}><Loader2 className="h-4 w-4 animate-spin" /> Reading the page...</p>}
    {p.status === "error" && <p className="text-sm font-bold text-[var(--red)]" data-testid={`paper-page-error-${n}`}>{p.error}</p>}
    {p.status === "done" && <textarea value={p.text} rows={5} maxLength={1800} onChange={(e) => onPatch({ text: e.target.value })} className="field-input min-h-[110px] py-2 text-sm" aria-label="Page text" data-testid={`paper-page-text-${n}`} />}
  </li>
);

// Photos of paper log pages, each with its own title and date; the Magic Mariner reads the writing into one log row per page.
export const PaperLogScanDialog = ({ boatId, onAdd, onClose }) => {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const input = useRef(null);
  const urls = useRef([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const patch = (key, p) => setPages((ps) => ps.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const addFiles = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/")).slice(0, MAX - pages.length);
    e.target.value = "";
    const fresh = files.map((file) => { const url = URL.createObjectURL(file); urls.current.push(url); return { key: ++seq, file, url, title: "", date: "", status: "new", text: "" }; });
    setPages((ps) => [...ps, ...fresh]);
  };
  const scan = async () => {
    const todo = pages.filter((p) => p.status !== "done");
    if (todo.some((p) => !p.title.trim() || !p.date)) { setError("Give every page a title and a date first."); return; }
    setError("");
    setRunning(true);
    for (const p of todo) {
      patch(p.key, { status: "scanning", error: "" });
      try {
        const form = new FormData();
        form.append("file", await shrink(p.file, 1600), "page.jpg");
        form.append("title", p.title.trim());
        form.append("date", p.date);
        const { data } = await api.post(`/boats/${boatId}/paper-log`, form, { timeout: 90000 });
        patch(p.key, { status: "done", text: data.text });
      } catch (err) {
        patch(p.key, { status: "error", error: apiError(err, "Couldn't read that page. Try a clearer photo.") });
        if (err?.response?.status === 429) break;
      }
    }
    setRunning(false);
  };
  const done = pages.filter((p) => p.status === "done" && p.text.trim());
  const close = () => { if (!done.length || window.confirm(`Discard ${done.length} scanned ${done.length === 1 ? "page" : "pages"}? The Magic uses can't be given back.`)) onClose(); };
  const add = () => onAdd(done.map((p, k) => ({ id: Date.now() + k, label: `${p.title.trim()} - ${niceDate(p.date)}: ${p.text.trim()}`.slice(0, 2000), log_date: p.date, paper: true, checked: false })));
  return (
    <Dialog open onOpenChange={(o) => !o && !running && close()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="paper-scan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Batch Magic Scan Paper Logs</DialogTitle>
          <DialogDescription className="text-left text-sm">Photograph each written log page, give it its title and date, and the Magic Mariner types it into a Ship&apos;s Log row. One Magic use per page.</DialogDescription>
        </DialogHeader>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} data-testid="paper-scan-file-input" />
        <ul className="flex flex-col gap-2" data-testid="paper-pages">
          {pages.map((p, n) => <Page key={p.key} p={p} n={n} busy={running} onPatch={(x) => patch(p.key, x)} onRemove={() => setPages((ps) => ps.filter((x) => x.key !== p.key))} />)}
        </ul>
        {pages.length < MAX && (
          <button type="button" className="btn-ghost h-11 justify-center gap-2" disabled={running} onClick={() => input.current?.click()} data-testid="paper-scan-add-btn">
            <Camera className="h-4 w-4" /> {pages.length ? "Add more pages" : "Add page photos"} ({pages.length} of {MAX})
          </button>
        )}
        {error && <p className="text-sm font-bold text-[var(--red)]" role="alert" data-testid="paper-scan-error">{error}</p>}
        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost px-4" disabled={running} onClick={close} data-testid="paper-scan-cancel-btn">Cancel</button>
          {pages.some((p) => p.status !== "done") && <button type="button" className="btn-solid px-4" disabled={running} onClick={scan} data-testid="paper-scan-run-btn">{running ? "Scanning..." : "Scan pages"}</button>}
          {done.length > 0 && !running && <button type="button" className="btn-solid px-4" onClick={add} data-testid="paper-scan-add-logs-btn">Add {done.length} {done.length === 1 ? "log" : "logs"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
