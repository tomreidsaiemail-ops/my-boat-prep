import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api, apiError } from "@/lib/api";
import { PALETTE, ZONE_COLOURS, mapLabel } from "@/lib/zoneColours";

// Small rounded square showing the map's colour; colours already used by another map can't be picked.
export const MapColourPicker = ({ boat, map, maps, online, onMaps }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const usedBy = Object.fromEntries(maps.map((m, n) => [m.colour, m.id === map.id ? null : mapLabel(m, n)]));
  const pick = async (colour) => {
    if (colour === map.colour) { setOpen(false); return; }
    if (!online) { toast.error("You need a signal to change a zone map colour"); return; }
    setBusy(true);
    try { onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/meta`, { colour })).data.zone_maps); setOpen(false); toast.success(`Zone map colour set to ${colour}`); }
    catch (e) { toast.error(apiError(e, "Couldn't change the colour")); } finally { setBusy(false); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="btn-ghost h-9 w-9 justify-center p-0" aria-label={`Zone map colour: ${map.colour}. Change colour`} title={`${map.colour} (tap to change)`} data-testid={`boat-zone-map-colour-${map.id}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-5 w-5 rounded-[5px] border border-black/20" style={{ backgroundColor: ZONE_COLOURS[map.colour] }} />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 border-2 border-[var(--navy)] p-3" align="end" data-testid={`boat-zone-map-colour-menu-${map.id}`}>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Zone map colour</p>
        <div className="grid grid-cols-5 gap-2">
          {PALETTE.map((c) => {
            const taken = usedBy[c];
            return (
              <button key={c} type="button" disabled={!!taken || busy} onClick={() => pick(c)} title={taken ? `${c} is used by ${taken}` : c} aria-label={taken ? `${c}, used by ${taken}` : c}
                className={`relative flex h-9 w-9 items-center justify-center rounded-md border-2 ${c === map.colour ? "border-[var(--navy)]" : "border-transparent"} disabled:cursor-not-allowed`}
                data-testid={`zone-colour-${c.toLowerCase()}`}>
                <span className={`h-7 w-7 rounded-[5px] border border-black/20 ${taken ? "opacity-30" : ""}`} style={{ backgroundColor: ZONE_COLOURS[c] }} />
                {c === map.colour && <Check className="absolute h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Faded colours are already used by another zone map. Boat areas pinned on this map take its colour.</p>
      </PopoverContent>
    </Popover>
  );
};
