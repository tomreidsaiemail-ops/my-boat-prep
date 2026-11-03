import { useEffect, useState } from "react";
import { Camera, Expand, Pencil, X } from "lucide-react";
import { api } from "@/lib/api";

export const SLOTS = [
  { key: "before", label: "Before", id: "photo_id", note: "photo_note" },
  { key: "after", label: "After", id: "after_id", note: "after_note" },
];
export const slotsOf = (item) => SLOTS.filter((s) => item[s.id]);

// One fetch per photo per session; rows re-render often.
const cache = new Map();
const load = (url) => {
  if (!cache.has(url)) cache.set(url, api.get(url, { responseType: "blob" }).then(({ data }) => URL.createObjectURL(data)).catch((e) => { cache.delete(url); throw e; }));
  return cache.get(url);
};
export const usePhoto = (url) => {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    load(url).then((s) => live && setSrc(s)).catch(() => live && setSrc("x"));
    return () => { live = false; };
  }, [url]);
  return src;
};

export const Img = ({ url, alt, className }) => {
  const src = usePhoto(url);
  if (src === "x") return <span className={`flex items-center justify-center text-[10px] font-bold text-[var(--muted)] ${className}`}>No photo</span>;
  return src ? <img src={src} alt={alt} className={`object-cover ${className}`} /> : <span className={`block animate-pulse bg-[var(--panel)] ${className}`} />;
};

// Before and After side by side, each with its caption; the skipper can add, caption or delete each one.
export const PhotoSlots = ({ item, name, urlFor, canEdit, big, onPick, onNote, onRemove, onFull, id }) => (
  <div className={big ? "flex flex-col gap-3" : "w-[300px]"} data-testid={`item-photo-${big ? "full" : "preview"}-slots-${id}`}>
    <div className="grid grid-cols-2 gap-2">
      {SLOTS.map((s) => {
        const pid = item[s.id];
        if (!pid && !canEdit) return <div key={s.key} />;
        return (
          <div key={s.key} className="flex min-w-0 flex-col gap-1" data-testid={`item-photo-slot-${s.key}-${id}`}>
            <span className="field-label">{s.label}</span>
            {pid ? (
              <div className="relative">
                <Img url={urlFor(pid)} alt={`${s.label} photo of ${name}`} className={`w-full rounded ${big ? "aspect-[4/3] max-h-[60vh] bg-[var(--panel)] !object-contain" : "h-36"}`} />
                {canEdit && <button type="button" onClick={() => onRemove(s)} aria-label={`Delete the ${s.label.toLowerCase()} photo`} data-testid={`item-photo-delete-${s.key}-${id}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--red)] text-white shadow ring-2 ring-white"><X className="h-3.5 w-3.5" strokeWidth={3.5} /></button>}
              </div>
            ) : (
              <button type="button" onClick={() => onPick(s)} data-testid={`item-photo-add-${s.key}-${id}`}
                className={`flex w-full flex-col items-center justify-center gap-1 rounded border-[1.5px] border-dashed border-[var(--line)] text-xs font-bold text-[var(--muted)] hover:border-[var(--navy)] ${big ? "h-40" : "h-36"}`}>
                <Camera className="h-5 w-5" /> Add {s.label.toLowerCase()} photo
              </button>
            )}
            {pid && (item[s.note] || canEdit) && (
              <button type="button" disabled={!canEdit} onClick={() => onNote(s)} data-testid={`item-photo-note-${s.key}-${id}`}
                className="flex min-w-0 items-start gap-1 text-left text-xs font-semibold text-[var(--navy)] disabled:cursor-default">
                {item[s.note] ? <span className="min-w-0 [overflow-wrap:anywhere]">{item[s.note]}</span> : <span className="text-[var(--muted)]">Add a caption</span>}
                {canEdit && <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted)]" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
    {!big && <button type="button" className="btn-ghost h-8 min-h-0 w-full justify-center gap-1.5 text-xs" onClick={onFull} data-testid={`item-photo-open-${id}`}>
      <Expand className="h-3.5 w-3.5" /> Open full view
    </button>}
  </div>
);
