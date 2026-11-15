import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { areaPhotos, areaPhotoUrl } from "@/components/boat/inventory/CupboardPhoto";

const ItemRow = ({ item, locked, onToggle, onEdit }) => (
  <li className={`flex items-center border-t border-[var(--line)] ${item.removed ? "bg-red-100" : ""}`} data-testid={`photo-swipe-item-${item.id}`}>
    <button type="button" role="checkbox" aria-checked={!!item.removed} aria-label={`${item.name}: ${item.removed ? "removed for now" : "in place"}`} onClick={locked ? undefined : onToggle} disabled={locked}
      className="flex min-h-[52px] flex-1 items-center gap-3 py-2 pl-3 pr-2 text-left" data-testid={`photo-swipe-item-toggle-${item.id}`}>
      <span className={`tick-box ${item.removed ? "!border-[var(--red)] !bg-[var(--red)] text-white" : ""}`}>{item.removed && <Check className="h-5 w-5" strokeWidth={3.5} />}</span>
      <span className="item-text flex-1">{item.name}</span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-sm font-bold text-[var(--navy)]">&times;{item.qty}</span>
    </button>
    {!locked && <button type="button" className="icon-btn mr-1" aria-label={`Edit ${item.name}`} onClick={onEdit} data-testid={`photo-swipe-item-edit-${item.id}`}><Pencil className="h-[18px] w-[18px]" /></button>}
  </li>
);

const Items = ({ area, title, locked, onToggle, onEdit }) => (
  <section data-testid={`photo-swipe-items-${area.id}`}>
    {title && <h4 className="px-3 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{title}</h4>}
    <ul>{(area.items || []).map((i) => <ItemRow key={i.id} item={i} locked={locked(area)} onToggle={() => onToggle(area.id, i)} onEdit={() => onEdit(area, i)} />)}</ul>
    {!(area.items || []).length && <p className="border-t border-[var(--line)] px-3 py-3 text-sm text-[var(--muted)]">Nothing listed in here yet.</p>}
  </section>
);

// Full screen: swipe through the cupboard's photos, with its items (and its folders' and boxes') to tick or edit below.
export const PhotoSwipe = ({ open, onClose, boat, area, subs = [], locked = () => true, onToggle, onEdit }) => {
  const photos = areaPhotos(area);
  const strip = useRef(null);
  const [at, setAt] = useState(0);
  const go = (n) => strip.current?.scrollTo({ left: n * strip.current.clientWidth, behavior: "smooth" });
  const nav = "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[var(--navy)] shadow disabled:opacity-30";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-y-auto rounded-none border-0 bg-white p-0 sm:rounded-none" data-testid={`inventory-area-photo-dialog-${area.id}`} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-4 pb-2 pr-12 pt-4 text-left">
          <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-tight">{area.name}</DialogTitle>
          <DialogDescription>{area.comment || (photos.length > 1 ? "Swipe for the next photo" : "Cupboard photo")}</DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0 bg-black">
          <div ref={strip} onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="photo-swipe-strip">
            {photos.map((p, n) => (
              <div key={p.id} className="flex h-[55dvh] w-full shrink-0 snap-center items-center justify-center">
                <img src={areaPhotoUrl(boat, p)} alt={`${area.name} photo ${n + 1}`} className="max-h-full max-w-full object-contain" data-testid={n ? `inventory-area-photo-img-${area.id}-${n}` : `inventory-area-photo-img-${area.id}`} />
              </div>
            ))}
          </div>
          {photos.length > 1 && <>
            <button type="button" className={`${nav} left-2`} disabled={at === 0} onClick={() => go(at - 1)} aria-label="Previous photo" data-testid="photo-swipe-prev-btn"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" className={`${nav} right-2`} disabled={at >= photos.length - 1} onClick={() => go(at + 1)} aria-label="Next photo" data-testid="photo-swipe-next-btn"><ChevronRight className="h-6 w-6" /></button>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-bold text-white" data-testid="photo-swipe-count">{at + 1} / {photos.length}</span>
          </>}
        </div>
        <div className="flex-1 pb-6" data-testid="photo-swipe-items">
          <Items area={area} locked={locked} onToggle={onToggle} onEdit={onEdit} />
          {subs.map((s) => <Items key={s.id} area={s} title={s.name} locked={locked} onToggle={onToggle} onEdit={onEdit} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
};
