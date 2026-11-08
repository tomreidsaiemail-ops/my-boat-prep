import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Martini, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { areaIngredients, barAreas, uniqueNames } from "@/lib/bartender";
import { MagicHelp } from "@/components/boat/MagicHelp";
import { BartenderPhoto } from "@/components/boat/bartender/BartenderPhoto";
import { BarAreas } from "@/components/boat/bartender/BarAreas";

const HELP = ["Arrange some drink bottles, some lemons, on a table and take a photo.",
  "The MAGIC BARTENDER will be able to recommend quickly some cocktails for you, it will also tell you the ingredients, and how to mix them."];

// Extra ingredients from flagged Drinks (D) and food (F) cupboards, folded away so the basic flow is just a photo.
const AreaExtras = ({ areas, onFlag, onBatchScan, busy, photoItems, usePhoto, setUsePhoto, summary }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border-[1.5px] border-[var(--line)]" data-testid="bartender-areas-section">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-bold" data-testid="bartender-areas-toggle">
        Drinks (D) and food (F) cupboards
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3" data-testid="bartender-areas-body">
          <label className={`flex items-center gap-2 text-sm font-bold ${photoItems.length ? "" : "opacity-50"}`} data-testid="bartender-use-photo">
            <input type="checkbox" className="h-5 w-5 accent-[var(--navy)]" checked={usePhoto && photoItems.length > 0} disabled={!photoItems.length}
              onChange={(e) => setUsePhoto(e.target.checked)} data-testid="bartender-use-photo-checkbox" />
            Using the &apos;Bartender Photo&apos;
          </label>
          {areas.length ? <BarAreas areas={areas} onFlag={onFlag} />
            : <p className="rounded-md border-[1.5px] border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]" data-testid="bartender-no-areas">No cupboards yet. Photo your gantry and fridge first.</p>}
          <button type="button" className="btn-ghost h-auto min-h-10 justify-center gap-1.5 whitespace-normal py-2 text-center text-sm" onClick={onBatchScan} disabled={busy} data-testid="bartender-batch-scan-btn">
            <Sparkles className="h-4 w-4" /> Photo cupboards with Batch Magic Scan...
          </button>
          {summary}
        </div>
      )}
    </div>
  );
};

export const BartenderDialog = ({ open, boatId, areas, kids = 0, online, helpItems, onFlag, onBatchScan, onCreate, onClose }) => {
  const [photo, setPhoto] = useState(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const photoItems = photo?.status === "done" ? photo.items : [];
  const flagged = barAreas(areas);
  const ingredients = uniqueNames([...areaIngredients(areas), ...(usePhoto ? photoItems : [])]);
  const close = () => { if (busy) return; if (photo?.preview) URL.revokeObjectURL(photo.preview); setPhoto(null); onClose(); };
  const mix = async () => {
    if (!ingredients.length) { toast.error("Take a Bartender Photo of your drinks first"); return; }
    if (!online) { toast.error("The Magic Bartender needs a signal to mix your cocktails"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/bartender", { ingredients: ingredients.slice(0, 300), children: kids }, { timeout: 120000 });
      setBusy(false);
      if (photo?.preview) URL.revokeObjectURL(photo.preview);
      setPhoto(null);
      onCreate(data.cocktails);
    } catch (e) { setBusy(false); toast.error(apiError(e, "The Magic Bartender couldn't mix anything just now. Please try again.")); }
  };
  const summary = (
    <p className="rounded-md bg-[var(--panel)] px-3 py-2 text-sm font-bold" data-testid="bartender-summary">
      {ingredients.length} {ingredients.length === 1 ? "ingredient" : "ingredients"} from {flagged.length} flagged {flagged.length === 1 ? "area" : "areas"}{usePhoto && photoItems.length ? " and the Bartender Photo" : ""}
      {kids > 0 && <span className="block text-xs font-semibold text-[var(--muted)]" data-testid="bartender-kids-note">Children on board, so alcohol-free mocktails are added too.</span>}
    </p>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid="bartender-dialog"
        onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><Martini className="h-5 w-5" /> Magic Bartender</DialogTitle>
          <DialogDescription className="sr-only">Take a photo of your drinks and the Magic Bartender suggests cocktails.</DialogDescription>
        </DialogHeader>
        <MagicHelp storageKey="mbp_help_bartender" title="How the Magic Bartender works" items={helpItems} fallback={HELP} testId="bartender-help" />
        <BartenderPhoto boatId={boatId} online={online} photo={photo} onChange={setPhoto} />
        <AreaExtras areas={areas} onFlag={onFlag} onBatchScan={onBatchScan} busy={busy} photoItems={photoItems} usePhoto={usePhoto} setUsePhoto={setUsePhoto} summary={summary} />
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={close} disabled={busy} data-testid="bartender-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-1 gap-2 disabled:opacity-40" onClick={mix} disabled={busy || photo?.status === "scanning" || !ingredients.length} data-testid="bartender-mix-btn">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Mixing...</> : <><Martini className="h-4 w-4" /> Mix my cocktails</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
