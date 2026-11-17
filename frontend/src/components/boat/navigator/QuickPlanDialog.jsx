import { useEffect, useRef, useState } from "react";
import { Check, Flag, Loader2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StopsMap } from "@/components/boat/navigator/StopsMap";
import { api } from "@/lib/api";

export const QUICK_NAME = "Quick Trip Plan Draft";
const pad = (n) => String(n).padStart(2, "0");
// Leg n (1 = first) leaves at 06:00 and finishes at 09:00, n days from today.
const at = (days, hh) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hh}:00`;
};
const newLeg = (n, start = "") => ({ id: n === 1 ? "plan" : Date.now() + n, route_start: start, route_dest: "", depart_at: at(n, "06"), finish_at: at(n, "09"), arrive_type: "", start_pos: null, dest_pos: null, path: null });
const posOf = (legs, i) => (i === 0 ? legs[0].start_pos : legs[i - 1].dest_pos);
const ll = (p) => [p.lat, p.lon];

const Confirm = ({ i, name, setName, leg, setTimes, onConfirm, onDelete, busy }) => (
  <div className="flex flex-col gap-2 rounded-md border-2 border-amber-500 bg-amber-50 p-3" data-testid="quick-plan-confirm">
    <div className="flex items-center justify-between gap-2">
      <label className="field-label" htmlFor="quick-plan-name">{i === 0 ? "Departing point" : `Point ${i + 1}`}</label>
      <button type="button" onClick={onDelete} className="inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-[var(--red)] bg-white px-2.5 text-xs font-bold text-[var(--red)] hover:bg-red-50" data-testid="quick-plan-delete-point-btn">
        <Trash2 className="h-3.5 w-3.5" /> Delete this point
      </button>
    </div>
    <input id="quick-plan-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Finding the place name..." data-testid="quick-plan-name-input" />
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs font-bold">Leg {i + 1} departure
        <input type="datetime-local" className="field-input mt-1 w-full" value={leg.depart_at} onChange={(e) => setTimes({ depart_at: e.target.value })} data-testid="quick-plan-depart-input" />
      </label>
      <label className="text-xs font-bold">Estimated finish
        <input type="datetime-local" className="field-input mt-1 w-full" value={leg.finish_at} onChange={(e) => setTimes({ finish_at: e.target.value })} data-testid="quick-plan-finish-input" />
      </label>
    </div>
    {i > 0 && <p className="text-xs text-[var(--muted)]">These times are for Leg {i + 1}. They aren't needed if this is the End of Trip point.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-solid h-11 flex-1 justify-center gap-1.5" disabled={busy || !name.trim()} onClick={() => onConfirm(false)} data-testid="quick-plan-confirm-btn">
        <Check className="h-4 w-4" /> {i === 0 ? "Departing point" : `Arriving (Leg ${i + 1} Departing point)`}
      </button>
      {i > 0 && (
        <button type="button" className="btn-ghost h-11 flex-1 justify-center gap-1.5 !border-emerald-700 !text-emerald-800" disabled={busy || !name.trim()} onClick={() => onConfirm(true)} data-testid="quick-plan-end-btn">
          <Flag className="h-4 w-4" /> Arriving (End of Trip point)
        </button>
      )}
    </div>
  </div>
);

// Tap the departure point and each stop on a chart, confirm each, and the legs fill in Route Planning.
// Legs that would cross land are routed over the water; the skipper can still drag them.
export const QuickPlanDialog = ({ open, onClose, onApply, hasRoute }) => {
  const [legs, setLegs] = useState(() => [newLeg(1)]);
  const [pending, setPending] = useState(null);
  const [name, setName] = useState("");
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(0);
  const [done, setDone] = useState(0); // points confirmed so far
  const [times, setTimes] = useState({ depart_at: "", finish_at: "" });
  const latest = useRef(legs);
  latest.current = legs;
  useEffect(() => { if (open) { setLegs([newLeg(1)]); setPending(null); setName(""); setEnded(false); setSure(0); setDone(0); } }, [open]);

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
  const onPlace = (i, pos) => {
    put(setPos(latest.current, i, pos));
    if (!pos) return;
    if (!ended && i === done) {
      if (pending === i) return;
      setPending(i);
      setName("");
      setTimes(i === 0 ? { depart_at: latest.current[0].depart_at, finish_at: latest.current[0].finish_at } : { depart_at: at(i + 1, "06"), finish_at: at(i + 1, "09") });
      api.get("/place-name", { params: { lat: pos.lat, lon: pos.lon } }).then(({ data }) => setName((n) => n || data.name || `Point ${i + 1}`)).catch(() => setName((n) => n || `Point ${i + 1}`));
    } else {
      if (i > 0) route(i - 1);
      if (i < latest.current.length && posOf(latest.current, i + 1)) route(i);
    }
  };
  const confirm = async (end) => {
    const i = pending;
    const clean = name.trim();
    let ls = latest.current.map((l, n) => (i === 0 && n === 0 ? { ...l, route_start: clean, ...times } : n === i - 1 ? { ...l, route_dest: clean } : l));
    if (!end && i > 0) ls = [...ls, { ...newLeg(i + 1, clean), ...times }];
    put(ls);
    setPending(null);
    setDone(i + 1);
    setEnded(end);
    if (i > 0) { setBusy(true); await route(i - 1); setBusy(false); }
  };
  const finish = () => {
    if (hasRoute && sure < 2) { setSure(sure + 1); return; }
    onApply(latest.current);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[96vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-3 sm:p-5" data-testid="quick-plan-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold"><Zap className="h-5 w-5 text-amber-500" /> {QUICK_NAME}</DialogTitle>
          <DialogDescription>{ended ? "Trip laid out. Drag any pin or line to improve it, then tap Done." : pending !== null ? "Check the name and times, then confirm this point." : legs[0].start_pos ? "Tap the next stop on the chart." : "Tap where you'll depart from."}</DialogDescription>
        </DialogHeader>
        {sure > 0 && (
          <p role="alert" className="rounded-md border-2 border-[var(--red)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="quick-plan-replace-warning">
            {sure === 1 ? "Replace the current Route Planning START, DESTINATION, times and legs with this draft?" : "Are you really sure? The current route can't be brought back."}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="quick-plan-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-[2] justify-center gap-1.5" disabled={!ended || busy} onClick={finish} data-testid="quick-plan-done-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {sure === 1 ? "Yes, replace it" : sure === 2 ? "Yes, I'm really sure" : "Done Quick Route Plan Draft"}
          </button>
        </div>
        {open && <StopsMap quick paused={pending !== null || ended} legs={legs} onPlace={onPlace} onPath={(k, pts) => put(latest.current.map((l, n) => (n === k ? { ...l, path: pts } : l)))} onRedraw={() => {}} />}
        {pending !== null && <Confirm i={pending} onDelete={() => { put(setPos(latest.current, pending, null)); setPending(null); setName(""); }} name={name} setName={setName} leg={times} setTimes={(p) => setTimes((t) => ({ ...t, ...p }))} onConfirm={confirm} busy={busy} />}
      </DialogContent>
    </Dialog>
  );
};
