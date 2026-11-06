import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { OverviewView } from "@/components/boat/zone/OverviewMap";
import { Checklist, slug } from "@/components/boat/zone/ZoneDialog";
import { LIGHT, ZONE_COLOURS, zonePhotos } from "@/lib/zoneColours";

// Sticky colour + zone banner while batch scanning; the zone's plan and photos stay folded away until tapped.
export const ZoneBanner = ({ zone, boat }) => {
  const [open, setOpen] = useState(false);
  const photos = zonePhotos(boat, zone);
  const l = zone.label.toLowerCase();
  const plans = (boat?.zone_maps || []).filter((m) => m.kind === "overview" && (m.swatches || []).some((s) => (s.label || s.colour).toLowerCase() === l));
  const t = `zone-banner-${slug(zone.label)}`;
  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-md shadow-md" style={{ background: ZONE_COLOURS[zone.colour], color: LIGHT.has(zone.colour) ? "#0f172a" : "#fff" }} data-testid={t}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left" data-testid={`${t}-toggle`}>
        <span className="flex flex-col leading-tight">
          <span className="text-base font-extrabold uppercase tracking-wide" data-testid={`${t}-label`}>{zone.label}</span>
          <span className="text-xs font-bold opacity-90">{zone.colour} zone · {open ? "Hide" : "Show"} plan and {photos.length} {photos.length === 1 ? "photo" : "photos"}</span>
        </span>
        <ChevronDown className={`ml-auto h-5 w-5 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-b-md bg-white p-2 text-[var(--navy)]" data-testid={`${t}-body`}>
          <div className="flex gap-2 overflow-x-auto">
            {plans.map((m) => (
              <div key={m.id} className="w-56 shrink-0 [&_img]:max-h-40"><OverviewView src={boatMapUrl(boat, m)} swatches={m.swatches.filter((s) => (s.label || s.colour).toLowerCase() === l)} /></div>
            ))}
            {photos.map((m) => <img key={m.id} src={boatMapUrl(boat, m)} alt={m.name || zone.label} className="h-40 shrink-0 rounded-md object-cover" data-testid={`${t}-photo-${m.id}`} />)}
          </div>
          <Checklist zone={zone} open={false} testId={`${t}-checklist`} />
        </div>
      )}
    </div>
  );
};
