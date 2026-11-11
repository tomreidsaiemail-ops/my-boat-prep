import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpPanel } from "@/components/boat/HelpPanel";
import { shrink } from "@/components/boat/PhotoPicker";
import { ZoneBanner } from "@/components/boat/zone/ZoneBanner";
import { AreaNamePicker } from "@/components/boat/zone/AreaNamePicker";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { WHERE_MAX } from "@/components/boat/inventory/AreaEditDialog";

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Name + photo for one cupboard in a batch. Nothing is scanned until it's confirmed.
export const BatchAreaForm = ({ open, zone, boat, existing, batchNames, full, onAdd, onClose }) => {
  const [name, setName] = useState("");
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [where, setWhere] = useState("");
  const [noPhoto, setNoPhoto] = useState("");
  const input = useRef(null);
  const reset = () => { setName(""); setBlob(null); setPreview(""); setError(""); setWhere(""); setNoPhoto(""); };
  useEffect(() => { if (open) reset(); }, [open]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const clash = name.trim() && existing.find((a) => same(a.name, name));
  const waiting = zone ? existing.filter((a) => !batchNames.some((b) => same(b, a.name))) : [];

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
    if (more) reset();
  };
  const help = (
    <HelpPanel storageKey="mbp_batch_area_help_seen" title="How Batch Magic Scan works" testId="batch-area-help">
      <p>Name a cupboard that makes sense, open that cupboard - maybe pull a few things out so they appear on the photo, and take and use that photo, and press "Confirm, and add another". Continue around your boat taking photos and naming them, until you have taken a photo of all nooks and crannies.</p>
      <p>Magic Scan will have been busy while you were taking photos, scroll its results and press Confirm Batch. Your boat inventory is done, and everything is searchable by you and crew.</p>
      <p>It is easy if Magic Scan missed something at the back of the cupboard, use the + icon and just fix up that one cupboard, and then you are really done!</p>
    </HelpPanel>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dirty={!!(name.trim() || blob || where.trim())} className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="batch-area-form">
        <DialogHeader>
          {zone && <ZoneBanner zone={zone} boat={boat} testId="batch-area-zone-banner" />}
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">{zone ? `New ${zone.label} cupboard` : "New cupboard"}</DialogTitle>
          <DialogDescription>Name the cupboard, locker, fridge or drawer, then take a photo of what's inside.</DialogDescription>
        </DialogHeader>
        {!zone && help}
        {waiting.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="batch-area-zone-cupboards">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Your {zone.label} cupboards</span>
            <div className="flex flex-wrap gap-1.5">
              {waiting.map((a) => (
                <button key={a.id} type="button" onClick={() => { setName(a.name); setWhere(a.where || ""); setError(""); }} aria-pressed={same(name, a.name)} data-testid={`batch-area-zone-cupboard-${a.id}`}
                  className={`rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold [transition:background-color_.15s,color_.15s] ${same(name, a.name) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"}`}>
                  {a.name}{(a.items || []).length ? "" : " (empty)"}
                </button>
              ))}
            </div>
          </div>
        )}
        {zone && <AreaNamePicker zone={zone} name={name} used={[...existing.map((a) => a.name), ...batchNames]} onPick={(n) => { setName(n); setError(""); }} />}
        <input autoFocus={!zone} value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={zone ? `e.g. ${zone.label} - port cupboard under the bench` : "e.g. Aft starboard lazarette"}
          aria-label="Cupboard name" className="field-input" data-testid="batch-area-name-input" />
        {clash && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="batch-area-replace-warning">
          {(clash.items || []).length ? `${clash.name} is already ${zone ? `in ${zone.label}` : "on your boat"} with ${clash.items.length} listed ${clash.items.length === 1 ? "item" : "items"}. When you review it you choose to add to them or replace them.`
            : `${clash.name} is already ${zone ? `in ${zone.label}` : "on your boat"}, empty. This scan fills it.`}</p>}
        <input value={where} maxLength={WHERE_MAX} onChange={(e) => setWhere(e.target.value)} placeholder={`Where is it${zone ? ` in the ${zone.label}` : ""}? e.g. Under the port bench (optional)`}
          aria-label="Where the cupboard is" className="field-input" data-testid="batch-area-where-input" />
        <button type="button" onClick={() => input.current?.click()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-[var(--panel)] text-sm font-bold text-[var(--navy)]" data-testid="batch-area-photo-btn">
          {preview ? <img src={preview} alt="Cupboard" className="max-h-56 w-full object-contain" data-testid="batch-area-photo-preview" />
            : <><Camera className="h-7 w-7" /> Take or choose a photo
              <span className="px-4 text-center text-xs font-medium text-[var(--muted)]" data-testid="batch-area-photo-hint">Consider laying some things out so Magic Scan sees everything you want</span></>}
        </button>
        {preview && <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => input.current?.click()} data-testid="batch-area-photo-change-btn"><ImagePlus className="h-4 w-4" /> Change photo</button>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="batch-area-photo-input" />
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="batch-area-error">{error}</p>}
        {zone && help}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button type="button" className="btn-solid h-12" onClick={() => confirm(false)} data-testid="batch-area-confirm-btn">Confirm</button>
          <button type="button" className="btn-ghost h-12" disabled={full} onClick={() => confirm(true)} data-testid="batch-area-confirm-another-btn">Confirm, and add another</button>
          <button type="button" className="btn-ghost h-11 border-transparent" onClick={onClose} data-testid="batch-area-cancel-btn">Cancel</button>
        </DialogFooter>
        <ConfirmDelete item={noPhoto ? {} : null} danger={false} testId="batch-area-empty" title={`No photo of ${name.trim() || "this cupboard"}`} confirmLabel="Create it empty" cancelLabel="Take a photo"
          note="It will be created empty, with nothing listed inside. You can Magic Scan it later from Boat Inventory."
          onConfirm={() => { const more = noPhoto === "more"; setNoPhoto(""); confirm(more, true); }} onClose={() => setNoPhoto("")} />
      </DialogContent>
    </Dialog>
  );
};
