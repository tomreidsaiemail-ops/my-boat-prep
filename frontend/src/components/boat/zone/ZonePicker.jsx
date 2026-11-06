import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { slug } from "@/components/boat/zone/ZoneDialog";
import { LIGHT, ZONE_COLOURS } from "@/lib/zoneColours";

// Boat areas are added zone by zone; a boat area without a zone is the last resort under More options.
export const ZonePicker = ({ zones, counts, onPick, children }) => {
  const [more, setMore] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="zone-picker">
      <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]"><Layers className="h-4 w-4" /> Add boat areas by zone</p>
      <p className="text-xs text-[var(--muted)]">Pick a zone, take its photos, then scan its cupboards. Start with the Galley.</p>
      <div className="flex flex-wrap gap-2">
        {zones.map((z) => (
          <button key={z.label} type="button" onClick={() => onPick(z)} className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-extrabold shadow-sm [transition:transform_.1s] active:scale-95"
            style={{ background: ZONE_COLOURS[z.colour], color: LIGHT.has(z.colour) ? "#0f172a" : "#fff" }} data-testid={`zone-picker-${slug(z.label)}`}>
            {z.label}{counts[z.colour] ? <span className="rounded bg-black/15 px-1.5 text-xs">{counts[z.colour]}</span> : null}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 self-start text-xs font-bold text-[var(--muted)] underline-offset-2 hover:underline" data-testid="zone-picker-more-btn">
        More options <ChevronDown className={`h-3.5 w-3.5 [transition:transform_.15s] ${more ? "rotate-180" : ""}`} />
      </button>
      {more && <div className="flex flex-col gap-1" data-testid="zone-picker-more"><p className="text-xs text-[var(--muted)]">Add a boat area without a zone (last resort):</p>{children}</div>}
    </div>
  );
};
