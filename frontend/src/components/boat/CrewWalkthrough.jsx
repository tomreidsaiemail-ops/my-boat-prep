import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, PenLine, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PinnedPhoto, pinName } from "@/components/boat/PinnedPhoto";
import { StopContents } from "@/components/boat/inventory/FolderPeek";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { CupboardName, SkipperComment } from "@/components/boat/zone/SkipperComment";
import { CupboardPhoto, areaPhotoUrl } from "@/components/boat/inventory/CupboardPhoto";
import { areaZones } from "@/lib/zoneColours";

// Stops, photo by photo in the order the labels were placed. A photo with no labels but a Skipper's comment is one stop of its own.
// Every labelled cupboard is a stop. Cupboards not labelled on any photo need their own photo and a comment, and go just before
// the labelled stops of the zone map photo for their zone.
const COMMENT = "comment";
export const isCommentStop = (s) => s.pin.id === COMMENT;
const mapPins = (m) => (m?.pins?.length ? m.pins
  : m && m.kind !== "overview" && (m.comment || "").trim() ? [{ id: COMMENT, label: m.name || m.zone || "Zone map photo", area_id: null }] : []);
const said = (t) => !!(t || "").trim();
export const CONTENTS = "+c:";
export const stepKey = (s) => `${s.pic.key}:${s.pin.id}`;
export const allStops = (pics, areas = [], boat) => {
  const pinned = new Set(pics.flatMap((p) => (p.map?.pins || []).map((x) => x.area_id)));
  const zones = areaZones(boat, areas);
  const loose = areas.filter((a) => !a.parent_id && !pinned.has(a.id) && said(a.comment) && a.photo?.id).map((a) => ({
    pic: { key: "area", src: areaPhotoUrl(boat, a.photo), map: { pins: [], zone: zones[a.id]?.map || "", name: a.name } },
    pin: { id: a.id, area_id: a.id }, cupboard: true, colour: zones[a.id]?.colour,
  }));
  const used = new Set();
  const out = [];
  pics.forEach((p) => {
    const name = p.name || p.map?.zone || p.map?.name || "Zone map";
    if (p.map?.kind !== "overview" && p.map?.colour) loose.filter((s) => s.colour === p.map.colour && !used.has(s)).forEach((s) => { used.add(s); out.push({ ...s, group: p.key, groupName: name }); });
    mapPins(p.map).forEach((pin) => out.push({ pic: p, pin, group: p.key, groupName: name }));
  });
  return [...out, ...loose.filter((s) => !used.has(s)).map((s) => ({ ...s, group: "cupboards", groupName: "Other cupboards" }))];
};
// The stops a crew member walks, each marked with whether its cupboard contents are shown (skip also holds "+c:<stop>" entries).
export const walkSteps = (pics, skip = [], areas = [], boat) => allStops(pics, areas, boat)
  .filter((s) => !skip.includes(stepKey(s))).map((s) => ({ ...s, contents: skip.includes(CONTENTS + stepKey(s)) }));

export const WalkStopContents = StopContents;

const stopKey = (s) => s.id || `${s.pic.key}:${s.pin.id}`;

// `ticked`/`onTick` (from the Boat Terms and Conditions) add an "I've seen it" tick to each stop; `onSeen` ticks each stop as it's shown.
export const CrewWalkthrough = ({ steps, areas, onClose, onOpenArea, onSignOff, ticked, onTick, onSeen, start = 0, boat, stars = [], onStar }) => {
  const [pos, setN] = useState(start);
  const seenKey = steps.length ? stopKey(steps[Math.min(pos, steps.length - 1)]) : "";
  useEffect(() => { if (seenKey && onSeen) onSeen(seenKey); }, [seenKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [signing, setSigning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (!steps.length) onClose(); }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // The first photo shows straight away; the rest load in the background while the crew member looks.
  useEffect(() => { [...new Set(steps.map((s) => s.pic.src))].slice(1).forEach((src) => { const i = new Image(); i.src = src; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!steps.length) return null;
  const n = Math.min(pos, steps.length - 1);
  const step = steps[n];
  const area = areas.find((a) => a.id === step.pin.area_id);
  const last = n === steps.length - 1;
  const note = isCommentStop(step);
  const ask = () => setLeaving(true);
  return (
    <Dialog open onOpenChange={(o) => !o && ask()}>
      <DialogContent guard={false} className="flex h-[92vh] max-w-2xl flex-col gap-3 rounded-lg border-2 border-[var(--navy)] p-4" data-testid="walkthrough-dialog">
        <DialogHeader>
          <div className="flex items-start gap-2 pr-6">
            <DialogTitle className="min-w-0 flex-1 font-display text-lg font-extrabold uppercase tracking-tight" data-testid="walkthrough-title">{pinName(step.pin, areas)}</DialogTitle>
            {onStar && (
              <button type="button" onClick={() => onStar(stopKey(step))} aria-pressed={stars.includes(stopKey(step))} className="icon-btn h-9 w-9 shrink-0 [transition:transform_.1s] active:scale-90"
                aria-label={stars.includes(stopKey(step)) ? "Remove the gold star" : "Give this stop a gold star"} title="Gold star (only you see it)" data-testid="walkthrough-star-btn">
                <Star className={`h-5 w-5 ${stars.includes(stopKey(step)) ? "fill-amber-400 text-amber-500" : "text-[var(--muted)]"}`} />
              </button>
            )}
          </div>
          <DialogDescription data-testid="walkthrough-step">Stop {n + 1} of {steps.length} · {note ? "read the skipper's comment on this photo." : "here's what's stowed in this spot."}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1" data-testid="walkthrough-body">
        {!note && <CupboardName name={pinName(step.pin, areas)} testId="walkthrough-cupboard-name" />}
        <PinnedPhoto key={step.pic.src} src={step.pic.src} alt={`Zone map showing ${pinName(step.pin, areas)}`} pins={step.pic.map.pins.filter((p) => steps.some((s) => s.pic.key === step.pic.key && s.pin.id === p.id))} areas={areas} highlight={step.pin.id}
          imgClass="max-h-[40vh] w-full rounded-md object-contain" testId="walkthrough-photo" />
        <SkipperComment text={step.pic.map?.comment} testId="walkthrough-skipper-comment" />
        {!note && <SkipperComment text={area?.comment} label="Cupboard comment" testId="walkthrough-cupboard-comment" />}
        {!note && !step.cupboard && <CupboardPhoto boat={boat} area={area} testId="walkthrough-cupboard-photo" />}
        {!note && step.contents && <WalkStopContents area={area} areas={areas} />}
        {onTick && (
          <label className={`flex min-h-11 items-center gap-3 rounded-md border-[1.5px] px-3 font-bold ${ticked.includes(stopKey(step)) ? "border-emerald-600 bg-emerald-50" : "border-[var(--line)]"}`} data-testid="walkthrough-seen">
            <input type="checkbox" checked={ticked.includes(stopKey(step))} onChange={() => onTick(stopKey(step))} className="h-5 w-5 accent-emerald-700" data-testid="walkthrough-seen-checkbox" />
            I've seen {pinName(step.pin, areas)}
          </label>
        )}
        {area && !onTick && <button type="button" className="btn-ghost h-9 w-fit justify-self-start px-3 text-xs" onClick={() => { onClose(); onOpenArea(area.id); }} data-testid="walkthrough-open-area-btn">Open in Boat Inventory</button>}
        </div>
        {last && onSignOff && (
          <button type="button" className="btn-solid h-11 justify-center gap-2" disabled={signing} data-testid="walkthrough-signoff-btn"
            onClick={async () => { setSigning(true); if (await onSignOff(steps.length)) onClose(); else setSigning(false); }}>
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Sign off in Ship's Log
          </button>
        )}
        <div className="flex shrink-0 items-center gap-2" data-testid="walkthrough-nav">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" disabled={n === 0} onClick={() => setN(n - 1)} data-testid="walkthrough-back-btn"><ChevronLeft className="h-4 w-4" /> Back</button>
          {!last
            ? <button type="button" className="btn-solid h-11 flex-1 justify-center" onClick={() => setN(n + 1)} data-testid="walkthrough-next-btn">Next <ChevronRight className="h-4 w-4" /></button>
            : <button type="button" className={`${onSignOff ? "btn-ghost" : "btn-solid"} h-11 flex-1 justify-center`} onClick={onClose} data-testid="walkthrough-done-btn">Done</button>}
        </div>
        <ConfirmDelete item={leaving ? {} : null} danger={false} testId="walkthrough-exit" title="Are you sure you want to exit the walkthrough?"
          note={`You're at stop ${n + 1} of ${steps.length}.${onTick ? " The stops you've ticked are kept." : ""}`} confirmLabel="Exit" cancelLabel="Keep going"
          onConfirm={() => { setLeaving(false); onClose(); }} onClose={() => setLeaving(false)} />
      </DialogContent>
    </Dialog>
  );
};
