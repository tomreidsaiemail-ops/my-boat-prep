import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { LIGHT, ZONE_COLOURS } from "@/lib/zoneColours";

const clamp = (v) => Math.min(1, Math.max(0, v));
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ink = (c) => (LIGHT.has(c) ? "#0f172a" : "#fff");

const Square = ({ s, style, selected, onPointerDown, onRemove, testId }) => (
  <span className="absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-none select-none" style={style} onClick={(e) => e.stopPropagation()} data-testid={testId}>
    <span onPointerDown={onPointerDown} className={`flex cursor-grab items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[10px] font-extrabold shadow-md ring-2 ${selected ? "ring-[var(--navy)]" : "ring-white"}`}
      style={{ background: ZONE_COLOURS[s.colour], color: ink(s.colour) }}>{s.label || s.colour}</span>
    {selected && onRemove && (
      <button type="button" onClick={onRemove} aria-label={`Remove ${s.label || s.colour}`} className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--red)] shadow" data-testid={`${testId}-remove`}>
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </span>
);

// Read-only full-size plan with its colour squares.
export const OverviewView = ({ src, swatches = [] }) => (
  <div className="relative mx-auto w-fit max-w-full" data-testid="zone-overview-full">
    <img src={src} alt="Zone Map Overview" className="block max-h-[80vh] max-w-full" draggable={false} />
    {swatches.map((s) => <Square key={s.id} s={s} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} testId={`zone-overview-full-swatch-${s.id}`} />)}
  </div>
);

// A Zone Map Overview: an AI layout plan the skipper drops the admin's predetermined colour squares onto (e.g. Cockpit - Gold where the cockpit is).
export const OverviewMap = ({ boat, map, src, canEdit, online, presets = [], onMaps, onRemove, removing, onImage, onColour }) => {
  const [swatches, setSwatches] = useState(map.swatches || []);
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(null);
  const [ghost, setGhost] = useState(null);
  const box = useRef(null);
  useEffect(() => setSwatches(map.swatches || []), [map.swatches]);
  const t = `zone-overview-${map.id}`;
  const save = async (next) => {
    setSwatches(next);
    if (!online) { toast.error("You need a signal to save the colours"); return; }
    try { onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/swatches`, { swatches: next })).data.zone_maps); }
    catch (e) { toast.error(apiError(e, "Couldn't save the colours")); setSwatches(map.swatches || []); }
  };
  const at = (x, y) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return { x: clamp((x - r.left) / r.width), y: clamp((y - r.top) / r.height) };
  };
  const place = (p, pos) => {
    if (swatches.some((s) => s.label === p.label)) { toast.error(`${p.label} is already on this plan`); setArmed(null); return; }
    save([...swatches, { id: newId(), x: pos.x, y: pos.y, colour: p.colour, label: p.label }]); setArmed(null);
  };
  const used = new Set(swatches.map((s) => s.label));
  const [placing, setPlacing] = useState(false);
  const autoPlace = async () => {
    if (!online) { toast.error("You need a signal for the Magic Mariner"); return; }
    setPlacing(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/zone-maps/${map.id}/auto-swatches`, {}, { timeout: 90000 });
      onMaps(data.zone_maps);
      toast.success(`Magic Mariner placed ${data.placed} ${data.placed === 1 ? "colour" : "colours"}. Drag any that need nudging.`);
    } catch (e) { toast.error(apiError(e, "The Magic Mariner couldn't place the colours")); }
    finally { setPlacing(false); }
  };
  // Drag a palette square onto the plan; a tap arms it so the next tap on the plan drops it there.
  const dragNew = (e, p) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; moved = true; setGhost({ p, x: ev.clientX, y: ev.clientY }); };
    const up = (ev) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setGhost(null);
      if (!moved) { setArmed((a) => (a?.label === p.label ? null : p)); return; }
      const pos = at(ev.clientX, ev.clientY);
      if (pos) place(p, pos);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  // Tap a square to open its Zone Map Photo; press and hold to show its remove button; drag to move.
  const dragOld = (e, s) => {
    e.preventDefault(); e.stopPropagation();
    if (!canEdit) { onColour?.(s); return; }
    const sx = e.clientX, sy = e.clientY;
    let moved = false, held = false, last = s;
    const timer = setTimeout(() => { if (!moved) { held = true; setSelected(s.id); } }, 550);
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true; clearTimeout(timer);
      const pos = at(ev.clientX, ev.clientY);
      if (pos) { last = { ...s, ...pos }; setSwatches((all) => all.map((x) => (x.id === s.id ? last : x))); }
    };
    const up = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (moved) save(swatches.map((x) => (x.id === s.id ? last : x)));
      else if (!held) { setSelected(null); onColour?.(s); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const tapPlan = (e) => {
    if (armed) { const pos = at(e.clientX, e.clientY); if (pos) place(armed, pos); return; }
    if (selected) { setSelected(null); return; }
    onImage?.();
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-[1.5px] border-[var(--line)] p-2" data-testid={t}>
      <p className="text-sm font-bold text-[var(--navy)]" data-testid={`${t}-title`}>{map.name || "Zone Map Overview"}</p>
      <div ref={box} className={`relative mx-auto w-fit max-w-full ${armed ? "cursor-crosshair" : ""}`} onClick={tapPlan} data-testid={`${t}-plan`}>
        <img src={src} alt={`${map.name || "Zone Map"} overview`} className="block max-h-72 max-w-full rounded-md" draggable={false} />
        {swatches.map((s) => (
          <Square key={s.id} s={s} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} selected={selected === s.id} testId={`${t}-swatch-${s.id}`}
            onPointerDown={(e) => dragOld(e, s)} onRemove={canEdit ? (e) => { e.stopPropagation(); setSelected(null); save(swatches.filter((x) => x.id !== s.id)); } : null} />
        ))}
      </div>
      {canEdit && (
        <>
          <button type="button" className="btn-solid min-h-10 justify-center gap-2 text-sm" disabled={placing || !presets.length} onClick={autoPlace} data-testid={`${t}-auto-btn`}>
            {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {placing ? "Magic Mariner is finding zones to colour..." : "Magically Place Colours"}
          </button>
          <p className="text-xs text-[var(--muted)]" data-testid={`${t}-hint`}>{armed ? `Tap the plan where the ${armed.label} is.` : "Drag a colour onto the plan (or tap a colour, then tap the plan). Tap a placed colour to open its Zone Map Photo; press and hold it to remove it."}</p>
          <div className="flex flex-wrap gap-1.5" data-testid={`${t}-palette`}>
            {presets.map((p) => used.has(p.label) ? (
              <span key={p.label} title="Already on this plan" aria-disabled="true" className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-extrabold line-through opacity-35"
                style={{ background: ZONE_COLOURS[p.colour], color: ink(p.colour) }} data-testid={`${t}-palette-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-used`}>
                {p.label}
              </span>
            ) : (
              <span key={p.label} role="button" tabIndex={0} onPointerDown={(e) => dragNew(e, p)} aria-pressed={armed?.label === p.label}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setArmed((a) => (a?.label === p.label ? null : p)); } }}
                className={`flex cursor-grab touch-none select-none items-center gap-1 rounded-md px-2 py-1 text-[11px] font-extrabold ring-2 ${armed?.label === p.label ? "ring-[var(--navy)]" : "ring-transparent"}`}
                style={{ background: ZONE_COLOURS[p.colour], color: ink(p.colour) }} data-testid={`${t}-palette-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                {p.label}
              </span>
            ))}
            {!presets.length && <span className="text-xs text-[var(--muted)]">No colours set up in Admin - Zone Map Predetermined Colours yet.</span>}
          </div>
          <button type="button" className="btn-ghost h-9 self-end px-3 text-xs hover:text-[var(--red)]" disabled={removing} onClick={onRemove} data-testid={`${t}-remove-btn`}>
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove this overview
          </button>
        </>
      )}
      {ghost && (
        <span className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-extrabold shadow-lg"
          style={{ left: ghost.x, top: ghost.y, background: ZONE_COLOURS[ghost.p.colour], color: ink(ghost.p.colour) }}>{ghost.p.label}</span>
      )}
    </div>
  );
};
