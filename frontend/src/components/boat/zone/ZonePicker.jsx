import { Layers } from "lucide-react";
import { slug } from "@/components/boat/zone/ZoneDialog";
import { ZoneIcon } from "@/components/boat/zone/AreaZoneButton";
import { LIGHT, ZONE_COLOURS } from "@/lib/zoneColours";

// Cupboards are added zone by zone; a box without a zone gets its zone later from the 4-colour square icon.
export const ZonePicker = ({ zones, counts, onPick, children }) => (
  <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="zone-picker">
    <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]"><Layers className="h-4 w-4" /> Add cupboards by zone</p>
    <p className="text-xs text-[var(--muted)]">Pick a zone, take its photos, then scan its cupboards. Start with the Galley.</p>
    <div className="flex flex-wrap gap-2">
      {zones.map((z) => (
        <button key={z.label} type="button" onClick={() => onPick(z)} className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-extrabold shadow-sm [transition:transform_.1s] active:scale-95"
          style={{ background: ZONE_COLOURS[z.colour], color: LIGHT.has(z.colour) ? "#0f172a" : "#fff" }} data-testid={`zone-picker-${slug(z.label)}`}>
          {z.label}{counts[z.colour] ? <span className="rounded bg-black/15 px-1.5 text-xs">{counts[z.colour]}</span> : null}
        </button>
      ))}
    </div>
    <div className="flex flex-col gap-1" data-testid="zone-picker-more">
      <p className="flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]" data-testid="zone-picker-no-zone-label">
        Add a box without a zone (zone assign later with <span className="inline-flex text-[var(--navy)]" aria-label="the 4 colour square icon"><ZoneIcon /></span>)
      </p>
      {children}
    </div>
  </div>
);
