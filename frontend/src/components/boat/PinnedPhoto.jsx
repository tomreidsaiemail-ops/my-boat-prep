import { MapPin } from "lucide-react";

export const pinName = (pin, areas) => areas.find((a) => a.id === pin.area_id)?.name || pin.label;

const clamp = (v) => Math.min(1, Math.max(0, v));

// Press-and-drag a pin; a tiny wobble still counts as a tap so labels stay easy to open.
const dragPin = (e, p, onDrag) => {
  const el = e.currentTarget;
  const box = el.parentElement.getBoundingClientRect();
  const offX = p.x * box.width - (e.clientX - box.left);
  const offY = p.y * box.height - (e.clientY - box.top);
  const sx = e.clientX;
  const sy = e.clientY;
  let moved = false;
  el.setPointerCapture?.(e.pointerId);
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    moved = true;
    onDrag(p, clamp((ev.clientX - box.left + offX) / box.width), clamp((ev.clientY - box.top + offY) / box.height));
  };
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    if (moved) el.dataset.dragged = "1";
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
};

// A zone photo with its pinned labels; tapping a linked pin opens that boat area. `highlight` makes one pin stand out. `onDrag` lets labels be moved.
export const PinnedPhoto = ({ src, alt, pins = [], areas = [], onPin, onImage, onDrag, imgRef, imgClass = "max-h-64 w-full rounded-md object-contain", testId, onError, highlight }) => (
  <div className="relative mx-auto w-fit max-w-full" data-testid={testId}>
    <img ref={imgRef} src={src} alt={alt} onClick={onImage} onError={onError} className={`${imgClass} ${onImage ? "cursor-pointer" : ""}`} draggable={false} data-testid={`${testId}-img`} />
    {pins.map((p) => {
      const hot = highlight === p.id;
      return (
        <button key={p.id} type="button"
          onPointerDown={onDrag ? (e) => dragPin(e, p, onDrag) : undefined}
          onClick={(e) => { e.stopPropagation(); if (e.currentTarget.dataset.dragged) { delete e.currentTarget.dataset.dragged; return; } onPin?.(p); }}
          className={`absolute flex max-w-[45%] -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border-2 py-0.5 pl-1 pr-2 text-[11px] font-bold leading-tight shadow-md [transition:transform_.15s] hover:scale-105 ${
            onDrag ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""} ${
            hot ? "z-10 scale-125 animate-pulse border-[var(--navy)] bg-amber-400 text-[var(--navy)]" : highlight ? "border-white bg-[var(--navy)]/60 text-white" : "border-white bg-[var(--navy)] text-white"}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} aria-label={`${pinName(p, areas)}${p.area_id ? ", open in Boat Inventory" : ""}`}
          data-testid={`zone-pin-${p.id}`} data-highlight={hot ? "true" : undefined}>
          <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{pinName(p, areas)}</span>
        </button>
      );
    })}
  </div>
);
