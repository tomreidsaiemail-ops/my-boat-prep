import { useRef, useState } from "react";
import { toast } from "sonner";
import { Map as MapIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dmyt } from "@/lib/allDone";
import { When } from "@/components/boat/navigator/NavigatorExtras";
import { ArriveType, arriveType } from "@/components/boat/navigator/ArriveType";
import { TripConfirm } from "@/components/boat/navigator/TripConfirm";

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

const problem = (l) => {
  if (!l.route_dest.trim()) return "Add the DESTINATION for this leg.";
  if ((l.finish_at || "").length < 16) return "Enter the Estimated Finish date and time.";
  if (l.depart_at && l.finish_at < l.depart_at) return "The Estimated Finish is before the Departure. Check the times.";
  if (!l.arrive_type) return "Pick the Arriving at Destination Type.";
  return "";
};

const LegForm = ({ leg, n, onSave }) => {
  const [l, setL] = useState(leg);
  const [error, setError] = useState("");
  const set = (patch) => { setL((x) => ({ ...x, ...patch })); setError(""); };
  const save = () => { const why = problem(l); setError(why); if (!why) onSave({ ...l, route_start: l.route_start.trim(), route_dest: l.route_dest.trim() }); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Field id="leg-start" label="START" value={l.route_start} onChange={(v) => set({ route_start: v })} placeholder="e.g. Picton" />
        <Field id="leg-dest" label="DESTINATION" value={l.route_dest} onChange={(v) => set({ route_dest: v })} placeholder="e.g. Ship Cove" />
      </div>
      <When id="leg-depart-at" label="Departure date and time" value={l.depart_at} onChange={(v) => set({ depart_at: v })} />
      <NowButton label="Set Now - 15 Minutes" testId="leg-depart-now-btn" onClick={() => { set({ depart_at: nowPlus(-15) }); focusTime("leg-depart-at"); }} />
      <When id="leg-finish-at" label="Estimated Finish date and time" value={l.finish_at} onChange={(v) => set({ finish_at: v })} warn={error.includes("Finish") ? error : ""} />
      <NowButton label="Set Now + 2 hours" testId="leg-finish-now-btn" onClick={() => { set({ finish_at: nowPlus(120) }); focusTime("leg-finish-at"); }} />
      <ArriveType id="leg-arrive-type" value={l.arrive_type} onChange={(v) => set({ arrive_type: v })} warn={error.includes("Type")} />
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="leg-error">{error}</p>}
      <button type="button" className="btn-solid h-12 justify-center" onClick={save} data-testid="leg-save-btn">Save Leg {n + 1}</button>
    </div>
  );
};

const LegRow = ({ leg, n, onEdit, onDelete }) => (
  <li className="flex items-center gap-2 rounded-md border-l-4 border-[var(--navy)] bg-[var(--panel)] py-2 pl-3 pr-1 text-sm" data-testid={`planned-leg-${n}`}>
    <div className="min-w-0 flex-1">
      <p className="break-words font-bold">Leg {n + 2}: {[leg.route_start, leg.route_dest].filter(Boolean).join(" to ")}</p>
      <p className="text-xs text-[var(--muted)]">{dmyt(leg.depart_at) || "Departure not set"} - {dmyt(leg.finish_at)} · {arriveType(leg.arrive_type)?.label}</p>
    </div>
    <button type="button" className="icon-btn" aria-label={`Edit leg ${n + 2}`} onClick={onEdit} data-testid={`planned-leg-edit-${n}`}><Pencil className="h-[18px] w-[18px]" /></button>
    <button type="button" className="icon-btn hover:text-[var(--red)]" aria-label={`Delete leg ${n + 2}`} onClick={onDelete} data-testid={`planned-leg-delete-${n}`}><Trash2 className="h-[18px] w-[18px]" /></button>
  </li>
);

// Route Planning: the Route Plan is Leg 1; further planned legs follow it in order.
// onDraft(point): a Trip Plan Draft exists, so adding or deleting a leg opens its map at that point.
export const PlannedLegs = ({ start, dest, weather = {}, name, onChange, onDraft }) => {
  const legs = weather.legs || [];
  // Routes drawn over water can land before the next render, so each builds on the latest legs.
  const latest = useRef(legs);
  latest.current = legs;
  const putLegs = (patch, next) => { latest.current = next; onChange({ ...patch, legs: next }); };
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [view, setView] = useState(false);
  // Stop 1 is the Route Plan START, stop 2 its DESTINATION, then each planned leg's DESTINATION. Leg 1's line is weather.path.
  const clearPaths = (ls, patch, ks) => ks.reduce((acc, k) => (k < 0 || k > legs.length ? acc : k === 0 ? { ...acc, patch: { ...acc.patch, path: null } }
    : { ...acc, ls: acc.ls.map((l, n) => (n === k - 1 ? { ...l, path: null } : l)) }), { ls, patch });
  const place = (i, pos) => {
    const ls = i > 1 ? latest.current.map((l, n) => (n === i - 2 ? { ...l, dest_pos: pos } : l)) : latest.current;
    // The skipper's waypoints stay put when a pin moves (a cleared pin also clears its legs' waypoints).
    const out = clearPaths(ls, i === 0 ? { start_pos: pos } : i === 1 ? { dest_pos: pos } : {}, pos ? [] : [i - 1, i]);
    if (out.ls !== latest.current) putLegs(out.patch, out.ls); else onChange(out.patch);
  };
  const setPath = (k, pts) => (k === 0 ? onChange({ path: pts }) : putLegs({}, latest.current.map((l, n) => (n === k - 1 ? { ...l, path: pts } : l))));
  const redraw = () => onChange({ path: null, legs: legs.map((l) => ({ ...l, path: null })) });
  const first = { id: "plan", route_start: start, route_dest: dest, depart_at: weather.depart_at || "", finish_at: weather.finish_at || "", arrive_type: weather.arrive_type || "", start_pos: weather.start_pos, dest_pos: weather.dest_pos, path: weather.path };
  const last = legs[legs.length - 1] || first;
  const add = () => (onDraft ? onDraft(legs.length + 1) : setEdit({ at: legs.length, leg: { id: Date.now(), route_start: last.route_dest || "", route_dest: "", depart_at: last.finish_at || "", finish_at: "", arrive_type: "" } }));
  // An edited leg's DESTINATION and finish carry on to the next leg's START and departure, where they still matched.
  const save = (leg) => {
    const old = legs[edit.at];
    const follow = (x) => (!old ? x : { ...x, ...(x.route_start === old.route_dest ? { route_start: leg.route_dest } : {}), ...(x.depart_at === old.finish_at ? { depart_at: leg.finish_at } : {}) });
    onChange({ legs: old ? legs.map((x, n) => (n === edit.at ? leg : n === edit.at + 1 ? follow(x) : x)) : [...legs, leg] });
    setEdit(null);
    if (leg.arrive_type === "dock") setConfirm(true);
  };
  const remove = (n) => {
    if (onDraft) { onDraft(n + 2); return; }
    onChange({ legs: legs.filter((_, k) => k !== n).map((l, k) => (k === n ? { ...l, path: null } : l)) });
    toast(`Leg ${n + 2} deleted`, { duration: 6000, action: { label: "Undo", onClick: () => onChange({ legs }) } });
  };
  return (
    <div className="flex flex-col gap-2" data-testid="planned-legs">
      <span className="field-label">Legs of the trip</span>
      <p className="text-xs text-[var(--muted)]">Leg 1 is the START and DESTINATION above. Add each further leg in order, ending with one Returning to Dock.</p>
      {onDraft && <p className="text-xs font-semibold text-amber-800" data-testid="planned-legs-draft-hint">Adding or deleting a leg opens the Trip Plan Draft map.</p>}
      {legs.length > 0 && <ul className="flex flex-col gap-1.5">{legs.map((l, n) => <LegRow key={l.id ?? n} leg={l} n={n} onEdit={() => setEdit({ at: n, leg: l })} onDelete={() => remove(n)} />)}</ul>}
      <button type="button" className="btn-ghost h-11 justify-center gap-1.5" onClick={add} data-testid="add-leg-btn"><Plus className="h-4 w-4" /> Add Leg...</button>
      <button type="button" className="btn-ghost h-11 justify-center gap-1.5" onClick={() => setView(true)} data-testid="view-planned-route-btn"><MapIcon className="h-4 w-4" /> View planned route...</button>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg" data-testid="leg-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-extrabold">{edit && edit.at < legs.length ? "Edit" : "Add"} Leg {(edit?.at ?? 0) + 2}</DialogTitle>
            <DialogDescription>Plan this leg of the trip. Pick Returning to Dock for the last leg.</DialogDescription>
          </DialogHeader>
          {edit && <LegForm leg={edit.leg} n={edit.at + 1} onSave={save} />}
        </DialogContent>
      </Dialog>
      <TripConfirm open={confirm} legs={[first, ...legs]} name={name} onClose={() => setConfirm(false)} />
      {view && <TripConfirm open legs={[first, ...legs]} name={name} onClose={() => setView(false)} onPlace={place} onPath={setPath} onRedraw={redraw} />}
    </div>
  );
};
