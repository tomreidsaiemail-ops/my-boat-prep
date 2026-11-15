import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, API, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

export const areaPhotoUrl = (b, photo) => (b && photo?.id
  ? `${API}/boats/${b.boat_id}/area-photos/${photo.id}?${b.owner_id ? `owner=${encodeURIComponent(b.owner_id)}&` : ""}v=${encodeURIComponent(photo.v || "")}` : "");

export const MAX_CUPBOARD_PHOTOS = 3;
// Up to 3 photos per cupboard, box or folder; photo stays the first for older screens.
export const areaPhotos = (a) => (a?.photos?.length ? a.photos : a?.photo?.id ? [a.photo] : []);
export const withPhotos = (a, list) => {
  const { photo: _p, photos: _ps, ...rest } = a;
  const keep = list.filter(Boolean).slice(-MAX_CUPBOARD_PHOTOS);
  return keep.length ? { ...rest, photo: keep[0], photos: keep } : rest;
};

export const uploadAreaPhoto = async (boat, blob) => {
  const form = new FormData();
  form.append("file", blob, "cupboard.jpg");
  return (await api.post(`/boats/${boat.boat_id}/area-photos`, form, { timeout: 60000 })).data.photo;
};

export const StorePhotoTick = ({ checked, onChange, testId, what = "cupboard" }) => (
  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--navy)]" data-testid={testId}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${testId}-input`} />
    Store the {what} magic scan picture
  </label>
);

// Edit cupboard, box or folder: up to 3 photos (e.g. the engine bay), each uploaded straight away.
export const CupboardPhotoField = ({ boat, online, photos = [], onChange }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const full = photos.length >= MAX_CUPBOARD_PHOTOS;
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("You need a signal to add a cupboard photo"); return; }
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a picture"); return; }
    setBusy(true);
    try { const p = await uploadAreaPhoto(boat, blob); onChange([...photos, p]); }
    catch (err) { toast.error(apiError(err, "Couldn't save the photo")); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1.5" data-testid="cupboard-photo-field">
      <span className="field-label">Photos (optional, up to {MAX_CUPBOARD_PHOTOS})</span>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="cupboard-photo-list">
          {photos.map((p, n) => (
            <div key={p.id} className="relative">
              <img src={areaPhotoUrl(boat, p)} alt={`Photo ${n + 1}`} className="h-24 w-full rounded-md border-[1.5px] border-[var(--line)] object-cover" data-testid={`cupboard-photo-preview-${n}`} />
              <button type="button" className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[var(--red)] shadow" onClick={() => onChange(photos.filter((x) => x.id !== p.id))} aria-label={`Remove photo ${n + 1}`} data-testid={`cupboard-photo-remove-${n}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn-ghost h-10 justify-center px-3 text-sm" disabled={busy || full} onClick={() => input.current?.click()} data-testid="cupboard-photo-add-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {full ? `${MAX_CUPBOARD_PHOTOS} photos added` : photos.length ? "Add another photo" : "Add a photo"}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="cupboard-photo-input" />
      <span className="text-xs text-[var(--muted)]">The first photo is shown with the comment on the walkthrough stop. Magic Scan can read all of them.</span>
    </div>
  );
};

export const CupboardPhoto = ({ boat, area, testId, all }) => {
  const list = (all ? areaPhotos(area) : areaPhotos(area).slice(0, 1)).filter((p) => areaPhotoUrl(boat, p));
  if (!list.length) return null;
  return <div className="flex flex-col gap-2">{list.map((p, n) => <img key={p.id} src={areaPhotoUrl(boat, p)} alt={`${area.name} photo ${n + 1}`} className="max-h-[40vh] w-full rounded-md border-[1.5px] border-[var(--line)] object-contain" data-testid={n ? `${testId}-${n}` : testId} />)}</div>;
};

// Boat Inventory: an icon on the cupboard row shows it has a photo; tap to see it.
export const CupboardPhotoButton = ({ boat, area, placeholder }) => {
  const [open, setOpen] = useState(false);
  const n = areaPhotos(area).length;
  if (!n) return placeholder ? <span className="icon-btn invisible" aria-hidden="true" /> : null;
  return (
    <>
      <button type="button" className="icon-btn" aria-label={`See the photo of ${area.name}`} title="Cupboard photo" onClick={() => setOpen(true)} data-testid={`inventory-area-photo-${area.id}`}><ImageIcon className="h-[18px] w-[18px]" /></button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-lg border-2 border-[var(--navy)] p-4" data-testid={`inventory-area-photo-dialog-${area.id}`}>
          <DialogHeader><DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">{area.name}</DialogTitle>
            <DialogDescription>{area.comment || (n > 1 ? `${n} photos` : "Cupboard photo")}</DialogDescription></DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto"><CupboardPhoto boat={boat} area={area} all testId={`inventory-area-photo-img-${area.id}`} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
};
