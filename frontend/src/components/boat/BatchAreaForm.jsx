import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shrink } from "@/components/boat/PhotoPicker";

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Name + photo for one boat area in a batch. Nothing is scanned until it's confirmed.
export const BatchAreaForm = ({ open, existing, batchNames, full, onAdd, onClose }) => {
  const [name, setName] = useState("");
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const input = useRef(null);
  const reset = () => { setName(""); setBlob(null); setPreview(""); setError(""); };
  useEffect(() => { if (open) reset(); }, [open]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const clash = name.trim() && existing.find((a) => same(a.name, name));

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { const b = await shrink(file, 1600); setBlob(b); setPreview(URL.createObjectURL(b)); setError(""); }
    catch { toast.error("That file doesn't look like a photo"); }
  };
  const confirm = (more) => {
    const n = name.trim();
    if (!n) { setError("Please enter the boat area name"); return; }
    if (batchNames.some((b) => same(b, n))) { setError(`${n} is already in this batch`); return; }
    if (!blob) { setError("Please take or choose a photo of the boat area"); return; }
    onAdd(n, blob, more);
    if (more) reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="batch-area-form">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">New boat area</DialogTitle>
          <DialogDescription>Name the cupboard, locker, fridge or drawer, then take a photo of what's inside.</DialogDescription>
        </DialogHeader>
        <input autoFocus value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Aft starboard lazarette"
          aria-label="Boat area name" className="field-input" data-testid="batch-area-name-input" />
        {clash && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="batch-area-replace-warning">
          {clash.name} is already on your boat. Confirming the batch will replace its {(clash.items || []).length} listed {(clash.items || []).length === 1 ? "item" : "items"} with this scan.</p>}
        <button type="button" onClick={() => input.current?.click()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-[var(--panel)] text-sm font-bold text-[var(--navy)]" data-testid="batch-area-photo-btn">
          {preview ? <img src={preview} alt="Boat area" className="max-h-56 w-full object-contain" data-testid="batch-area-photo-preview" />
            : <><Camera className="h-7 w-7" /> Take or choose a photo</>}
        </button>
        {preview && <button type="button" className="btn-ghost h-10 self-start px-3 text-sm" onClick={() => input.current?.click()} data-testid="batch-area-photo-change-btn"><ImagePlus className="h-4 w-4" /> Change photo</button>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="batch-area-photo-input" />
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="batch-area-error">{error}</p>}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button type="button" className="btn-solid h-12" onClick={() => confirm(false)} data-testid="batch-area-confirm-btn">Confirm</button>
          <button type="button" className="btn-ghost h-12" disabled={full} onClick={() => confirm(true)} data-testid="batch-area-confirm-another-btn">Confirm, and add another</button>
          <button type="button" className="btn-ghost h-11 border-transparent" onClick={onClose} data-testid="batch-area-cancel-btn">Cancel</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
