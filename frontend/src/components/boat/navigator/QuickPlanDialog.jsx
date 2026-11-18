import { useRef, useState } from "react";
import { Loader2, Pencil, RotateCcw, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { ConfirmPopup, PointPopup, ReplaceWarning } from "@/components/boat/navigator/QuickPlanPanels";
import { legMiles, milesText, stopsOf } from "@/lib/tripStops";
import { api } from "@/lib/api";

export const QUICK_NAME = "Quick Trip Plan Draft";
export const EDIT_NAME = "Edit Trip Plan Draft";
const pad = (n) => String(n).padStart(2, "0");
// Leg n (1 = first) leaves at 06:00 and finishes at 09:00, n days from today.
const at = (days, hh) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hh}:00`;
};
// A "YYYY-MM-DDTHH:MM" time h hours later.
const later = (s, h) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  d.setHours(d.getHours() + h);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const newLeg = (n, start = "") => ({ id: n === 1 ? "plan" : Date.now() + n, route_start: start, route_dest: "", depart_at: at(n, "06"), finish_at: at(n, "09"), arrive_type: "mooring", start_pos: null, dest_pos: null, path: null });
const posOf = (legs, i) => (i === 0 ? legs[0].start_pos : legs[i - 1].dest_pos);
const nameOf = (legs, i) => (i === 0 ? legs[0].route_start : legs[i - 1].route_dest);
const ll = (p) => [p.lat, p.lon];

// Point j is leg j's START and leg j-1's DESTINATION.
const renamed = (ls, j, v) => ls.map((l, n) => (n === j ? { ...l, route_start: v } : n === j - 1 ? { ...l, route_dest: v } : l));
// Removing point j joins the legs either side of it (or leaves one point waiting for its next stop).
const withoutPoint = (ls, j) => {
  if (ls.length === 1) return [j === 0 ? { ...ls[0], route_start: ls[0].route_dest, start_pos: ls[0].dest_pos, route_dest: "", dest_pos: null, path: null } : { ...ls[0], route_dest: "", dest_pos: null, path: null }];
  if (j === 0) return [{ ...ls[1], id: "plan", start_pos: ls[0].dest_pos, route_start: ls[0].route_dest }, ...ls.slice(2)];
  if (j === ls.length) return ls.slice(0, -1);
  return ls.map((l, n) => (n === j - 1 ? { ...l, route_dest: ls[j].route_dest, dest_pos: ls[j].dest_pos, arrive_type: ls[j].arrive_type, finish_at: ls[j].finish_at, path: null } : l)).filter((_, n) => n !== j);
};
// A new point after point j: on the end, or slotted into leg j (which then ends at the new point).
const withSlot = (ls, j) => {
  if (j === ls.length) return [...ls, newLeg(j + 1, nameOf(ls, j))];
  const old = ls[j];
  return [...ls.slice(0, j), { ...old, route_dest: "", dest_pos: null, path: null, arrive_type: "mooring" },
    { id: Date.now(), route_start: "", route_dest: old.route_dest, dest_pos: old.dest_pos, arrive_type: old.arrive_type, depart_at: old.finish_at, finish_at: later(old.finish_at, 3), path: null }, ...ls.slice(j + 1)];
};
// The trip ends where it started: the same name, or pins within about 300 m.
const backHome = (ls) => {
  const [a, b] = [ls[0], ls[ls.length - 1]];
  const same = a.route_start && a.route_start.toLowerCase() === (b.route_dest || "").toLowerCase();
  const p = a.start_pos;
  const q = b.dest_pos;
  const near = p && q && Math.hypot((q.lat - p.lat) * 111320, (q.lon - p.lon) * 111320 * Math.cos((p.lat * Math.PI) / 180)) < 300;
  return !!(same || near);
};

// Each drawn leg's distance (along its bends) and the trip total, under the map.
const TripMiles = ({ legs }) => {
  const miles = legMiles(legs);
  const rows = legs.map((l, n) => ({ n, l, nm: miles[n] })).filter((r) => r.nm != null);
  if (!rows.length) return null;
  const total = rows.reduce((t, r) => t + r.nm, 0);
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm" data-testid="quick-plan-miles">
      <ul className="flex flex-col gap-1">
        {rows.map(({ n, l, nm }) => (
          <li key={l.id ?? n} className="flex items-baseline gap-2" data-testid={`quick-plan-miles-leg-${n}`}>
            <span className="min-w-0 flex-1 break-words"><b>Leg {n + 1}</b> · {l.route_start || "Start"} to {l.route_dest || "next stop"}</span>
            <span className="shrink-0 font-bold tabular-nums">{milesText(nm)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-[var(--line)] pt-1.5 font-extrabold" data-testid="quick-plan-miles-total">
        <span>Trip total</span><span className="tabular-nums">{milesText(total)}</span>
      </p>
    </div>
  );
};

// Tap the departure point and each stop on a chart, confirm each, and the legs fill in Route Planning.
// draft: the Route Planning legs of an existing Trip Plan Draft, opened for editing (select: the point to show first).
export const QuickPlanDialog = ({ open, onClose, onApply, draft = null, select = null }) => {
  const [fresh, setFresh] = useState(!draft);
  const [legs, setLegs] = useState(() => draft || [newLeg(1)]);
  const [wait, setWait] = useState(draft ? null : 0); // the point a tap on the chart drops
  const [pending, setPending] = useState(null);
  const [sel, setSel] = useState(draft ? select : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(0); // legs being routed round land
  const [sure, setSure] = useState(0);
  const [times, setTimes] = useState({ depart_at: "", finish_at: "" });
  const latest = useRef(legs);
  latest.current = legs;
  const snap = useRef(null); // the legs before a stop was slotted in, for Stop adding
  const asking = useRef(null); // the tapped spot whose place name is being looked up
  const [undo, setUndo] = useState([]); // how things were before each confirmed point, newest last
  const known = useRef(new Set((draft || []).map((l) => l.id))); // legs already in Route Planning keep their arriving type

  const initial = useRef(null);
  if (initial.current === null) initial.current = JSON.stringify(legs);
  const put = (next) => { latest.current = next; setLegs(next); };
  const setPos = (ls, i, pos) => ls.map((l, n) => (i === 0 && n === 0 ? { ...l, start_pos: pos, path: null } : n === i - 1 ? { ...l, dest_pos: pos, path: null } : n === i ? { ...l, path: null } : l));
  // Leg k joins point k and k+1: route it round any land.
  const route = async (k) => {
    const ls = latest.current;
    const a = posOf(ls, k);
    const b = posOf(ls, k + 1);
    if (!a || !b) return;
    try {
      const { data } = await api.post("/sea-route", { line: [ll(a), ll(b)] }, { timeout: 60000 });
      if (posOf(latest.current, k) !== a || posOf(latest.current, k + 1) !== b) return; // moved, undone or deleted meanwhile
      if (data.path === null || data.land) toast.error(`${data.path === null ? "Couldn't find a way round the land" : "Part of the way round the land still touches it"} for leg ${k + 1}. Drag the red part out over the water.`);
      put(latest.current.map((l, n) => (n === k ? { ...l, path: data.path || [] } : l)));
    } catch {
      toast.error("Couldn't plan round the land just now. Drag any red part out over the water.");
    }
  };
  const rerouting = async (ks) => { setBusy((b) => b + 1); for (const k of ks) await route(k); setBusy((b) => b - 1); };
  const onPlace = (i, pos) => {
    put(setPos(latest.current, i, pos));
    if (!pos) return;
    if (i === wait) {
      if (pending === i) return;
      const ls = latest.current;
      setPending(i);
      setName("");
      setTimes(i < ls.length ? { depart_at: ls[i].depart_at, finish_at: ls[i].finish_at } : { depart_at: at(i + 1, "06"), finish_at: at(i + 1, "09") });
      asking.current = pos;
      // A point confirmed before its name arrived is called "Point n" until the name comes in.
      api.get("/place-name", { params: { lat: pos.lat, lon: pos.lon } }).then(({ data }) => {
        if (!data.name) return;
        if (asking.current === pos) setName((n) => n || data.name);
        const ls2 = latest.current;
        const k = stopsOf(ls2).findIndex((s) => s.pos === pos);
        if (k >= 0 && nameOf(ls2, k) === `Point ${i + 1}`) put(renamed(ls2, k, data.name));
      }).catch(() => {});
    } else {
      if (i > 0) route(i - 1);
      if (i < latest.current.length && posOf(latest.current, i + 1)) route(i);
    }
  };
  const confirm = async (end) => {
    const i = pending;
    const clean = name.trim() || `Point ${i + 1}`;
    asking.current = null;
    const mid = i > 0 && i < latest.current.length;
    const before = mid ? { legs: snap.current, wait: null } : { legs: setPos(latest.current, i, null), wait: i };
    setUndo((u) => [...u, before]);
    let ls = latest.current.map((l, n) => (n === i ? { ...l, route_start: clean, ...times } : n === i - 1 ? { ...l, route_dest: clean } : l));
    if (!mid && i > 0 && !end) ls = [...ls, { ...newLeg(i + 1, clean), ...times }];
    put(ls);
    setPending(null);
    setWait(i === 0 ? 1 : !mid && !end ? i + 1 : null);
    snap.current = null;
    if (i > 0) await rerouting(mid ? [i - 1, i] : [i - 1]);
  };
  const addAfter = (j) => { snap.current = j < latest.current.length ? latest.current : null; put(withSlot(latest.current, j)); setSel(null); setWait(j + 1); };
  const stopAdding = () => { put(snap.current || latest.current.slice(0, -1)); snap.current = null; setWait(null); };
  // The skipper's own pick is kept, even Mooring on a leg that comes back to the start.
  const setType = (j, t) => { known.current.add(latest.current[j - 1].id); put(latest.current.map((l, n) => (n === j - 1 ? { ...l, arrive_type: t } : l))); };
  const removePoint = async (j) => {
    const ls = latest.current;
    put(withoutPoint(ls, j));
    setSel(null);
    if (ls.length === 1) setWait(1);
    else if (j > 0 && j < ls.length) await rerouting([j - 1]);
  };
  // Takes back the newest confirmed point: the map waits for that tap again (a slotted-in stop just goes).
  const undoLast = () => {
    const b = undo[undo.length - 1];
    put(b.legs); setWait(b.wait); setPending(null); setSel(null); setName(""); snap.current = null; asking.current = null;
    setUndo((u) => u.slice(0, -1));
  };
  const startNew = () => { put([newLeg(1)]); setUndo([]); known.current = new Set(); snap.current = null; setFresh(true); setWait(0); setSel(null); setPending(null); setSure(0); };
  const finish = () => {
    const ls = latest.current.map((l) => ({ ...l, route_start: (l.route_start || "").trim(), route_dest: (l.route_dest || "").trim() }));
    const end = ls[ls.length - 1];
    // A new last leg that comes back to the start is Returning to Dock rather than the Mooring default.
    if (end.arrive_type === "mooring" && !known.current.has(end.id) && backHome(ls)) ls[ls.length - 1] = { ...end, arrive_type: "dock" };
    onApply(ls, fresh);
    onClose();
  };

  const stops = stopsOf(legs);
  const placed = stops.filter((s, k) => s.pos && k !== wait).length;
  const idle = wait === null && pending === null;
  const hint = pending !== null ? "Confirm the point in the popup, or ignore the tap." : wait === 0 ? "Tap where you'll depart from." : wait !== null ? "Tap the chart for the new stop."
    : sel !== null ? "Change this point in its popup, delete it, or add a stop after it." : fresh ? "Trip laid out. Drag any pin or line to improve it, then tap Done."
      : "Tap a pin to rename it, pick how you arrive, delete it or add a stop after it. Drag pins or lines to improve the route, then tap Done.";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[96vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-3 sm:p-5" data-testid="quick-plan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}
        dirty={pending !== null || JSON.stringify(legs) !== initial.current}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold" data-testid="quick-plan-title">
            {fresh ? <Zap className="h-5 w-5 text-amber-500" /> : <Pencil className="h-5 w-5 text-amber-500" />} {fresh ? QUICK_NAME : EDIT_NAME}
          </DialogTitle>
          <DialogDescription data-testid="quick-plan-hint">{hint}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="quick-plan-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-[2] justify-center gap-1.5" disabled={!idle || busy || placed < 2} onClick={finish} data-testid="quick-plan-done-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : fresh ? <Zap className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {fresh ? "Done Quick Route Plan Draft" : "Done, update Route Planning"}
          </button>
        </div>
        {!fresh && idle && !sure && (
          <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm !border-[var(--red)] !text-[var(--red)]" onClick={() => setSure(1)} data-testid="quick-plan-start-new-btn">
            <RotateCcw className="h-4 w-4" /> Start New Draft
          </button>
        )}
        {sure > 0 && <ReplaceWarning step={sure} testId="quick-plan-start-new" onYes={() => (sure === 1 ? setSure(2) : startNew())} onNo={() => setSure(0)} />}
        {wait !== null && pending === null && placed >= 2 && (
          <button type="button" className="btn-ghost h-10 justify-center text-sm" onClick={stopAdding} data-testid="quick-plan-stop-adding-btn">Stop adding stops</button>
        )}
        {open && <StopsMap quick paused={pending !== null || wait === null} mark={sel} onPinTap={(i) => idle && setSel((s) => (s === i ? null : i))} legs={legs} onPlace={onPlace}
          onPath={(k, pts) => put(latest.current.map((l, n) => (n === k ? { ...l, path: pts } : l)))} onRedraw={() => {}}
          overlay={undo.length > 0 && pending === null && (
            <button type="button" onClick={undoLast} className="absolute right-2 top-2 z-[1050] flex h-10 items-center gap-1.5 rounded-full border-2 border-[var(--navy)] bg-white px-3 text-sm font-bold text-[var(--navy)] shadow-md [transition:background-color_.15s] active:bg-slate-100" data-testid="quick-plan-undo-btn">
              <Undo2 className="h-4 w-4" /> Undo last point
            </button>
          )}
          popup={pending !== null && posOf(legs, pending) ? { pos: posOf(legs, pending), node: (
            <ConfirmPopup i={pending} mid={pending > 0 && pending < legs.length} name={name} onConfirm={confirm}
              onIgnore={() => { asking.current = null; put(setPos(latest.current, pending, null)); setPending(null); setName(""); }} />
          ) } : idle && sel !== null && posOf(legs, sel) ? { pos: posOf(legs, sel), node: (
            <PointPopup j={sel} last={legs.length} name={nameOf(legs, sel) || ""} setName={(v) => put(renamed(latest.current, sel, v))}
              type={sel > 0 ? legs[sel - 1].arrive_type : ""} setType={(t) => setType(sel, t)}
              onDelete={() => removePoint(sel)} onAddAfter={() => addAfter(sel)} onClose={() => setSel(null)} busy={busy > 0} />
          ) } : null} />}
        <TripMiles legs={legs} />
      </DialogContent>
    </Dialog>
  );
};
