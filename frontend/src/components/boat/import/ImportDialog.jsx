import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportColumns } from "@/components/boat/import/ImportColumns";
import { ImportPreview } from "@/components/boat/import/ImportPreview";
import { defsFor, itemsFor, planImport, readFiles } from "@/lib/sheetImport";

const MAX_FILES = 10;
const MAX_MB = 10;

export const ImportDialog = ({ names, ctx, onImport, onClose }) => {
  const input = useRef(null);
  const [step, setStep] = useState("pick");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState([]);
  const [built, setBuilt] = useState([]);

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_FILES);
    e.target.value = "";
    if (!files.length) return;
    if (files.some((f) => !/\.(xlsx|xlsm|xls|csv)$/i.test(f.name))) { toast.error("Please choose .xlsx or .csv files"); return; }
    if (files.some((f) => f.size > MAX_MB * 1024 * 1024)) { toast.error(`Each file must be under ${MAX_MB} MB`); return; }
    setBusy(true);
    try {
      setPlan(planImport(await readFiles(files), names));
      setStep("columns");
    } catch { toast.error("Couldn't read that spreadsheet. Is it a valid .xlsx or .csv file?"); }
    setBusy(false);
  };
  const change = (n, patch) => setPlan((p) => p.map((t, k) => (k === n ? { ...t, ...patch } : t)));
  const toPreview = () => {
    const live = plan.filter((t) => !t.empty);
    if (!live.length) { toast.error("Every tab is empty, so there's nothing to import"); return; }
    const taken = new Set(names.map((x) => x.toLowerCase()));
    const seen = new Set();
    for (const t of live) {
      const nm = t.name.trim().toLowerCase();
      if (!nm) { toast.error("Every list needs a name"); return; }
      if (taken.has(nm) || seen.has(nm)) { toast.error(`You already have a list called ${t.name.trim()}`); return; }
      seen.add(nm);
    }
    const now = Date.now();
    setBuilt(live.map((t, n) => { const defs = defsFor(t); return { name: t.name.trim(), defs, items: itemsFor(t, defs, ctx, now + n * 10000) }; }));
    setStep("preview");
  };
  const empty = plan.filter((t) => t.empty);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto overflow-x-hidden rounded-lg border-2 border-[var(--navy)] [&>*]:min-w-0" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><FileUp className="h-5 w-5" /> Import Spreadsheet</DialogTitle>
          <DialogDescription className="text-left text-sm">
            {step === "pick" ? "Choose one or more .xlsx or .csv files. Each tab becomes its own list." : step === "columns" ? "Check each column's type. Text suits most columns." : "Nothing is saved until you tap Import."}
          </DialogDescription>
        </DialogHeader>
        {step === "pick" && (
          <button type="button" className="btn-solid min-h-12 w-full gap-2" disabled={busy} onClick={() => input.current?.click()} data-testid="import-pick-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Choose spreadsheets
          </button>
        )}
        <input ref={input} type="file" multiple accept=".xlsx,.xlsm,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={pick} data-testid="import-file-input" />
        {step === "columns" && <ImportColumns plan={plan} onChange={change} />}
        {step === "preview" && <ImportPreview built={built} empty={empty} />}
        <DialogFooter className="flex-row justify-end gap-2">
          {step !== "pick" && <button type="button" className="btn-ghost px-4" onClick={() => setStep(step === "preview" ? "columns" : "pick")} data-testid="import-back-btn">Back</button>}
          {step === "columns" && <button type="button" className="btn-solid px-5" onClick={toPreview} data-testid="import-preview-btn">Preview</button>}
          {step === "preview" && <button type="button" className="btn-solid px-5" onClick={() => onImport(built)} data-testid="import-confirm-btn">Import {built.length} {built.length === 1 ? "list" : "lists"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
