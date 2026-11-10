import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

export const areaPhotoUrl = (b, photo) => (b && photo?.id
  ? `${API}/boats/${b.boat_id}/area-photos/${photo.id}?${b.owner_id ? `owner=${encodeURIComponent(b.owner_id)}&` : ""}v=${encodeURIComponent(photo.v || "")}` : "");

// Edit cupboard: take or pick one photo of the cupboard (e.g. the engine bay), uploaded straight away.
export const CupboardPhotoField = ({ boat, online, photo, onChange }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("You need a signal to add a cupboard photo"); return; }
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a picture"); return; }
    const form = new FormData();
    form.append("file", blob, "cupboard.jpg");
    setBusy(true);
    try { onChange((await api.post(`/boats/${boat.boat_id}/area-photos`, form, { timeout: 60000 })).data.photo); }
    catch (err) { toast.error(apiError(err, "Couldn't save the photo")); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1.5" data-testid="cupboard-photo-field">
      <span className="field-label">Cupboard photo (optional)</span>
      {photo && <img src={areaPhotoUrl(boat, photo)} alt="This cupboard" className="max-h-44 w-full rounded-md border-[1.5px] border-[var(--line)] object-contain" data-testid="cupboard-photo-preview" />}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost h-10 flex-1 justify-center px-3 text-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="cupboard-photo-add-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {photo ? "Replace photo" : "Add a photo"}
        </button>
        {photo && <button type="button" className="btn-ghost h-10 px-3 text-sm hover:text-[var(--red)]" onClick={() => onChange(null)} aria-label="Remove the cupboard photo" data-testid="cupboard-photo-remove-btn"><Trash2 className="h-4 w-4" /></button>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="cupboard-photo-input" />
      <span className="text-xs text-[var(--muted)]">Shown with the cupboard comment on this cupboard&apos;s walkthrough stop.</span>
    </div>
  );
};

export const CupboardPhoto = ({ boat, area, testId }) => {
  const src = areaPhotoUrl(boat, area?.photo);
  if (!src) return null;
  return <img src={src} alt={`${area.name} photo`} className="max-h-[40vh] w-full rounded-md border-[1.5px] border-[var(--line)] object-contain" data-testid={testId} />;
};

// Boat Inventory: an icon on the cupboard row shows it has a photo; tap to see it.
export const CupboardPhotoButton = ({ boat, area, placeholder }) => {
  const [open, setOpen] = useState(false);
  if (!areaPhotoUrl(boat, area.photo)) return placeholder ? <span className="icon-btn invisible" aria-hidden="true" /> : null;
  return (
    <>
      <button type="button" className="icon-btn" aria-label={`See the photo of ${area.name}`} title="Cupboard photo" onClick={() => setOpen(true)} data-testid={`inventory-area-photo-${area.id}`}><ImageIcon className="h-[18px] w-[18px]" /></button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-lg border-2 border-[var(--navy)] p-4" data-testid={`inventory-area-photo-dialog-${area.id}`}>
          <DialogHeader><DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">{area.name}</DialogTitle>
            <DialogDescription>{area.comment || "Cupboard photo"}</DialogDescription></DialogHeader>
          <CupboardPhoto boat={boat} area={area} testId={`inventory-area-photo-img-${area.id}`} />
        </DialogContent>
      </Dialog>
    </>
  );
};
