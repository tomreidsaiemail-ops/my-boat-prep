import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ZONE_COLOURS } from "@/lib/zoneColours";
import { CalloutPlan, ink } from "@/components/boat/zone/Callouts";
import { boatMapUrl } from "@/components/boat/ZoneMap";

const clamp = (v) => Math.min(1, Math.max(0, v));
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const slug = (l) => l.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const Chip = ({ c, on, placed, onTap }) => (
  <button type="button" onClick={onTap} aria-pressed={on} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-extrabold ring-2 ring-offset-1 [transition:box-shadow_.15s] ${on ? "ring-[var(--navy)]" : "ring-transparent"}`}
    style={{ background: ZONE_COLOURS[c.colour], color: ink(c.colour) }} data-testid={`setup-tap-colour-${slug(c.label)}`}>
    {placed && <CheckCircle2 className="h-3.5 w-3.5" data-testid={`setup-tap-colour-${slug(c.label)}-placed`} />}{c.label}
  </button>
);

// Set Up Wizard: just this step's colours above the schematic. One colour is ready to tap; with several, tap a colour first. Tapping again moves it.
export const ZoneTapPanel = ({ boat, map, online, colours, text, big, onMaps }) => {
  const [swatches, setSwatches] = useState(map.swatches || []);
  const [armed, setArmed] = useState(colours.length === 1 ? colours[0].label : null);
  const box = useRef(null);
  useEffect(() => setSwatches(map.swatches || []), [map.swatches]);
  const save = async (next) => {
    if (!online) { toast.error("You need a signal to save the colours"); return; }
    setSwatches(next);
    try { onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/swatches`, { swatches: next })).data.zone_maps); }
    catch (e) { toast.error(apiError(e, "Couldn't save the colours")); setSwatches(map.swatches || []); }
  };
  const tap = (e) => {
    const p = colours.find((c) => c.label === armed);
    const r = box.current?.getBoundingClientRect();
    if (!p) { if (colours.length) toast("Tap a colour first, then tap the drawing"); return; }
    if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const pos = { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
    const old = swatches.find((s) => s.label === p.label);
    save(old ? swatches.map((s) => (s.id === old.id ? { ...s, ...pos } : s)) : [...swatches, { id: newId(), ...pos, colour: p.colour, label: p.label }]);
    if (colours.length > 1) setArmed(null);
  };
  return (
    <div className="flex flex-col gap-3" data-testid="setup-tap-panel">
      <p className="text-sm font-semibold" data-testid="setup-tap-text">{armed && colours.length > 1 ? `Now tap the drawing where the ${armed} is.` : text}</p>
      <div className="flex flex-wrap gap-2 p-0.5" data-testid="setup-tap-colours">
        {colours.map((c) => (
          <Chip key={c.label} c={c} on={armed === c.label} placed={swatches.some((s) => s.label === c.label)} onTap={() => setArmed(armed === c.label && colours.length > 1 ? null : c.label)} />
        ))}
        {!colours.length && <span className="text-xs text-[var(--muted)]" data-testid="setup-tap-no-colours">No colours for this in Admin - Zone Map Predetermined Colours yet.</span>}
      </div>
      <div className={`rounded-md border border-[var(--line)] bg-white ${big ? "overflow-x-auto" : "p-1"}`} data-testid="setup-tap-plan-wrap">
        <CalloutPlan src={boatMapUrl(boat, map)} alt="Your schematic" swatches={swatches} boxRef={box} onClick={tap} testId="setup-tap-plan"
          imgClass={big ? "block rounded-md max-sm:w-[680px] max-sm:max-w-none sm:max-h-72 sm:max-w-full" : "block max-h-72 max-w-full rounded-md"}
          className={`${armed ? "cursor-crosshair" : ""} ${big ? "max-sm:!max-w-none" : ""}`} />
      </div>
      {big && <p className="-mt-2 text-xs text-[var(--muted)] sm:hidden" data-testid="setup-tap-scroll-hint">Scroll the drawing sideways to reach the bow and stern.</p>}
    </div>
  );
};
