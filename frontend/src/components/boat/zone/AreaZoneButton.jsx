import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { slug } from "@/components/boat/zone/ZoneDialog";
import { ZONE_COLOURS } from "@/lib/zoneColours";

const MIX = ["#D4A017", "#7E3FBF", "#F28C28", "#1E63D6"];
const recentKey = (boatId) => `mbp_recent_zones_${boatId}`;
const recent = (boatId) => { try { return JSON.parse(localStorage.getItem(recentKey(boatId))) || []; } catch { return []; } };
const remember = (boatId, label) => localStorage.setItem(recentKey(boatId), JSON.stringify([label, ...recent(boatId).filter((l) => l !== label)].slice(0, 20)));

// Galley always first, then the zones most recently picked on this phone, then the rest in map order.
const ordered = (zones, boatId) => {
  const used = recent(boatId);
  const rank = (z) => (/galley/i.test(z.label) ? -1 : used.includes(z.label) ? used.indexOf(z.label) : 1000);
  return zones.map((z, i) => ({ z, i })).sort((a, b) => rank(a.z) - rank(b.z) || a.i - b.i).map((x) => x.z);
};

// Rounded square of four little squares: multi-coloured but greyed out for an orphan boat area, the zone's colour once it has one.
const ZoneIcon = ({ hex }) => (
  <span className={`grid h-[22px] w-[22px] grid-cols-2 gap-[2px] rounded-[6px] border-[1.5px] p-[2px] ${hex ? "" : "border-current opacity-45 grayscale"}`}
    style={hex ? { borderColor: hex } : undefined}>
    {MIX.map((c, i) => <span key={i} className="rounded-[2px]" style={{ background: hex || c }} />)}
  </span>
);

export const AreaZoneButton = ({ area, zone, zones, boatId, onPick }) => {
  const [open, setOpen] = useState(false);
  const t = `inventory-area-zone-${area.id}`;
  return (
    <>
      <button type="button" className="icon-btn text-[var(--muted)]" onClick={() => setOpen(true)} data-testid={t} data-zone={zone?.colour || ""}
        aria-label={zone ? `In ${zone.map} – ${zone.colour}. Change zone` : "No zone yet. Pick a zone"} title={zone ? `${zone.map} – ${zone.colour}` : "No zone yet (tap to pick one)"}>
        <ZoneIcon hex={zone?.hex} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)] p-4" aria-describedby={undefined} data-testid={`${t}-dialog`}>
          <DialogTitle className="text-base font-extrabold text-[var(--navy)]">Which zone is {area.name} in?</DialogTitle>
          {zones.length ? (
            <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
              {ordered(zones, boatId).map((z) => {
                const on = zone?.colour === z.colour && zone?.map === z.label;
                return (
                  <button key={z.label} type="button" onClick={() => { setOpen(false); if (!on) { remember(boatId, z.label); onPick(z); } }}
                    className={`flex min-h-11 items-center gap-3 rounded-md border-[1.5px] px-3 text-left text-sm font-bold text-[var(--navy)] [transition:background-color_.15s] hover:bg-slate-50 ${on ? "border-[var(--navy)]" : "border-[var(--line)]"}`}
                    data-testid={`${t}-option-${slug(z.label)}`}>
                    <span className="h-5 w-5 shrink-0 rounded-[5px]" style={{ background: ZONE_COLOURS[z.colour] }} />
                    <span className="flex-1">{z.label} – {z.colour}</span>
                    {on && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]" data-testid={`${t}-empty`}>No zones yet. Open the Zone Map and place your colours (e.g. Galley – Orange) on a Zone Map Overview first.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
