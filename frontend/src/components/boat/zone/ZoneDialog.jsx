import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronDown, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { LIGHT, ZONE_COLOURS, zonePhotos } from "@/lib/zoneColours";
import { zoneChecklist } from "@/lib/zoneChecklist";
import { SkipperComment } from "@/components/boat/zone/SkipperComment";
import { QuickCupboards } from "@/components/boat/zone/QuickCupboards";

export const slug = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const ZoneChip = ({ zone, className = "", testId }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-extrabold ${className}`} data-testid={testId}
    style={{ background: ZONE_COLOURS[zone.colour], color: LIGHT.has(zone.colour) ? "#0f172a" : "#fff" }}>{zone.label}</span>
);

export const Checklist = ({ zone, open: start, testId }) => {
  const [open, setOpen] = useState(start);
  return (
    <div className="rounded-md border-[1.5px] border-[var(--line)] bg-[var(--panel)] text-sm" data-testid={testId}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-[var(--navy)]" data-testid={`${testId}-toggle`}>
        Make sure you capture <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <ul className="flex flex-col gap-1 px-3 pb-3">{zoneChecklist(zone.label).map((t, n) => (
        <li key={t} className="relative pl-5 text-[var(--muted)] before:absolute before:left-1 before:content-['•']" data-testid={`${testId}-item-${n}`}>{t}</li>
      ))}</ul>}
    </div>
  );
};

const AddPhotos = ({ zone, busy, onFiles, t }) => {
  const cam = useRef(null), lib = useRef(null);
  const pick = (e) => { const files = [...(e.target.files || [])]; e.target.value = ""; if (files.length) onFiles(files); };
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className="btn-solid min-h-11 justify-center gap-2 text-sm" disabled={!!busy} onClick={() => cam.current?.click()} data-testid={`${t}-camera-btn`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {busy || "Take photos"}
      </button>
      <button type="button" className="btn-ghost min-h-11 justify-center gap-2 text-sm" disabled={!!busy} onClick={() => lib.current?.click()} data-testid={`${t}-gallery-btn`}>
        <ImagePlus className="h-4 w-4" /> Choose from gallery
      </button>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} aria-label={`Take photos of ${zone.label}`} data-testid={`${t}-camera-input`} />
      <input ref={lib} type="file" accept="image/*" multiple className="hidden" onChange={pick} aria-label={`Choose photos of ${zone.label}`} data-testid={`${t}-gallery-input`} />
    </div>
  );
};

// One zone (e.g. Galley, orange): its Zone Map Photos, what to capture, then batch scan its cupboards.
export const ZoneDialog = ({ zone, boat, online, areaCount = 0, onMaps, onScan, onClose, onQuickAdd, onQuickDone }) => {
  const [busy, setBusy] = useState("");
  const [big, setBig] = useState(null);
  if (!zone) return null;
  const photos = zonePhotos(boat, zone);
  const t = `zone-dialog-${slug(zone.label)}`;
  const upload = async (files) => {
    if (!online) { toast.error("You need a signal to save zone photos"); return; }
    let saved = 0;
    for (const [n, file] of files.entries()) {
      setBusy(`Saving ${n + 1} of ${files.length}...`);
      try {
        const form = new FormData();
        form.append("file", await shrink(file, 1600), "zone-photo.jpg");
        form.append("zone", zone.label); form.append("colour", zone.colour);
        onMaps((await api.post(`/boats/${boat.boat_id}/zone-maps`, form, { timeout: 60000 })).data.zone_maps);
        saved += 1;
      } catch (e) { toast.error(apiError(e, "Couldn't save that photo")); break; }
    }
    setBusy("");
    if (saved) toast.success(`${saved} ${saved === 1 ? "photo" : "photos"} added to ${zone.label} (${zone.colour})`);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid={t}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight"><ZoneChip zone={zone} className="text-sm" testId={`${t}-chip`} /> zone</DialogTitle>
          <DialogDescription>{zone.colour} zone. Photos of {zone.label} take {zone.colour}, and every cupboard you scan here is filed under {zone.label}.</DialogDescription>
        </DialogHeader>
        {big ? (
          <div className="flex flex-col gap-2" data-testid={`${t}-big`}>
            <div className="relative">
              <img src={boatMapUrl(boat, big)} alt={big.name || zone.label} className="max-h-[60vh] w-full rounded-md object-contain" />
              <button type="button" className="icon-btn absolute right-1 top-1 bg-white" aria-label="Back to the zone photos" onClick={() => setBig(null)} data-testid={`${t}-big-close`}><X className="h-5 w-5" /></button>
            </div>
            <SkipperComment text={big.comment} testId={`${t}-big-comment`} />
          </div>
        ) : photos.length ? (
          <div className="grid grid-cols-3 gap-2" data-testid={`${t}-photos`}>
            {photos.map((m) => (
              <button key={m.id} type="button" onClick={() => setBig(m)} className="overflow-hidden rounded-md border-2" style={{ borderColor: ZONE_COLOURS[zone.colour] }} data-testid={`${t}-photo-${m.id}`}>
                <img src={boatMapUrl(boat, m)} alt={m.name || zone.label} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed p-4 text-center" style={{ borderColor: ZONE_COLOURS[zone.colour] }} data-testid={`${t}-empty`}>
            <p className="font-bold text-[var(--navy)]">No {zone.label} photos yet</p>
            <p className="text-sm text-[var(--muted)]">Take photos of the whole {zone.label} so crew can see where every cupboard is.</p>
          </div>
        )}
        <Checklist zone={zone} open={!photos.length} testId={`${t}-checklist`} />
        <AddPhotos zone={zone} busy={busy} onFiles={upload} t={t} />
        {photos.length > 0 && (
          <button type="button" className="btn-solid min-h-12 justify-center gap-2" disabled={!!busy} onClick={() => onScan(zone)} data-testid={`${t}-scan-btn`}>
            <ScanLine className="h-5 w-5" /> Scan {zone.label} cupboards
          </button>
        )}
        {onQuickAdd && <QuickCupboards zone={zone} onAdd={onQuickAdd} onDone={onQuickDone} t={t} />}
        {areaCount > 0 && <p className="text-center text-xs text-[var(--muted)]" data-testid={`${t}-area-count`}>{areaCount} {areaCount === 1 ? "cupboard" : "cupboards"} already in {zone.label}</p>}
      </DialogContent>
    </Dialog>
  );
};
