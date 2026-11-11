import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { ZONE_COLOURS, zonePhotos } from "@/lib/zoneColours";
import { SkipperComment } from "@/components/boat/zone/SkipperComment";

// Boat Inventory zone heading: an image icon when the zone has Zone Map Photos; tap to see them.
export const ZonePhotosButton = ({ boat, zone, testId }) => {
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(null);
  const photos = zonePhotos(boat, zone);
  if (!photos.length) return null;
  const close = (o) => { setOpen(o); if (!o) setBig(null); };
  return (
    <>
      <button type="button" className="icon-btn h-8 w-8 shrink-0 text-[var(--navy)]" onClick={() => setOpen(true)} aria-label={`See the ${zone.label} photos`} title={`${photos.length} ${zone.label} ${photos.length === 1 ? "photo" : "photos"}`} data-testid={testId}>
        <ImageIcon className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid={`${testId}-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">{zone.label} photos</DialogTitle>
            <DialogDescription>{photos.length} Zone Map {photos.length === 1 ? "Photo" : "Photos"} of the {zone.label} ({zone.colour}).</DialogDescription>
          </DialogHeader>
          {big ? (
            <div className="flex flex-col gap-2" data-testid={`${testId}-big`}>
              <div className="relative">
                <img src={boatMapUrl(boat, big)} alt={big.name || zone.label} className="max-h-[65vh] w-full rounded-md object-contain" />
                <button type="button" className="icon-btn absolute right-1 top-1 bg-white" aria-label="Back to the zone photos" onClick={() => setBig(null)} data-testid={`${testId}-big-close`}><X className="h-5 w-5" /></button>
              </div>
              <SkipperComment text={big.comment} testId={`${testId}-big-comment`} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid={`${testId}-grid`}>
              {photos.map((m) => (
                <button key={m.id} type="button" onClick={() => setBig(m)} className="overflow-hidden rounded-md border-2" style={{ borderColor: ZONE_COLOURS[zone.colour] }} data-testid={`${testId}-photo-${m.id}`}>
                  <img src={boatMapUrl(boat, m)} alt={m.name || zone.label} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
