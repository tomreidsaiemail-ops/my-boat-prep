import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ZONE_COLOURS } from "@/lib/zoneColours";

// The opened zone's cupboards, folded like its row in the zone list, so the skipper can work on them here.
export const ZoneCupboards = ({ zone, rows, render, t }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border-[1.5px] border-[var(--line)] bg-white" data-testid={`${t}-cupboards`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-10 w-full items-center gap-2 px-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`${t}-cupboards-toggle`}>
        <ChevronDown className={`h-4 w-4 shrink-0 [transition:transform_.15s] ${open ? "" : "-rotate-90"}`} />
        <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-black/20" style={{ backgroundColor: ZONE_COLOURS[zone.colour] }} />
        <span className="min-w-0" data-testid={`${t}-cupboards-label`}>{zone.label} - {rows.length}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-2 px-2 pb-2" data-testid={`${t}-cupboards-list`}>
          {rows.length ? rows.map((r) => render(r)) : <li className="px-1 text-sm text-[var(--muted)]" data-testid={`${t}-cupboards-empty`}>No cupboards in {zone.label} yet. Add them below.</li>}
        </ul>
      )}
    </div>
  );
};
