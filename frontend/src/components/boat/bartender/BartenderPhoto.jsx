import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, RotateCcw, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

// Optional Bartender Photo: scanned for drink ingredients, then shown small with what was found underneath.
export const BartenderPhoto = ({ boatId, online, photo, onChange }) => {
  const input = useRef(null);
  const [big, setBig] = useState(false);
  const pick = () => (online ? input.current?.click() : toast.error("The Magic Bartender needs a signal to read the photo"));
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a photo"); return; }
    if (photo?.preview) URL.revokeObjectURL(photo.preview);
    const preview = URL.createObjectURL(blob);
    setBig(false);
    onChange({ preview, status: "scanning", items: [] });
    const form = new FormData();
    form.append("file", blob, "bartender.jpg");
    try {
      const { data } = await api.post(`/boats/${boatId}/scan`, form, { params: { bartender: true }, timeout: 90000 });
      onChange({ preview, status: "done", items: data.items.map((i) => i.name) });
    } catch (err) { onChange({ preview, status: "error", items: [], error: apiError(err, "The Magic Bartender couldn't read that photo") }); }
  };
  const clear = () => { URL.revokeObjectURL(photo.preview); onChange(null); };
  return (
    <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] p-3" data-testid="bartender-photo">
      <p className="field-label">Bartender Photo</p>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={upload} data-testid="bartender-photo-input" />
      {!photo ? (
        <button type="button" className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-slate-50 px-4 text-center text-sm font-bold [transition:background-color_.15s] hover:bg-sky-50" onClick={pick} data-testid="bartender-photo-btn">
          <Camera className="h-8 w-8" /> Tap to take a photo of your drinks
          <span className="text-xs font-semibold text-[var(--muted)]">e.g. lemon, ginger, gin, vodka, coke and orange juice on the table</span>
        </button>
      ) : (
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? "Make the photo small" : "Show the photo bigger"} data-testid="bartender-photo-thumb"
            className={`shrink-0 overflow-hidden rounded-md border-[1.5px] border-[var(--line)] [transition:width_.2s,height_.2s] ${big ? "h-40 w-40" : "h-14 w-14"}`}>
            <img src={photo.preview} alt="Bartender Photo" className="h-full w-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            {photo.status === "scanning" && <p className="flex items-center gap-2 text-sm font-bold" data-testid="bartender-photo-scanning"><Loader2 className="h-4 w-4 animate-spin" /> Reading your drinks...</p>}
            {photo.status === "error" && <p className="text-sm font-bold text-[var(--red)]" data-testid="bartender-photo-error">{photo.error}</p>}
            {photo.status === "done" && (photo.items.length ? (
              <ul className="flex flex-wrap gap-1" data-testid="bartender-photo-items">
                {photo.items.map((n) => <li key={n} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">{n}</li>)}
              </ul>
            ) : <p className="text-sm text-[var(--muted)]" data-testid="bartender-photo-none">No drink ingredients found in this photo.</p>)}
            <div className="mt-2 flex gap-1">
              <button type="button" className="btn-ghost h-8 min-h-0 gap-1 px-2 text-xs" onClick={pick} disabled={photo.status === "scanning"} data-testid="bartender-photo-retake-btn"><RotateCcw className="h-3.5 w-3.5" /> Retake</button>
              <button type="button" className="btn-ghost h-8 min-h-0 gap-1 px-2 text-xs" onClick={clear} disabled={photo.status === "scanning"} data-testid="bartender-photo-remove-btn"><X className="h-3.5 w-3.5" /> Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
