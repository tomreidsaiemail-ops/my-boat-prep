import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ChevronDown, Loader2, Palette, Sparkles, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { ZONE_COLOURS } from "@/lib/zoneColours";
import { CalloutPlan, ink } from "@/components/boat/zone/Callouts";
import { useCollapsed } from "@/components/boat/departure/BatteryStatus";
import { AddZoneWindow, ZoneDropdowns } from "@/components/boat/zone/ZoneDropdowns";

const clamp = (v) => Math.min(1, Math.max(0, v));
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Read-only full-size plan with its zone dots and names.
export const OverviewView = ({ src, swatches = [], testId = "zone-overview-full" }) => (
  <CalloutPlan src={src} alt="Zone Map Overview" imgClass="block max-h-[80vh] max-w-full" swatches={swatches} testId={testId} />
);

// A Zone Map Overview: an AI layout plan the skipper drops the admin's predetermined colour squares onto (e.g. Cockpit - Gold where the cockpit is).
export const OverviewMap = ({ boat, map, src, canEdit, online, presets = [], onMaps, onRemove, removing, onImage, onColour, onZoneDefaults, autoStart = false, big = false }) => {
  const [swatches, setSwatches] = useState(map.swatches || []);
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(null);
  const [ghost, setGhost] = useState(null);
  const box = useRef(null);
  const winBox = useRef(null);
  const [win, setWin] = useState(false);
  // The plan being worked on: the one in "Add Zone to schematic window" while it's open.
  const planEl = () => (win ? winBox : box).current;
  useEffect(() => setSwatches(map.swatches || []), [map.swatches]);
  const t = `zone-overview-${map.id}`;
  const foldKey = `mbp_overview_colours_folded_${boat.boat_id}`;
  const [folded, setFolded] = useState(() => localStorage.getItem(foldKey) === "1");
  const toggleTools = () => { const f = !folded; localStorage.setItem(foldKey, f ? "1" : "0"); setFolded(f); if (f) setArmed(null); };
  // No colours placed yet: the colours stay open so "Magically Place Colours" is always there.
  const shut = folded && swatches.length > 0;
  const [allColours, setAllColours] = useState(false);
  const toggleAll = () => setAllColours((v) => !v);
  const [paletteEl, setPaletteEl] = useState(null);
  const [clipH, setClipH] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  // Show the first two rows of colours; the rest sit behind "Show N other zones".
  useLayoutEffect(() => {
    const el = paletteEl;
    const measure = () => {
      if (!el) { setClipH(0); setHiddenCount(0); return; }
      const base = el.getBoundingClientRect().top;
      const rows = [...el.children].map((k) => { const r = k.getBoundingClientRect(); return { top: Math.round(r.top - base), bottom: r.bottom - base }; });
      const tops = [...new Set(rows.map((r) => r.top))].sort((a, b) => a - b);
      if (tops.length <= 2) { setClipH(0); setHiddenCount(0); return; }
      setClipH(Math.ceil(Math.max(...rows.filter((r) => r.top <= tops[1]).map((r) => r.bottom))) + 2);
      setHiddenCount(rows.filter((r) => r.top >= tops[2]).length);
    };
    measure();
    if (!el) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paletteEl, presets.length, swatches.length]);
  const save = async (next) => {
    setSwatches(next);
    if (!online) { toast.error("You need a signal to save the colours"); return; }
    try { onMaps((await api.put(`/boats/${boat.boat_id}/zone-maps/${map.id}/swatches`, { swatches: next })).data.zone_maps); }
    catch (e) { toast.error(apiError(e, "Couldn't save the colours")); setSwatches(map.swatches || []); }
  };
  const at = (x, y) => {
    const r = planEl()?.getBoundingClientRect();
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return { x: clamp((x - r.left) / r.width), y: clamp((y - r.top) / r.height) };
  };
  const place = (p, pos) => {
    if (swatches.some((s) => s.label === p.label)) { toast.error(`${p.label} is already on this plan`); setArmed(null); return; }
    save([...swatches, { id: newId(), x: pos.x, y: pos.y, colour: p.colour, label: p.label }]); setArmed(null);
  };
  const used = new Set(swatches.map((s) => s.label));
  // Opening a zone from the window closes the window first.
  const openZone = (s) => { setWin(false); onColour?.(s); };
  // From the drop downs: an unplaced colour waits for a tap on the plan; a placed (ticked) one comes off.
  const pick = (p, on) => {
    if (!on) { setArmed(p); return; }
    setArmed(null); save(swatches.filter((s) => s.label !== p.label)); toast(`${p.label} taken off the schematic`);
  };
  const [placing, setPlacing] = useState(false);
  const [withDeck, setWithDeck] = useState(false);
  const autoPlace = async () => {
    if (!online) { toast.error("You need a signal for the Magic Mariner"); return; }
    setPlacing(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/zone-maps/${map.id}/auto-swatches`, { include_deck: withDeck }, { timeout: 90000 });
      onMaps(data.zone_maps);
      const made = onZoneDefaults?.((data.zone_maps.find((m) => m.id === map.id) || {}).swatches || []) || 0;
      toast.success(`Magic Mariner placed ${data.placed} ${data.placed === 1 ? "colour" : "colours"}${made ? ` and added ${made} ${made === 1 ? "cupboard" : "cupboards"} for those zones` : ""}. Drag any that need nudging.`, { duration: 6000, ...(autoStart ? { position: "top-center" } : {}) });
    } catch (e) { toast.error(apiError(e, "The Magic Mariner couldn't place the colours")); }
    finally { setPlacing(false); }
  };
  // Set Up Wizard: press "Magically Place Colours" once the colours are ready, if none are placed yet.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoStart || autoRan.current || !presets.length || swatches.length) return;
    autoRan.current = true;
    autoPlace();
  }, [autoStart, presets.length]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const sx = e.clientX, sy = e.clientY;
    if (!canEdit) {
      const up = (ev) => { window.removeEventListener("pointerup", up); if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) openZone(s); };
      window.addEventListener("pointerup", up);
      return;
    }
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
      else if (!held) { setSelected(null); openZone(s); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  // Drag a zone name along, above or below the plan; a tap opens the zone like its dot.
  const dragLabel = (e, s) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let moved = false, last = s;
    // Measured once: the plan shifts as name rows are added above it.
    const r = planEl()?.getBoundingClientRect();
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < (canEdit ? 6 : 10)) return;
      moved = true;
      if (!canEdit || !r) return;
      const { band, lrow, ...rest } = s;
      last = { ...rest, lx: clamp((ev.clientX - r.left) / r.width), ly: Math.min(2.5, Math.max(-1.5, (ev.clientY - r.top) / r.height)) };
      setSwatches((all) => all.map((x) => (x.id === s.id ? last : x)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (moved) { if (canEdit) save(swatches.map((x) => (x.id === s.id ? last : x))); }
      else { setSelected(null); openZone(s); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const [hidden, toggleHidden] = useCollapsed(`mbp_overview_hidden_${map.id}`);
  const tapPlan = (e) => {
    if (armed) { const pos = at(e.clientX, e.clientY); if (pos) place(armed, pos); return; }
    if (selected) setSelected(null);
  };
  // big (the wizard's blank hull): twice the size on phones, scroll sideways for the rest of the hull.
  const plan = (ref, inWin) => (
    <div className={big ? "overflow-x-auto max-sm:rounded-md max-sm:bg-white" : ""} data-testid={big ? `${t}-big` : undefined}>
      <CalloutPlan src={src} alt={`${map.name || "Zone Map"} overview`} imgClass={big ? "block rounded-md max-sm:w-[680px] max-sm:max-w-none sm:max-h-72 sm:max-w-full" : `block max-w-full rounded-md ${inWin ? "max-h-[45vh]" : "max-h-72"}`} swatches={swatches} boxRef={ref}
        selected={selected} onDotDown={dragOld} onLabelDown={dragLabel} onClick={tapPlan} onOpen={inWin ? undefined : onImage} className={`${armed ? "cursor-crosshair" : ""} ${big ? "max-sm:!max-w-none" : ""}`}
        testId={inWin ? `${t}-win` : t} planTestId={inWin ? `${t}-win-plan` : `${t}-plan`}
        onRemove={canEdit ? (e, s) => { e.stopPropagation(); setSelected(null); save(swatches.filter((x) => x.id !== s.id)); } : null} />
    </div>
  );
  return (
    // Dark grey panel: an overview of the whole boat, unlike a zone's own photo (e.g. the galley).
    <div className="overview-dark flex flex-col gap-1.5 rounded-md border-[1.5px] border-zinc-400 bg-zinc-500 p-2 text-white" data-testid={t}>
      <button type="button" onClick={toggleHidden} aria-expanded={!hidden} className="flex items-center gap-2 text-left text-sm font-bold text-[var(--navy)]" data-testid={`${t}-hide-toggle`}>
        <span className="min-w-0 flex-1 truncate" data-testid={`${t}-title`}>{map.name || "Zone Map Overview"}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold">{hidden ? <>Show <ChevronDown className="h-4 w-4" /></> : <>Hide <ChevronDown className="h-4 w-4 rotate-180" /></>}</span>
      </button>
      {!hidden && (<>
      {map.source_url && <a href={map.source_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-semibold text-[var(--muted)] underline" data-testid={`${t}-source`}>Source: {map.source_title || "web"}</a>}
      {plan(box, false)}
      {big && <p className="text-xs font-semibold text-white sm:hidden" data-testid={`${t}-big-hint`}>Scroll the drawing sideways to reach the bow and stern.</p>}
      {canEdit && (
        <>
          <button type="button" onClick={swatches.length ? toggleTools : undefined} aria-expanded={!shut} aria-disabled={!swatches.length}
            title={swatches.length ? undefined : "Colours stay open until the first colour is placed"} className="flex min-h-9 items-center gap-2 text-left text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`${t}-colours-toggle`}>
            <Palette className="h-4 w-4" /> Colours ({swatches.length} placed)
            {swatches.length > 0 && <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${shut ? "" : "rotate-180"}`} />}
          </button>
          {!shut && <>
          <button type="button" className="btn-solid min-h-10 justify-center gap-2 text-sm" onClick={() => { setAllColours(false); setArmed(null); setWin(true); }} data-testid={`${t}-add-zone-window-btn`}>
            <Palette className="h-4 w-4" /> Add Zone to schematic window
          </button>
          <ZoneDropdowns presets={presets} used={used} onPick={pick} t={t} />
          {!win && <p className="text-xs text-[var(--muted)]" data-testid={`${t}-hint`}>{armed ? `Tap the plan where the ${armed.label} is.` : "Pick a zone from Add head, Add cabin, Add engine or Add other, then tap the plan where it is (a ticked one is on the plan; pick it again to take it off). For anything unusual, use Add Zone to schematic window. Tap a placed dot or its name to add photos of that zone and scan its cupboards."}</p>}
          </>}
          <AddZoneWindow open={win} onClose={() => { setWin(false); setArmed(null); }} t={t}>
          {plan(winBox, true)}
          {!big && <>
          <button type="button" className="btn-solid min-h-10 justify-center gap-2 text-sm" disabled={placing || !presets.length} onClick={autoPlace} data-testid={`${t}-auto-btn`}>
            {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {placing ? "Magic Mariner is finding zones to colour..." : "Magically Place Colours"}
          </button>
          <label className="flex min-h-9 flex-wrap items-center gap-x-2 text-sm font-bold" data-testid={`${t}-deck-label`}>
            <input type="checkbox" checked={withDeck} onChange={(e) => setWithDeck(e.target.checked)} disabled={placing} className="h-5 w-5 accent-[var(--navy)]" data-testid={`${t}-deck-checkbox`} />
            Include deck zones
            <span className="basis-full pl-7 text-xs font-semibold text-[var(--muted)]">{withDeck ? "decks, anchor locker and lazarettes too" : "below deck, cockpit and transom only"}</span>
          </label>
          </>}
          <p className="text-xs text-[var(--muted)]" data-testid={`${t}-win-hint`}>{armed ? `Tap the plan where the ${armed.label} is.` : "Drag a colour onto the plan (or tap a colour, then tap the plan). Tap a placed dot or its name to add photos of that zone and scan its cupboards; press and hold a dot to remove it. Drag a name anywhere, even over the drawing; it stays where you drop it."}</p>
          <div ref={setPaletteEl} className="flex flex-wrap gap-1.5 overflow-hidden p-0.5" style={clipH && !allColours ? { maxHeight: clipH } : undefined} data-testid={`${t}-palette`}>
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
          {hiddenCount > 0 && (
            <button type="button" onClick={toggleAll} aria-expanded={allColours} className="btn-ghost h-9 gap-1.5 self-start px-3 text-xs" data-testid={`${t}-palette-more-btn`}>
              <ChevronDown className={`h-3.5 w-3.5 [transition:transform_.15s] ${allColours ? "rotate-180" : ""}`} />
              {allColours ? "Show fewer colours" : `Show ${hiddenCount} other ${hiddenCount === 1 ? "zone" : "zones"}, and their colours`}
            </button>
          )}
          </AddZoneWindow>
          {onRemove && <button type="button" className="btn-ghost h-9 self-end px-3 text-xs hover:text-[var(--red)]" disabled={removing} onClick={onRemove} data-testid={`${t}-remove-btn`}>
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove this overview
          </button>}
        </>
      )}
      </>)}
      {ghost && createPortal(
        <span className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-extrabold shadow-lg"
          style={{ left: ghost.x, top: ghost.y, background: ZONE_COLOURS[ghost.p.colour], color: ink(ghost.p.colour) }}>{ghost.p.label}</span>, document.body
      )}
    </div>
  );
};
