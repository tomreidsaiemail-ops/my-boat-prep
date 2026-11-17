import { useRef, useState } from "react";
import { Loader2, Pencil, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { Confirm, PointPanel, ReplaceWarning } from "@/components/boat/navigator/QuickPlanPanels";
import { stopsOf } from "@/lib/tripStops";
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
const newLeg = (n, start = "") => ({ id: n === 1 ? "plan" : Date.now() + n, route_start: start, route_dest: "", depart_at: at(n, "06"), finish_at: at(n, "09"), arrive_type: "", start_pos: null, dest_pos: null, path: null });
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
  return [...ls.slice(0, j), { ...old, route_dest: "", dest_pos: null, path: null, arrive_type: "" },
    { id: Date.now(), route_start: "", route_dest: old.route_dest, dest_pos: old.dest_pos, arrive_type: old.arrive_type, depart_at: old.finish_at, finish_at: later(old.finish_at, 3), path: null }, ...ls.slice(j + 1)];
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
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(0);
  const [times, setTimes] = useState({ depart_at: "", finish_at: "" });
  const latest = useRef(legs);
  latest.current = legs;
  const snap = useRef(null); // the legs before a stop was slotted in, for Stop adding

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
      if (data.path === null || data.land) toast.error(`${data.path === null ? "Couldn't find a way round the land" : "Part of the way round the land still touches it"} for leg ${k + 1}. Drag the red part out over the water.`);
      put(latest.current.map((l, n) => (n === k ? { ...l, path: data.path || [] } : l)));
    } catch {
      toast.error("Couldn't plan round the land just now. Drag any red part out over the water.");
    }
  };
  const rerouting = async (ks) => { setBusy(true); for (const k of ks) await route(k); setBusy(false); };
  const onPlace = (i, pos) => {
    put(setPos(latest.current, i, pos));
    if (!pos) return;
    if (i === wait) {
      if (pending === i) return;
      const ls = latest.current;
      setPending(i);
      setName("");
      setTimes(i < ls.length ? { depart_at: ls[i].depart_at, finish_at: ls[i].finish_at } : { depart_at: at(i + 1, "06"), finish_at: at(i + 1, "09") });
      api.get("/place-name", { params: { lat: pos.lat, lon: pos.lon } }).then(({ data }) => setName((n) => n || data.name || `Point ${i + 1}`)).catch(() => setName((n) => n || `Point ${i + 1}`));
    } else {
      if (i > 0) route(i - 1);
      if (i < latest.current.length && posOf(latest.current, i + 1)) route(i);
    }
  };
  const confirm = async (end) => {
    const i = pending;
    const clean = name.trim();
    const mid = i > 0 && i < latest.current.length;
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
  const removePoint = async (j) => {
    const ls = latest.current;
    put(withoutPoint(ls, j));
    setSel(null);
    if (ls.length === 1) setWait(1);
    else if (j > 0 && j < ls.length) await rerouting([j - 1]);
  };
  const startNew = () => { put([newLeg(1)]); snap.current = null; setFresh(true); setWait(0); setSel(null); setPending(null); setSure(0); };
  const finish = () => {
    onApply(latest.current.map((l) => ({ ...l, route_start: (l.route_start || "").trim(), route_dest: (l.route_dest || "").trim() })), fresh);
    onClose();
  };

  const stops = stopsOf(legs);
  const placed = stops.filter((s, k) => s.pos && k !== wait).length;
  const idle = wait === null && pending === null;
  const hint = pending !== null ? "Check the name and times, then confirm this point." : wait === 0 ? "Tap where you'll depart from." : wait !== null ? "Tap the chart for the new stop."
    : sel !== null ? "Change this point, delete it, or add a stop after it." : fresh ? "Trip laid out. Drag any pin or line to improve it, then tap Done."
      : "Tap a pin to rename it, change its times, delete it or add a stop after it. Drag pins or lines to improve the route, then tap Done.";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[96vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-3 sm:p-5" data-testid="quick-plan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          onPath={(k, pts) => put(latest.current.map((l, n) => (n === k ? { ...l, path: pts } : l)))} onRedraw={() => {}} />}
        {pending !== null && <Confirm i={pending} mid={pending > 0 && pending < legs.length} onDelete={() => { put(setPos(latest.current, pending, null)); setPending(null); setName(""); }} name={name} setName={setName} leg={times} setTimes={(p) => setTimes((t) => ({ ...t, ...p }))} onConfirm={confirm} busy={busy} />}
        {idle && sel !== null && sel < stops.length && (
          <PointPanel j={sel} last={legs.length} name={nameOf(legs, sel) || ""} setName={(v) => put(renamed(latest.current, sel, v))} leg={sel < legs.length ? legs[sel] : null}
            setTimes={(p) => put(latest.current.map((l, n) => (n === sel ? { ...l, ...p } : l)))} onDelete={() => removePoint(sel)} onAddAfter={() => addAfter(sel)} onClose={() => setSel(null)} busy={busy} />
        )}
      </DialogContent>
    </Dialog>
  );
};
