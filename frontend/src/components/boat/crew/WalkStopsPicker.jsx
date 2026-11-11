import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Footprints, Loader2, MessageSquareText, Tag } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { pinName } from "@/components/boat/PinnedPhoto";
import { isCommentStop, walkSteps } from "@/components/boat/CrewWalkthrough";
import { ZonePinEditor } from "@/components/boat/ZonePinEditor";
import { boatMapUrl } from "@/components/boat/ZoneMap";
import { areaZones } from "@/lib/zoneColours";

export const keyOf = (s) => `${s.pic.key}:${s.pin.id}`;
const said = (t) => (t || "").trim();
export const walkPics = (boat) => (boat.zone_maps || []).map((m) => ({ key: m.id, map: m, src: boatMapUrl(boat, m), name: [m.zone, m.name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "Zone map" }));
const commentOf = (s, areas) => said(isCommentStop(s) ? s.pic.map.comment : areas.find((a) => a.id === s.pin.area_id)?.comment);

// Every stop grouped by zone map photo, each ticked in or out.
export const StopList = ({ steps, areas, skip, onFlip }) => {
  const maps = [...new Map(steps.map((s) => [s.pic.key, s.pic])).values()];
  return maps.map((m) => (
    <div key={m.key} className="flex flex-col gap-1" data-testid={`walk-stops-map-${m.key}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{m.name}</p>
      {steps.filter((s) => s.pic.key === m.key).map((s) => (
        <StopRow key={keyOf(s)} s={s} areas={areas} on={!skip.includes(keyOf(s))} onFlip={() => onFlip(keyOf(s))} comment={commentOf(s, areas)} />
      ))}
    </div>
  ));
};

// One stop: tick it in or out; a bubble shows the cupboard's (or photo's) comment so the skipper can judge it.
const StopRow = ({ s, areas, on, onFlip, comment }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1" data-testid={`walk-stop-${s.pin.id}`}>
      <div className="flex min-h-9 items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 text-sm">
          <input type="checkbox" checked={on} onChange={onFlip} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`walk-stop-${s.pin.id}-checkbox`} />
          <span className="min-w-0 break-words">{pinName(s.pin, areas)}</span>
        </label>
        {comment && (
          <button type="button" onClick={() => setShow(!show)} aria-expanded={show} aria-label={show ? "Hide the comment" : "Show the comment"} title={show ? "Hide the comment" : "Show the comment"}
            className={`flex h-8 items-center gap-1 rounded-full border-[1.5px] px-2.5 text-xs font-bold [transition:background-color_.15s] ${show ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--navy)] bg-[var(--panel)] text-[var(--navy)]"}`}
            data-testid={`walk-stop-${s.pin.id}-comment-bubble`}>
            <MessageSquareText className="h-3.5 w-3.5" /> Comment
          </button>
        )}
      </div>
      {comment && show && <p className="ml-7 whitespace-pre-line rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--navy)]" data-testid={`walk-stop-${s.pin.id}-comment`}>{comment}</p>}
    </div>
  );
};

// Cupboards with a comment that aren't labelled on any zone map photo can't be a stop yet.
const Unlabelled = ({ list, onLabel }) => (
  <div className="flex flex-col gap-2 rounded-md border-[1.5px] border-amber-500 bg-amber-50 p-2.5 text-sm" role="alert" data-testid="walk-stops-unlabelled">
    <p className="flex gap-2 font-bold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {list.length === 1 ? "This cupboard has a comment but isn't labelled on a zone map photo, so crew won't see it:" : "These cupboards have a comment but aren't labelled on a zone map photo, so crew won't see them:"}</p>
    {list.map(({ area, pic }) => (
      <div key={area.id} className="flex flex-wrap items-center gap-2 pl-6" data-testid={`walk-stops-unlabelled-${area.id}`}>
        <span className="min-w-0 flex-1 break-words font-semibold">{area.name}</span>
        {pic ? <button type="button" className="btn-ghost h-9 px-3 text-xs" onClick={() => onLabel(area, pic)} data-testid={`walk-stops-unlabelled-${area.id}-label-btn`}><Tag className="h-3.5 w-3.5" /> Label it on {pic.map.name || pic.map.zone || "a photo"}</button>
          : <span className="text-xs text-amber-900">Add a zone map photo in Boat Inventory first.</span>}
      </div>
    ))}
  </div>
);

// The skipper picks which labelled cupboards are the default stops on the crew's Boat Walk Through (all, to start).
export const WalkStopsPicker = ({ boat, areas = [], online, onSaved, onMaps, onAddAreas }) => {
  const pics = walkPics(boat);
  const steps = walkSteps(pics);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(boat.walk_skip || []);
  const [busy, setBusy] = useState(false);
  const [labelling, setLabelling] = useState(null);
  const pinned = new Set(pics.flatMap((p) => (p.map.pins || []).map((x) => x.area_id)));
  const photos = pics.filter((p) => p.map.kind !== "overview");
  const zones = areaZones(boat, areas);
  const unlabelled = areas.filter((a) => !a.parent_id && said(a.comment) && !pinned.has(a.id))
    .map((area) => ({ area, pic: photos.find((p) => zones[area.id]?.colour && p.map.colour === zones[area.id].colour) || photos[0] }));
  if (!steps.length && !unlabelled.length) return null;
  const saved = boat.walk_skip || [];
  const changed = skip.length !== saved.length || skip.some((s) => !saved.includes(s));
  const on = steps.filter((s) => !skip.includes(keyOf(s))).length;
  const flip = (k) => setSkip((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const save = async () => {
    if (!online) { toast.error("Go online to save the walkthrough stops"); return; }
    setBusy(true);
    try {
      const { data } = await api.put(`/boats/${boat.boat_id}/walk-stops`, { skip });
      onSaved(data.walk_skip); setSkip(data.walk_skip);
      toast.success(`Walkthrough now has ${on} ${on === 1 ? "stop" : "stops"}`);
    } catch (e) { toast.error(apiError(e, "Couldn't save the walkthrough stops")); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-md border-[1.5px] border-[var(--line)]" data-no-dirty data-testid="walk-stops-picker">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-bold" data-testid="walk-stops-toggle">
        <Footprints className="h-4 w-4 shrink-0" /> Default walkthrough stops <span className="font-semibold text-[var(--muted)]" data-testid="walk-stops-count">({on} of {steps.length})</span>
        {unlabelled.length > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-label="A commented cupboard isn't labelled" data-testid="walk-stops-unlabelled-icon" />}
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">Untick cupboards of less importance. Crew only see the ticked stops in the Boat Terms and Conditions walkthrough, unless you pick their own stops when you invite them. Tap Comment to read a cupboard&apos;s comment.</p>
          {unlabelled.length > 0 && <Unlabelled list={unlabelled} onLabel={(area, pic) => setLabelling({ area, pic })} />}
          <StopList steps={steps} areas={areas} skip={skip} onFlip={flip} />
          {steps.length > 0 && (
            <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={!changed || busy || !on} onClick={save} data-testid="walk-stops-save-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {on ? "Save walkthrough stops" : "Keep at least one stop"}
            </button>
          )}
        </div>
      )}
      {labelling && <ZonePinEditor pic={labelling.pic} boat={boat} areas={areas} online={online} onAddAreas={onAddAreas} onMaps={onMaps} focusArea={labelling.area} onClose={() => setLabelling(null)} />}
    </div>
  );
};
