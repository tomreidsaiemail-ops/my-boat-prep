import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, HelpCircle, ImagePlus, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpDialog } from "@/components/boat/HelpMenu";
import { shrink } from "@/components/boat/PhotoPicker";
import { ZoneBanner } from "@/components/boat/zone/ZoneBanner";
import { AreaNamePicker } from "@/components/boat/zone/AreaNamePicker";
import { BatchAreaWalk } from "@/components/boat/zone/BatchAreaWalk";
import { isGalley } from "@/components/boat/zone/BatchWalk";
import { ZoneCupboardChips } from "@/components/boat/zone/ZoneCupboardChips";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { WHERE_MAX } from "@/components/boat/inventory/AreaEditDialog";

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const HOW_IT_WORKS = [
  { label: "Name a cupboard that makes sense, open that cupboard - maybe pull a few things out so they appear on the photo, and take and use that photo, and press \"Confirm, and add another\". Continue around your boat taking photos and naming them, until you have taken a photo of all nooks and crannies." },
  { label: "Magic Scan will have been busy while you were taking photos, scroll its results and press Confirm Batch. Your boat inventory is done, and everything is searchable by you and crew." },
  { label: "It is easy if Magic Scan missed something at the back of the cupboard, use the + icon and just fix up that one cupboard, and then you are really done!" },
];

// Name + photo for one cupboard in a batch. Nothing is scanned until it's confirmed.
// walk: the yellow walkthrough, for the Galley.
export const BatchAreaForm = ({ open, zone, boat, existing, batchNames, full, onAdd, onClose, walk = false }) => {
  const [name, setName] = useState("");
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [where, setWhere] = useState("");
  const [noPhoto, setNoPhoto] = useState("");
  const [cupsOpen, setCupsOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const walkOn = walk && isGalley(zone);
  const [stage, setStage] = useState("scan");
  const [shown, setShown] = useState({ scan: true, another: true });
  const input = useRef(null);
  const body = useRef(null);
  const reset = () => { setName(""); setBlob(null); setPreview(""); setError(""); setWhere(""); setNoPhoto(""); setCupsOpen(true); };
  useEffect(() => { if (open) reset(); }, [open]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const clash = name.trim() && existing.find((a) => same(a.name, name));
  const waiting = zone ? existing.filter((a) => !batchNames.some((b) => same(b, a.name))) : [];
  // The walkthrough lights the next thing to do: the Cutlery Drawer, then where it is, then Confirm, and add another.
  const coach = walkOn && stage === "scan";
  const lit = { where: coach && !!name.trim() && !where.trim() && !blob, photo: coach && !!name.trim() && !blob, another: coach && !!name.trim() && !!blob };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { const b = await shrink(file, 1600); setBlob(b); setPreview(URL.createObjectURL(b)); setError(""); }
    catch { toast.error("That file doesn't look like a photo"); }
  };
  const confirm = (more, emptyOk = false) => {
    const n = name.trim();
    if (!n) { setError("Please enter the cupboard name"); return; }
    if (batchNames.some((b) => same(b, n))) { setError(`${n} is already in this batch`); return; }
    if (!blob && !emptyOk) { setNoPhoto(more ? "more" : "one"); return; }
    onAdd(n, blob, more, { where: where.trim().slice(0, WHERE_MAX) });
    if (!more) return;
    reset();
    if (coach) { setStage("another"); setShown({ scan: false, another: true }); }
    body.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const pickCup = (a) => { setName(a.name); setWhere(a.where || ""); setError(""); setCupsOpen(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent ref={body} dirty={!!(name.trim() || blob || where.trim())} className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="batch-area-form">
        <DialogHeader>
          {zone && <ZoneBanner zone={zone} boat={boat} testId="batch-area-zone-banner" />}
          {walkOn && <BatchAreaWalk stage={stage} shown={shown} count={batchNames.length} marks={{ name: !!name.trim(), where: !!where.trim(), photo: !!blob }} onToggle={(k) => setShown((s) => ({ ...s, [k]: !s[k] }))}
            onDone={() => { setStage("review"); setShown({ scan: false, another: false, review: true }); }} />}
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">{zone ? `New ${zone.label} cupboard` : "New cupboard"}</DialogTitle>
          <DialogDescription>Name the cupboard, locker, fridge or drawer, then take a photo of what's inside.</DialogDescription>
        </DialogHeader>
        {waiting.length > 0 && <ZoneCupboardChips zone={zone} cups={waiting} name={name} open={cupsOpen} onToggle={() => setCupsOpen(!cupsOpen)} onPick={pickCup} glowName={coach && !name.trim() ? "Cutlery Drawer" : ""} />}
        {zone && <AreaNamePicker zone={zone} name={name} used={[...existing.map((a) => a.name), ...batchNames]} onPick={(n) => { setName(n); setError(""); }} />}
        <input autoFocus={!zone} value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={zone ? `e.g. ${zone.label} - port cupboard under the bench` : "e.g. Aft starboard lazarette"}
          aria-label="Cupboard name" className="field-input" data-testid="batch-area-name-input" />
        {clash && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="batch-area-replace-warning">
          {(clash.items || []).length ? `${clash.name} is already ${zone ? `in ${zone.label}` : "on your boat"} with ${clash.items.length} listed ${clash.items.length === 1 ? "item" : "items"}. When you review it you choose to add to them or replace them.`
            : `${clash.name} is already ${zone ? `in ${zone.label}` : "on your boat"}, empty. This scan fills it.`}</p>}
        <input value={where} maxLength={WHERE_MAX} onChange={(e) => setWhere(e.target.value)} placeholder={`Where is it${zone ? ` in the ${zone.label}` : ""}? e.g. Under the port bench (optional)`}
          aria-label="Where the cupboard is" className={`field-input ${lit.where ? "mbp-glow" : ""}`} data-testid="batch-area-where-input" />
        <button type="button" onClick={() => input.current?.click()} className={`flex min-h-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-[var(--panel)] text-sm font-bold text-[var(--navy)] ${lit.photo ? "mbp-glow" : ""}`} data-testid="batch-area-photo-btn">
          {preview ? <img src={preview} alt="Cupboard" className="max-h-56 w-full object-contain" data-testid="batch-area-photo-preview" />
            : <><Camera className="h-7 w-7" /> Take or choose a photo
              <span className="px-4 text-center text-xs font-medium text-[var(--muted)]" data-testid="batch-area-photo-hint">Consider laying some things out so Magic Scan sees everything you want</span></>}
        </button>
        {preview && <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => input.current?.click()} data-testid="batch-area-photo-change-btn"><ImagePlus className="h-4 w-4" /> Change photo</button>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="batch-area-photo-input" />
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="batch-area-error">{error}</p>}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button type="button" className="btn-solid h-12" onClick={() => confirm(false)} data-testid="batch-area-confirm-btn">Confirm</button>
          <button type="button" className={`btn-ghost h-12 ${lit.another ? "mbp-glow" : ""}`} disabled={full} onClick={() => confirm(true)} data-testid="batch-area-confirm-another-btn">Confirm, and add another</button>
          {batchNames.length > 0 && (
            <button type="button" className={`btn-ghost h-12 gap-2 border-[var(--navy)] ${walkOn && stage === "review" ? "mbp-glow" : ""}`} onClick={onClose} data-testid="batch-area-review-btn">
              <ListChecks className="h-4 w-4" /> Review Batch ({batchNames.length} {batchNames.length === 1 ? "cupboard" : "cupboards"})
            </button>
          )}
          <button type="button" className="btn-ghost h-11 border-transparent" onClick={onClose} data-testid="batch-area-cancel-btn">{batchNames.length ? "Cancel this cupboard" : "Cancel"}</button>
          <button type="button" className="btn-ghost h-11 gap-2 border-transparent" onClick={() => setHelpOpen(true)} data-testid="batch-area-help-btn"><HelpCircle className="h-4 w-4" /> How Batch Magic Scan works</button>
        </DialogFooter>
        <HelpDialog help={helpOpen ? { title: "How Batch Magic Scan works", heading: "How Batch Magic Scan works", items: HOW_IT_WORKS } : null} onClose={() => setHelpOpen(false)} />
        <ConfirmDelete item={noPhoto ? {} : null} danger={false} testId="batch-area-empty" title={`No photo of ${name.trim() || "this cupboard"}`} confirmLabel="Create it empty" cancelLabel="Take a photo"
          note="It will be created empty, with nothing listed inside. You can Magic Scan it later from Boat Inventory."
          onConfirm={() => { const more = noPhoto === "more"; setNoPhoto(""); confirm(more, true); }} onClose={() => setNoPhoto("")} />
      </DialogContent>
    </Dialog>
  );
};
