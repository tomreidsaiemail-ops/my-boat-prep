import { MapPin } from "lucide-react";

export const pinName = (pin, areas) => areas.find((a) => a.id === pin.area_id)?.name || pin.label;

// A zone photo with its pinned labels; tapping a linked pin opens that boat area.
export const PinnedPhoto = ({ src, alt, pins = [], areas = [], onPin, onImage, imgRef, imgClass = "max-h-64 w-full rounded-md object-contain", testId, onError }) => (
  <div className="relative mx-auto w-fit max-w-full" data-testid={testId}>
    <img ref={imgRef} src={src} alt={alt} onClick={onImage} onError={onError} className={`${imgClass} ${onImage ? "cursor-pointer" : ""}`} draggable={false} data-testid={`${testId}-img`} />
    {pins.map((p) => (
      <button key={p.id} type="button" onClick={(e) => { e.stopPropagation(); onPin?.(p); }}
        className="absolute flex max-w-[45%] -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border-2 border-white bg-[var(--navy)] py-0.5 pl-1 pr-2 text-[11px] font-bold leading-tight text-white shadow-md [transition:transform_.15s] hover:scale-105"
        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} aria-label={`${pinName(p, areas)}${p.area_id ? ", open in Boat Inventory" : ""}`} data-testid={`zone-pin-${p.id}`}>
        <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{pinName(p, areas)}</span>
      </button>
    ))}
  </div>
);
