import { useRef } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { shrink } from "@/components/boat/PhotoPicker";

// Attach or take a photo for the Doctor; the phone offers camera or gallery.
export const DoctorPhotoPicker = ({ photo, onChange, disabled }) => {
  const input = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await shrink(file, 1600);
      if (photo) URL.revokeObjectURL(photo.preview);
      onChange({ blob, preview: URL.createObjectURL(blob) });
    } catch { toast.error("That file doesn't look like a photo"); }
  };
  const clear = () => { URL.revokeObjectURL(photo.preview); onChange(null); };
  return (
    <div className="flex items-center gap-2" data-testid="doctor-photo">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="doctor-photo-input" />
      {photo ? (
        <>
          <img src={photo.preview} alt="Photo for the Doctor" className="h-14 w-14 rounded-md border-[1.5px] border-[var(--line)] object-cover" data-testid="doctor-photo-preview" />
          <span className="flex-1 text-xs text-[var(--muted)]">The Doctor will look at this photo with your question. It is kept with the answer.</span>
          <button type="button" className="icon-btn h-9 w-9" onClick={clear} disabled={disabled} aria-label="Remove photo" data-testid="doctor-photo-remove-btn"><X className="h-4 w-4" /></button>
        </>
      ) : (
        <button type="button" className="btn-ghost h-10 min-h-0 gap-2 px-3 text-sm" onClick={() => input.current?.click()} disabled={disabled} data-testid="doctor-photo-btn">
          <Camera className="h-4 w-4" /> Add or take a photo (optional)
        </button>
      )}
    </div>
  );
};
