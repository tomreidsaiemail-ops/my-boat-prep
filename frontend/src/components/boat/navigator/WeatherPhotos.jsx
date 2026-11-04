import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CloudSun, Loader2, Maximize2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Img } from "@/components/boat/PhotoSlots";
import { shrink } from "@/components/boat/PhotoPicker";
import { api, apiError } from "@/lib/api";

export const MAX_WEATHER_PHOTOS = 5;
const STALE_MS = 12 * 3600 * 1000;
const day = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export const weatherUrl = (boatId, owner) => (pid) => `/boats/${boatId}/item-photo/${pid}${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`;

const Slot = ({ p, n, url, readOnly, onNote, onRemove, onFull }) => {
  const stale = p.at && Date.now() - new Date(p.at).getTime() > STALE_MS;
  return (
    <li className="flex gap-3 rounded-md border-[1.5px] border-[var(--line)] bg-white p-2" data-testid={`weather-photo-${n}`}>
      <button type="button" onClick={onFull} className="relative h-24 w-24 shrink-0 overflow-hidden rounded border border-[var(--line)]" aria-label={`Open weather and routing photo ${n + 1}`} data-testid={`weather-photo-${n}-open`}>
        <Img url={url} alt={`Weather and routing photo ${n + 1}`} className="h-full w-full" />
        <Maximize2 className="absolute bottom-1 right-1 h-4 w-4 rounded bg-white/80 p-0.5" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-xs font-bold ${stale ? "text-amber-700" : "text-[var(--muted)]"}`} data-testid={`weather-photo-${n}-age`}>
          Photo {n + 1}{p.at ? ` · added ${day(p.at)}` : ""}{stale ? " · over 12 hours old, check for a newer forecast" : ""}
        </span>
        {readOnly ? <p className="whitespace-pre-line text-sm" data-testid={`weather-photo-${n}-note-text`}>{p.note || "No note from the skipper."}</p> : (
          <textarea value={p.note || ""} onChange={(e) => onNote(e.target.value)} maxLength={600} rows={3} placeholder="Skipper's commentary, e.g. Front clears by 0900, 15-20 kn SW, go after lunch"
            className="field-input min-h-[72px] resize-y py-2 text-sm normal-case leading-snug tracking-normal" data-testid={`weather-photo-${n}-note`} />
        )}
        {!readOnly && <button type="button" onClick={onRemove} className="btn-ghost h-8 min-h-0 w-fit gap-1 px-2 text-xs" data-testid={`weather-photo-${n}-remove`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
      </div>
    </li>
  );
};

// Up to 5 screenshots from weather and routing products, each with the skipper's commentary, shared with the crew.
export const WeatherPhotos = ({ boat, onPatch, online, boatId, owner, readOnly }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(null);
  const w = boat.weather || {};
  const photos = w.photos || [];
  const url = weatherUrl(boatId, owner);
  const save = onPatch;
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("Adding a photo needs a signal"); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", await shrink(file, 1800), "weather.jpg");
      const { data } = await api.post(`/boats/${boatId}/item-photo`, form, { params: { list_id: "weatherRouting" }, timeout: 60000 });
      save({ photos: [...photos, { id: data.photo_id, note: "", at: new Date().toISOString() }].slice(0, MAX_WEATHER_PHOTOS) });
      toast.success("Weather and routing photo added");
    } catch (err) { toast.error(apiError(err, "Couldn't add the photo, please try again")); }
    setBusy(false);
  };
  const remove = (p) => {
    save({ photos: photos.filter((x) => x.id !== p.id) });
    // Photos already in the Ship's Log stay stored so the log keeps them.
    if (!p.logged && !p.shared) api.delete(`/boats/${boatId}/item-photo/${p.id}`).catch(() => {});
    toast.success("Photo removed");
  };
  if (readOnly && !photos.length) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="weather-photos">
      <h4 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide"><CloudSun className="h-4 w-4" /> Weather and routing photos ({photos.length} of {MAX_WEATHER_PHOTOS})</h4>
      {photos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {photos.map((p, n) => (
            <Slot key={p.id} p={p} n={n} url={url(p.id)} readOnly={readOnly} onFull={() => setFull(p)} onRemove={() => remove(p)}
              onNote={(v) => save({ photos: photos.map((x) => (x.id === p.id ? { ...x, note: v } : x)) })} />
          ))}
        </ul>
      )}
      {!readOnly && (
        <>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} data-testid="weather-photo-input" />
          <button type="button" className="btn-ghost h-11 justify-center gap-2" disabled={busy || photos.length >= MAX_WEATHER_PHOTOS} onClick={() => input.current?.click()} data-testid="weather-photo-add-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {photos.length >= MAX_WEATHER_PHOTOS ? "5 photos added (remove one to add another)" : "Add a weather or routing screenshot"}
          </button>
        </>
      )}
      <Dialog open={!!full} onOpenChange={(o) => !o && setFull(null)}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto p-3" data-testid="weather-photo-full">
          <DialogTitle className="pr-8 text-sm">Weather and routing photo</DialogTitle>
          {full && <Img url={url(full.id)} alt="Weather and routing photo" className="!object-contain max-h-[78vh] w-full" />}
          {full?.note && <p className="whitespace-pre-line text-sm">{full.note}</p>}
        </DialogContent>
      </Dialog>
    </section>
  );
};
