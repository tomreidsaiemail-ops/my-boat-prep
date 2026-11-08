import { useRef } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, Check, Loader2, RotateCcw, X } from "lucide-react";
import { shrink } from "@/components/boat/PhotoPicker";
import { SHOP_MAX } from "@/lib/stores";

const Thumb = ({ e, onRemove, onRetry }) => (
  <li className="relative h-20 w-20 overflow-hidden rounded-md border-2 border-[var(--line)]" data-testid={`shop-photo-${e.key}`}>
    <img src={e.preview} alt="Shopping" className="h-full w-full object-cover" />
    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-0.5 text-[10px] font-bold text-white" data-testid={`shop-photo-status-${e.key}`}>
      {e.status === "done" ? <><Check className="h-3 w-3" /> {e.found} found</>
        : e.status === "error" ? <button type="button" onClick={onRetry} className="flex items-center gap-1" data-testid={`shop-photo-retry-${e.key}`}><RotateCcw className="h-3 w-3" /> Retry</button>
          : e.status === "scanning" ? <><Loader2 className="h-3 w-3 animate-spin" /> Scanning</> : "Waiting"}
    </span>
    {e.status === "error" && <AlertTriangle className="absolute left-1 top-1 h-4 w-4 text-amber-400" />}
    <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" data-testid={`shop-photo-remove-${e.key}`}><X className="h-3.5 w-3.5" /></button>
  </li>
);

// One Shopping Set: photos of the shopping that belongs in this cupboard. Scanning carries on in the background.
export const ShopSetStep = ({ set, n, count, batch }) => {
  const input = useRef(null);
  const mine = batch.entries.filter((e) => e.name === set.id);
  const room = SHOP_MAX - batch.entries.length;
  const pick = async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    if (files.length > room) toast.info(`Only ${room} more ${room === 1 ? "photo" : "photos"} fit in this batch (${SHOP_MAX} max)`);
    for (const f of files.slice(0, room)) {
      try { batch.add(set.id, await shrink(f, 1600)); } catch { toast.error("That file doesn't look like a photo"); }
    }
  };
  return (
    <div className="flex flex-col gap-3" data-testid={`shop-set-step-${n}`}>
      <p className="font-display text-lg font-extrabold" data-testid="shop-set-title">Shopping Set {n + 1} of {count}: {set.name}</p>
      <p className="text-sm">Group the shopping that goes in the <b>{set.name}</b>, lay it out and take a photo (or a few). The MPA scans while you carry on to the next set.</p>
      {mine.length > 0 && <ul className="flex flex-wrap gap-2">{mine.map((e) => <Thumb key={e.key} e={e} onRemove={() => batch.remove(e.key)} onRetry={() => batch.retry(e.key)} />)}</ul>}
      <button type="button" disabled={room < 1} onClick={() => input.current?.click()} data-testid="shop-set-photo-btn"
        className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-[var(--panel)] text-sm font-bold text-[var(--navy)] disabled:opacity-50">
        <Camera className="h-7 w-7" /> {mine.length ? "Add another photo" : "Take or choose a photo"}
        <span className="text-xs font-medium text-[var(--muted)]">{batch.entries.length} of {SHOP_MAX} photos used</span>
      </button>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={pick} data-testid="shop-set-photo-input" />
    </div>
  );
};
