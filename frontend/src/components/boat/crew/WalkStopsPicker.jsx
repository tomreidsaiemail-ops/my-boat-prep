import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, Check, ChevronDown, Footprints, Loader2, MessageSquareText, Star } from "lucide-react";
import { areaPhotoUrl } from "@/components/boat/inventory/CupboardPhoto";
import { api, apiError } from "@/lib/api";
import { pinName } from "@/components/boat/PinnedPhoto";
import { CONTENTS, allStops, isCommentStop } from "@/components/boat/CrewWalkthrough";
import { boatMapUrl } from "@/components/boat/ZoneMap";

export const keyOf = (s) => `${s.pic.key}:${s.pin.id}`;
const said = (t) => (t || "").trim();
export const walkPics = (boat) => (boat.zone_maps || []).map((m) => ({ key: m.id, map: m, src: boatMapUrl(boat, m), name: [m.zone, m.name].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "Zone map" }));
// The cupboard's own photo (labelled stops) or the cupboard-photo stop's photo; comment-only stops have none.
const photoOf = (s, areas, boat) => (isCommentStop(s) ? "" : s.cupboard ? s.pic.src : areaPhotoUrl(boat, areas.find((a) => a.id === s.pin.area_id)?.photo));
const commentOf = (s, areas) => said(isCommentStop(s) ? s.pic.map.comment : areas.find((a) => a.id === s.pin.area_id)?.comment);

// Every stop grouped by zone map photo, each ticked in or out, with a Contents bubble that shows the cupboard's contents in the walkthrough.
export const StopList = ({ steps, areas, skip, onFlip, onSetMany, boat, stars = [] }) => {
  const groups = [...new Map(steps.map((s) => [s.group, s.groupName])).entries()];
  return groups.map(([g, name]) => {
    const keys = steps.filter((s) => s.group === g).map(keyOf);
    const allOn = keys.every((k) => !skip.includes(k));
    return (
    <div key={g} className="flex flex-col gap-1" data-testid={`walk-stops-map-${g}`}>
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]">{name}</p>
        <button type="button" onClick={() => onSetMany(keys, !allOn)} className="shrink-0 text-xs font-bold text-[var(--navy)] underline underline-offset-2 hover:opacity-70" data-testid={`walk-stops-map-${g}-all-btn`}>
          {allOn ? "Remove all" : "Add all"}
        </button>
      </div>
      {steps.filter((s) => s.group === g).map((s) => (
        <StopRow key={keyOf(s)} s={s} areas={areas} on={!skip.includes(keyOf(s))} contents={skip.includes(CONTENTS + keyOf(s))}
          onFlip={() => onFlip(keyOf(s))} onContents={() => onFlip(CONTENTS + keyOf(s))} comment={commentOf(s, areas)}
          star={stars.includes(keyOf(s))} photo={photoOf(s, areas, boat)} />
      ))}
    </div>
    );
  });
};
// Ticks (on) or unticks a set of stops in a walk_skip list.
export const setStops = (list, keys, on) => (on ? list.filter((k) => !keys.includes(k)) : [...new Set([...list, ...keys])]);

const Bubble = ({ on, onClick, children, testId, ...rest }) => (
  <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId} {...rest}
    className="flex h-8 shrink-0 items-center gap-1 rounded-full border-[1.5px] px-2.5 text-xs font-bold [transition:background-color_.15s,transform_.1s] active:scale-95">
    {children}
  </button>
);

// One stop: tick it in or out; Comment shows the cupboard's (or photo's) comment; Contents (light red off, green with a tick on) shows what's stowed.
const StopRow = ({ s, areas, on, contents, onFlip, onContents, comment, star, photo }) => {
  const [show, setShow] = useState(false);
  const [peek, setPeek] = useState(false);
  const t = `walk-stop-${s.pin.id}`;
  return (
    <div className="flex flex-col gap-1" data-testid={t}>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <label className="flex min-w-[10rem] flex-1 items-center gap-2.5 text-sm">
          <input type="checkbox" checked={on} onChange={onFlip} className="h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`${t}-checkbox`} />
          {star && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-label="Gold star" data-testid={`${t}-star`} />}
          <span className="min-w-0 break-words">{pinName(s.pin, areas)}{!isCommentStop(s) && <span className="ml-1 whitespace-nowrap text-xs font-semibold text-[var(--muted)]">{s.cupboard ? "(cupboard photo)" : "(labelled)"}</span>}</span>
        </label>
        {comment && (
          <Bubble on={show} onClick={() => setShow(!show)} testId={`${t}-comment-bubble`} aria-label={show ? "Hide the comment" : "Show the comment"}
            style={show ? { borderColor: "var(--navy)", background: "var(--navy)", color: "#fff" } : { borderColor: "var(--navy)", background: "var(--panel)", color: "var(--navy)" }}>
            <MessageSquareText className="h-3.5 w-3.5" /> Comment
          </Bubble>
        )}
        {photo && (
          <Bubble on={peek} onClick={() => setPeek(!peek)} testId={`${t}-photo-bubble`} aria-label={peek ? "Hide the photo" : "Show the photo"}
            style={peek ? { borderColor: "var(--navy)", background: "var(--navy)", color: "#fff" } : { borderColor: "var(--navy)", background: "var(--panel)", color: "var(--navy)" }}>
            <Camera className="h-3.5 w-3.5" /> Photo
          </Bubble>
        )}
        {!isCommentStop(s) && (
          <Bubble on={contents} onClick={onContents} testId={`${t}-contents-bubble`} data-on={contents ? "true" : "false"}
            title={contents ? "Contents are shown in the walkthrough. Tap to hide them" : "Contents are hidden in the walkthrough. Tap to show them"}
            style={contents ? { borderColor: "#059669", background: "#d1fae5", color: "#065f46" } : { borderColor: "#fca5a5", background: "#fee2e2", color: "#991b1b" }}>
            {contents && <Check className="h-3.5 w-3.5" />} Contents
          </Bubble>
        )}
      </div>
      {photo && peek && <img src={photo} alt={`Photo of ${pinName(s.pin, areas)}`} loading="lazy" className="ml-7 max-h-56 w-fit max-w-[calc(100%-1.75rem)] rounded-md border-[1.5px] border-[var(--navy)] object-contain" data-testid={`${t}-photo`} />}
      {comment && show && <p className="ml-7 whitespace-pre-line rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--navy)]" data-testid={`${t}-comment`}>{comment}</p>}
    </div>
  );
};

// Cupboards with neither a photo nor a comment can't be a stop. Hiding the list is remembered until the list itself changes.
const Missing = ({ list, boatId }) => {
  const key = `mbp_walk_missing_hidden_${boatId}`;
  const sig = list.map((a) => a.id).sort().join(",");
  const [hidden, setHidden] = useState(() => localStorage.getItem(key) === sig);
  const flip = () => { if (hidden) localStorage.removeItem(key); else localStorage.setItem(key, sig); setHidden(!hidden); };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-[1.5px] border-amber-500 bg-amber-50 p-2.5 text-sm" role="alert" data-testid="walk-stops-missing" data-hidden={hidden ? "true" : "false"}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-900" />
        <p className="min-w-0 flex-1 font-bold text-amber-900">{hidden
          ? `${list.length} ${list.length === 1 ? "cupboard is" : "cupboards are"} not part of the walkthrough.`
          : "These cupboards do not have a photo and a comment, and are not labelled on a zone map photo, so are not part of the walkthrough. Add a comment and a photo, or label the cupboard on a zone map photo, then those cupboards can be selected for the default crew walkthrough or for crew members interested in that particular cupboard."}</p>
        <button type="button" onClick={flip} className="shrink-0 text-xs font-bold text-amber-900 underline underline-offset-2 hover:opacity-70" aria-expanded={!hidden} data-testid="walk-stops-missing-toggle">{hidden ? "Show" : "Hide"}</button>
      </div>
      {!hidden && <p className="pl-6 font-semibold text-amber-950" data-testid="walk-stops-missing-names">{list.map((a) => a.name).join(", ")}</p>}
    </div>
  );
};

// The skipper picks the default stops on the crew's Boat Walk Through (all, to start) and which show their contents (none, to start).
export const WalkStopsPicker = ({ boat, areas = [], online, onSaved }) => {
  const pics = walkPics(boat);
  const steps = allStops(pics, areas, boat);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(boat.walk_skip || []);
  const [busy, setBusy] = useState(false);
  const pinned = new Set(pics.flatMap((p) => (p.map.pins || []).map((x) => x.area_id)));
  const missing = areas.filter((a) => !a.parent_id && !pinned.has(a.id) && !said(a.comment) && !a.photo?.id);
  if (!steps.length && !missing.length) return null;
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
        {missing.length > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Some cupboards have no photo and no comment" data-testid="walk-stops-missing-icon" />}
        <ChevronDown className={`ml-auto h-4 w-4 [transition:transform_.15s] ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">Untick cupboards of less importance. Crew only see the ticked stops in the Boat Terms and Conditions walkthrough, unless you pick their own stops when you invite them. Tap Comment to read a cupboard&apos;s comment. Tap Contents (green with a tick) to show what&apos;s stowed in that cupboard during the walkthrough.</p>
          {missing.length > 0 && <Missing list={missing} boatId={boat.boat_id} />}
          <StopList steps={steps} areas={areas} skip={skip} boat={boat} stars={boat.walk_stars || []} onFlip={flip} onSetMany={(keys, v) => setSkip((l) => setStops(l, keys, v))} />
          {steps.length > 0 && (
            <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={!changed || busy || !on} onClick={save} data-testid="walk-stops-save-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {on ? "Save walkthrough stops" : "Keep at least one stop"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
