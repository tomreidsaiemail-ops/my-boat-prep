import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Img } from "@/components/boat/PhotoSlots";

// Weather and routing photos saved with a Departure decision in the Ship's Log.
export const LogPhotos = ({ id, photos, urlFor }) => {
  const [full, setFull] = useState(null);
  return (
    <div className="flex basis-full flex-wrap gap-2 pb-2 pl-12 pr-3" data-testid={`log-photos-${id}`}>
      {photos.map((p, n) => (
        <button key={p.photo_id} type="button" onClick={() => setFull(p)} className="h-14 w-14 overflow-hidden rounded border border-[var(--line)]" aria-label={`Open weather and routing photo ${n + 1}`} data-testid={`log-photo-${id}-${n}`}>
          <Img url={urlFor(p.photo_id)} alt="" className="h-full w-full" />
        </button>
      ))}
      <Dialog open={!!full} onOpenChange={(o) => !o && setFull(null)}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto p-3" data-testid={`log-photo-full-${id}`}>
          <DialogTitle className="pr-8 text-sm">Weather and routing photo</DialogTitle>
          {full && <Img url={urlFor(full.photo_id)} alt="Weather and routing photo" className="!object-contain max-h-[78vh] w-full" />}
          {full?.note && <p className="whitespace-pre-line text-sm">{full.note}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
};
