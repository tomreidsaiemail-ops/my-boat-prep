import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { BoatPhoto } from "@/components/boat/BoatPhoto";

// Shrink phone photos to a small JPEG before uploading, so it's quick even on a weak signal.
const shrink = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.85);
  };
  img.onerror = () => reject(new Error("read"));
  img.src = URL.createObjectURL(file);
});

export const PhotoPicker = ({ boat, online, onChanged }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => (online ? input.current?.click() : toast.error("Go online to change the boat photo"));
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose a photo"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await shrink(file), "boat.jpg");
      const { data } = await api.post(`/boats/${boat.boat_id}/photo`, form, { timeout: 60000 });
      onChanged(data.photo_v);
      toast.success("Boat photo saved");
    } catch (err) { toast.error(err.message === "read" ? "Couldn't read that photo" : apiError(err, "Couldn't save the photo, please try again")); }
    finally { setBusy(false); }
  };
  const removePhoto = async () => {
    if (!online) { toast.error("Go online to change the boat photo"); return; }
    try { await api.delete(`/boats/${boat.boat_id}/photo`); onChanged(null); toast.success("Boat photo removed"); }
    catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="flex items-center gap-3" data-testid="photo-picker">
      <BoatPhoto boat={boat} size="h-16 w-16" testId="photo-picker-preview" />
      <button type="button" className="btn-ghost flex h-11 items-center gap-2 px-4" disabled={busy} onClick={pick} data-testid="boat-photo-upload-btn">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {boat.photo_v ? "Change photo" : "Add photo"}
      </button>
      {boat.photo_v && (
        <button type="button" className="icon-btn hover:text-[var(--red)]" onClick={removePhoto} aria-label="Remove photo" data-testid="boat-photo-remove-btn"><Trash2 className="h-[18px] w-[18px]" /></button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="boat-photo-input" />
    </div>
  );
};
