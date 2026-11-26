import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dmyt } from "@/lib/allDone";
import { When } from "@/components/boat/navigator/NavigatorExtras";
import { ArriveQuickPick, ArriveType, arriveType, END_TRANSIT } from "@/components/boat/navigator/ArriveType";
import { TripConfirm } from "@/components/boat/navigator/TripConfirm";
import { firstLeg } from "@/components/boat/navigator/PlannedRouteView";
import { AddLegPosition } from "@/components/boat/navigator/AddLegPosition";
import { TideNote } from "@/components/boat/navigator/TideNote";

const Field = ({ id, label, value, onChange, placeholder }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <label htmlFor={id} className="field-label">{label}</label>
    <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder={placeholder} className="field-input text-base normal-case tracking-normal" data-testid={`${id}-input`} />
  </div>
);

const pad = (n) => String(n).padStart(2, "0");
const nowPlus = (min) => { const d = new Date(Date.now() + min * 60000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// The skipper usually tweaks the time next, so the time box gets focus.
const focusTime = (id) => setTimeout(() => document.querySelector(`[data-testid="${id}-time-input"]`)?.focus(), 0);

const NowButton = ({ label, testId, onClick }) => (
  <button type="button" className="btn-ghost -mt-1 h-9 min-h-0 self-end px-3 text-xs" onClick={onClick} data-testid={testId}>{label}</button>
);

const problem = (l, end) => {
  if (!l.route_start.trim()) return "Add the START for this leg.";
  if (!l.route_dest.trim()) return "Add the DESTINATION for this leg.";
  if ((l.finish_at || "").length < 16) return "Enter the Estimated Finish date and time.";
  if (l.depart_at && l.finish_at < l.depart_at) return "The Estimated Finish is before the Departure. Check the times.";
  if (!l.arrive_type) return "Pick the Arriving at Destination Type.";
  if (end && l.arrive_type === "transit") return `${END_TRANSIT} (Arriving at Destination Type)`;
  return "";
};

// end: the trip's last leg, so it can't end in a transit.
const LegForm = ({ leg, n, end, onSave, onDelete, onDirty }) => {
  const [l, setL] = useState(leg);
  const [error, setError] = useState("");
  const set = (patch) => { const next = { ...l, ...patch }; setL(next); onDirty(JSON.stringify(next) !== JSON.stringify(leg)); setError(""); };
  const save = () => { const why = problem(l, end); setError(why); if (!why) onSave({ ...l, route_start: l.route_start.trim(), route_dest: l.route_dest.trim() }); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Field id="leg-start" label="START" value={l.route_start} onChange={(v) => set({ route_start: v })} placeholder="e.g. Picton" />
        <Field id="leg-dest" label="DESTINATION" value={l.route_dest} onChange={(v) => set({ route_dest: v, dest_pos: null, path: null })} placeholder="e.g. Ship Cove" />
      </div>
      <When id="leg-depart-at" label="Departure date and time" value={l.depart_at} onChange={(v) => set({ depart_at: v })} />
      <TideNote place={l.route_start} date={(l.depart_at || "").slice(0, 10)} testId="leg-depart-tides" />
      <NowButton label="Set Now - 15 Minutes" testId="leg-depart-now-btn" onClick={() => { set({ depart_at: nowPlus(-15) }); focusTime("leg-depart-at"); }} />
      <When id="leg-finish-at" label="Estimated Finish date and time" value={l.finish_at} onChange={(v) => set({ finish_at: v })} warn={error.includes("Finish") ? error : ""} />
      <TideNote place={l.route_dest} pos={l.dest_pos} date={(l.finish_at || "").slice(0, 10)} testId="leg-finish-tides" noWarning />
      <NowButton label="Set Now + 2 hours" testId="leg-finish-now-btn" onClick={() => { set({ finish_at: nowPlus(120) }); focusTime("leg-finish-at"); }} />
      <ArriveType id="leg-arrive-type" value={l.arrive_type} onChange={(v) => set({ arrive_type: v })} warn={error.includes("Type")} end={end} />
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="leg-error">{error}</p>}
      <button type="button" className="btn-solid h-12 justify-center" onClick={save} data-testid="leg-save-btn">Save Leg {n + 1}</button>
      {onDelete && (
        <button type="button" className="btn-ghost h-11 justify-center gap-1.5 !border-[var(--red)] !text-[var(--red)]" onClick={onDelete} data-testid="leg-delete-btn">
          <Trash2 className="h-4 w-4" /> Delete Leg {n + 1}
        </button>
      )}
    </div>
  );
};

// Before a Transit point: how its passing is logged; "Arriving at Destination" opens that list.
const openArriving = () => window.dispatchEvent(new CustomEvent("mbp:open-list", { detail: "arrivingDest" }));
const TransitHint = ({ leg, next }) => (
  <li className="list-none rounded-md bg-yellow-200 px-3 py-2 text-xs font-bold text-[var(--navy)]" data-testid={`transit-hint-leg-${leg}`}>
    After Leg {leg} depart, log transit passing on &quot;<button type="button" onClick={openArriving} className="font-extrabold underline underline-offset-2" data-testid={`transit-hint-leg-${leg}-link`}>Arriving at Destination</button>&quot;, an auto depart to Leg {leg + 1} ({next?.route_start || `Point ${leg + 1}`} to {next?.route_dest || `Point ${leg + 2}`}) will be created.
  </li>
);

const LegRow = ({ leg, n, end, onEdit, onType }) => (
  <li className="flex items-center gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] py-2 pl-3 pr-1 text-sm" data-testid={`planned-leg-${n}`}>
    <div className="min-w-0 flex-1">
      <p className="break-words font-bold">Leg {n + 2}: {[leg.route_start, leg.route_dest].filter(Boolean).join(" to ")}</p>
      <p className="text-xs text-[var(--muted)]">{dmyt(leg.depart_at) || "Departure not set"} - {dmyt(leg.finish_at)} · {arriveType(leg.arrive_type)?.label}</p>
    </div>
    <ArriveQuickPick value={leg.arrive_type} onChange={onType} legLabel={`Leg ${n + 2}`} testId={`planned-leg-type-${n}`} end={end} />
    <button type="button" className="icon-btn" aria-label={`Edit leg ${n + 2}`} onClick={onEdit} data-testid={`planned-leg-edit-${n}`}><Pencil className="h-[18px] w-[18px]" /></button>
  </li>
);

// Route Planning: the Route Plan is Leg 1; further planned legs follow it in order.
// onDraft(point, add): a Draft Plan exists, so deleting a leg opens its map at that point, and adding one opens it ready to drop the new stop.
// onLegs(all): replaces every leg, Leg 1 (the Route Plan) included.
export const PlannedLegs = ({ start, dest, weather = {}, name, onChange, onDraft, onLegs }) => {
  const legs = weather.legs || [];
  const [edit, setEdit] = useState(null);
  const [legDirty, setLegDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [placing, setPlacing] = useState(false);
  const first = firstLeg(start, dest, weather);
  const all = [first, ...legs];
  const points = [start, dest, ...legs.map((l) => l.route_dest)];
  // The new stop goes after point `at` (-1: a new START): a leg from that point, typed in by hand when there's no Draft Plan.
  const pick = (at) => {
    setPlacing(false);
    if (onDraft) { onDraft(null, at); return; }
    const leg = at < 0 ? { id: Date.now(), route_start: "", route_dest: start, depart_at: first.depart_at || "", finish_at: "", arrive_type: "" }
      : { id: Date.now(), route_start: points[at] || "", route_dest: "", depart_at: (at === 0 ? first.depart_at : all[at - 1].finish_at) || "", finish_at: "", arrive_type: "" };
    setEdit({ insert: at, leg });
  };
  // Slotted in at point `at`: the leg that left that point now leaves the new stop, once this leg finishes.
  const insert = (leg, at) => {
    if (at < 0) return [{ ...leg, id: "plan", start_pos: null, dest_pos: first.start_pos || null, path: null }, { ...first, id: Date.now() + 1, depart_at: leg.finish_at }, ...legs];
    const next = all[at];
    const moved = next && { ...next, id: at === 0 ? Date.now() + 1 : next.id, route_start: leg.route_dest, depart_at: leg.finish_at, start_pos: null, path: null };
    const added = at === 0 ? { ...leg, id: "plan", start_pos: first.start_pos || null, dest_pos: null, path: null } : { ...leg, dest_pos: null, path: null };
    return [...all.slice(0, at), added, ...(moved ? [moved] : []), ...all.slice(at + 1)];
  };
  // An edited leg's DESTINATION and finish carry on to the next leg's START and departure, where they still matched.
  const save = (leg) => {
    if (edit.insert !== undefined) {
      onLegs(insert(leg, edit.insert));
      setEdit(null);
      setLegDirty(false);
      if (leg.arrive_type === "dock") setConfirm(true);
      return;
    }
    const old = legs[edit.at];
    const follow = (x) => (!old ? x : { ...x, ...(x.route_start === old.route_dest ? { route_start: leg.route_dest } : {}), ...(x.depart_at === old.finish_at ? { depart_at: leg.finish_at } : {}) });
    onChange({ legs: old ? legs.map((x, n) => (n === edit.at ? leg : n === edit.at + 1 ? follow(x) : x)) : [...legs, leg] });
    setEdit(null);
    setLegDirty(false);
    if (leg.arrive_type === "dock") setConfirm(true);
  };
  const setType = (n, t) => {
    onChange({ legs: legs.map((l, k) => (k === n ? { ...l, arrive_type: t } : l)) });
    if (t === "dock") setConfirm(true);
  };
  const remove = (n) => {
    if (onDraft) { onDraft(n + 2); return; }
    // Deleting a return trip's Leg 2 unticks Return trip.
    const back = legs.length === 1 && (legs[0].route_dest || "").trim().toLowerCase() === start.toLowerCase();
    onChange({ legs: legs.filter((_, k) => k !== n).map((l, k) => (k === n ? { ...l, path: null } : l)), ...(back ? { return_trip: false } : {}) });
    toast(`Leg ${n + 2} deleted`, { duration: 6000, action: { label: "Undo", onClick: () => onChange({ legs }) } });
  };
  return (
    <div className="flex flex-col gap-2" data-testid="planned-legs">
      <span className="field-label">Legs of the trip</span>
      <p className="text-xs text-[var(--muted)]">Leg 1 is the START and DESTINATION above. Add each further leg in order, ending with one Returning to Dock.</p>
      {onDraft && <p className="text-xs font-semibold text-amber-800" data-testid="planned-legs-draft-hint">Adding a leg, or Delete Leg in a leg's edit window, opens the Draft Plan map.</p>}
      {legs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {first.arrive_type === "transit" && <TransitHint leg={1} next={legs[0]} />}
          {legs.map((l, n) => [
            <LegRow key={l.id ?? n} leg={l} n={n} end={n === legs.length - 1} onEdit={() => setEdit({ at: n, leg: l })} onType={(t) => setType(n, t)} />,
            l.arrive_type === "transit" && n < legs.length - 1 && <TransitHint key={`hint-${l.id ?? n}`} leg={n + 2} next={legs[n + 1]} />,
          ])}
        </ul>
      )}
      <button type="button" className="btn-ghost h-11 justify-center gap-1.5" onClick={() => setPlacing(true)} data-testid="add-leg-btn"><Plus className="h-4 w-4" /> Add Leg...</button>
      <AddLegPosition open={placing} points={points} onPick={pick} onClose={() => setPlacing(false)} />
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) { setEdit(null); setLegDirty(false); } }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg" data-testid="leg-dialog" onOpenAutoFocus={(e) => e.preventDefault()} dirty={legDirty}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-extrabold">{edit?.insert !== undefined ? `Add Leg ${Math.max(edit.insert, 0) + 1}` : `Edit Leg ${(edit?.at ?? 0) + 2}`}</DialogTitle>
            <DialogDescription>Plan this leg of the trip. Pick Returning to Dock for the last leg.</DialogDescription>
          </DialogHeader>
          {edit && <LegForm onDirty={setLegDirty} leg={edit.leg} n={edit.insert !== undefined ? Math.max(edit.insert, 0) : edit.at + 1} onSave={save}
            end={edit.insert !== undefined ? edit.insert === points.length - 1 : edit.at === legs.length - 1}
            onDelete={edit.insert === undefined ? () => { const n = edit.at; setEdit(null); setLegDirty(false); remove(n); } : null} />}
        </DialogContent>
      </Dialog>
      <TripConfirm open={confirm} legs={[first, ...legs]} name={name} onClose={() => setConfirm(false)} />
    </div>
  );
};
