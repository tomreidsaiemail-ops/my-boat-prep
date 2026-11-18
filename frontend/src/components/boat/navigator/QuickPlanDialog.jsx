import { useRef, useState } from "react";
import { Loader2, Pencil, RotateCcw, Undo2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { ConfirmPopup, PointPopup, ReplaceWarning } from "@/components/boat/navigator/QuickPlanPanels";
import { legMiles, milesText, returnsToStart, stopsOf } from "@/lib/tripStops";
import { api } from "@/lib/api";

export const QUICK_NAME = "Quick Draft Plan";
export const EDIT_NAME = "Edit Draft Plan";
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
const renamedOne = (ls, j, v) => ls.map((l, n) => (n === j ? { ...l, route_start: v } : n === j - 1 ? { ...l, route_dest: v } : l));
// A return trip's START and end point are the same place, so they're renamed together.
const renamed = (ls, j, v) => (returnsToStart(ls) && (j === 0 || j === ls.length) ? renamedOne(renamedOne(ls, 0, v), ls.length, v) : renamedOne(ls, j, v));
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
// A new START before point 1: the new first leg ends at the old START.
// The old first leg keeps its route over the water, and sets off once the new one is in (3 hours later).
const withFront = (ls) => [{ ...newLeg(1), route_dest: ls[0].route_start, dest_pos: ls[0].start_pos, depart_at: ls[0].depart_at, finish_at: later(ls[0].depart_at, 3) },
  { ...ls[0], id: Date.now(), depart_at: later(ls[0].depart_at, 3), finish_at: later(ls[0].finish_at, 3) }, ...ls.slice(1)];
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
// draft: the Route Planning legs of an existing Draft Plan, opened for editing (select: the point to show first;
// add: a new stop goes after that point, -1 for a new START, and the map waits for its tap).
// ret: a return trip, so the DESTINATION's tap also makes Leg 2 back to the START.
// seed: a typed-in return trip ({ legs: [Leg 1], back: its Leg 2 or null }); its names and times are kept, only the pins are tapped in.
export const QuickPlanDialog = ({ open, onClose, onApply, draft = null, select = null, add = null, ret = false, seed = null }) => {
  const adding = draft && add !== null;
  const [fresh, setFresh] = useState(!draft && !seed);
  const [legs, setLegs] = useState(() => (adding ? (add < 0 ? withFront(draft) : withSlot(draft, add)) : draft || seed?.legs || [newLeg(1)]));
  const [wait, setWait] = useState(adding ? add + 1 : draft ? null : 0); // the point a tap on the chart drops
  const [pending, setPending] = useState(null);
  const [sel, setSel] = useState(draft ? select : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(0); // legs being routed round land
  const [sure, setSure] = useState(0);
  const [times, setTimes] = useState({ depart_at: "", finish_at: "" });
  const latest = useRef(legs);
  latest.current = legs;
  const snap = useRef(adding && add < draft.length ? draft : null); // the legs before a stop was slotted in, for Stop adding
  const asking = useRef(null); // the tapped spot whose place name is being looked up
  const [undo, setUndo] = useState([]); // how things were before each confirmed point, newest last
  const known = useRef(new Set([...(draft || seed?.legs || []).map((l) => l.id), ...(adding && add < 0 ? [legs[1].id] : []), ...(seed?.back ? [seed.back.id] : [])])); // legs already in Route Planning keep their arriving type

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
      put(latest.current.map((l, n) => (n === k ? { ...l, path: data.path || [] } : l)));
    } catch {
      // No route over the water just now: the leg's miles are measured straight until it's re-routed.
    }
  };
  const rerouting = async (ks) => { setBusy((b) => b + 1); for (const k of ks) await route(k); setBusy((b) => b - 1); };
  const onPlace = (i, pos) => {
    // A return trip's end point stays on its START, whichever of the two is moved.
    const n = latest.current.length;
    const twin = pos && (i === 0 || i === n) && returnsToStart(latest.current) ? (i === 0 ? n : 0) : null;
    put(setPos(twin !== null ? setPos(latest.current, twin, pos) : latest.current, i, pos));
    if (twin !== null && i !== wait) route(twin === 0 ? 0 : n - 1);
    if (!pos) return;
    if (i === wait) {
      if (pending === i) return;
      const ls = latest.current;
      setPending(i);
      setName(seed ? nameOf(ls, i) || "" : "");
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
    const front = i === 0 && snap.current !== null; // a new START slotted in before the old one
    const home = ret && i === 1 && latest.current.length === 1; // return trip: Leg 2 back to the START comes with the DESTINATION
    const before = mid || front ? { legs: snap.current, wait: null } : { legs: setPos(latest.current, i, null), wait: i };
    setUndo((u) => [...u, before]);
    let ls = latest.current.map((l, n) => (n === i ? { ...l, route_start: clean, ...times } : n === i - 1 ? { ...l, route_dest: clean } : l));
    if (home) {
      const { start_pos, dest_pos, path, ...back } = seed?.back || {};
      const out = ls[0].finish_at ? { depart_at: ls[0].finish_at, finish_at: later(ls[0].finish_at, 3) } : {}; // a new Leg 2 sets off when Leg 1 arrives
      ls = [...ls, { ...newLeg(2, clean), ...out, ...back, route_start: clean, route_dest: ls[0].route_start, dest_pos: ls[0].start_pos, arrive_type: back.arrive_type || "dock" }];
    }
    else if (!mid && i > 0 && !end) ls = [...ls, { ...newLeg(i + 1, clean), ...times }];
    put(ls);
    setPending(null);
    setWait(front || home ? null : i === 0 ? 1 : !mid && !end ? i + 1 : null);
    snap.current = null;
    if (front) await rerouting([0]);
    else if (home) await rerouting([0, 1]);
    else if (i > 0) await rerouting(mid ? [i - 1, i] : [i - 1]);
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
  const homing = ret && legs.length === 1;
  const typed = wait !== null && wait < 2 ? nameOf(legs, wait) : "";
  const hint = pending !== null ? "Confirm the point in the popup, or ignore the tap." : wait === 0 ? (ret ? `Return trip: tap ${typed ? `START, ${typed}` : "where you'll depart from"} (green).` : "Tap where you'll depart from.")
    : wait === 1 && homing ? `Return trip: tap ${typed ? `DESTINATION, ${typed}` : "the DESTINATION"}. The trip then comes back to the start (red).` : wait !== null ? "Tap the chart for the new stop."
    : sel !== null ? "Change this point in its popup, delete it, or add a stop after it." : fresh ? "Trip laid out. Drag any pin to move it, then tap Done."
      : "Tap a pin to rename it, pick how you arrive, delete it or add a stop after it. Drag a pin to move it, then tap Done.";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[96vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-3 sm:p-5" data-testid="quick-plan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}
        dirty={pending !== null || JSON.stringify(legs) !== initial.current}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold" data-testid="quick-plan-title">
            {fresh ? <Zap className="h-5 w-5 text-amber-500" /> : <Pencil className="h-5 w-5 text-amber-500" />} {fresh || seed ? QUICK_NAME : EDIT_NAME}
          </DialogTitle>
          <DialogDescription data-testid="quick-plan-hint">{hint}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5">
          <button type="button" className="btn-ghost h-12 shrink-0 justify-center px-3 text-sm" onClick={onClose} data-testid="quick-plan-cancel-btn">Cancel</button>
          <button type="button" className="btn-ghost h-12 flex-1 justify-center gap-1 px-2 text-sm leading-tight" disabled={!undo.length || pending !== null} onClick={undoLast} data-testid="quick-plan-undo-btn">
            <Undo2 className="h-4 w-4 shrink-0" /> Undo Last Pin
          </button>
          <button type="button" className="btn-solid h-12 flex-[1.4] justify-center gap-1 px-2 text-sm leading-tight" disabled={!idle || busy || placed < 2} onClick={finish} data-testid="quick-plan-done-btn">
            {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : fresh ? <Zap className="h-4 w-4 shrink-0" /> : <Pencil className="h-4 w-4 shrink-0" />}
            {fresh ? `Done ${QUICK_NAME}` : "Done, update Route Planning"}
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
          popup={pending !== null && posOf(legs, pending) ? { pos: posOf(legs, pending), node: (
            <ConfirmPopup i={pending} mid={pending > 0 && pending < legs.length} home={homing && pending === 1} name={name} onConfirm={confirm}
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
