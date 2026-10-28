import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { buildRota, nextHour } from "@/lib/watchRota";
import { RsvpBadge } from "@/components/boat/Rsvp";
import { RotaList } from "@/components/boat/RotaList";

const LENGTHS = [12, 24, 36, 48, 72, 96, 120, 168, 240, 336];
const lengthLabel = (h) => (h < 24 || h % 24 ? `${h} hours` : `${h / 24} day${h === 24 ? "" : "s"}`);

export const WatchRotaDialog = ({ open, boat, info, online, onSaved, onClose }) => {
  const { user } = useAuth();
  const people = useMemo(() => [
    { id: user.user_id, name: user.name || user.email, roles: ["Skipper"] },
    ...info.crew.map((m) => ({ id: m.user_id, name: m.name || m.email, roles: m.roles || [], rsvp: m.rsvp })),
  ], [user, info.crew]);
  const [start, setStart] = useState("");
  const [hours, setHours] = useState(24);
  const [perWatch, setPerWatch] = useState(1);
  const [ids, setIds] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open) return;
    const r = info.watch_rota;
    setStart(r?.start || nextHour());
    setHours(r?.hours || 24);
    setPerWatch(r?.per_watch || 1);
    setIds(r ? r.people.map((p) => p.id) : people.filter((p) => p.id === user.user_id || p.rsvp === "in").map((p) => p.id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = people.filter((p) => ids.includes(p.id)).map(({ rsvp, ...p }) => p);
  const slots = buildRota(start, hours, perWatch, chosen.length);
  const toggle = (id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const call = async (kind, fn, msg) => {
    if (!online) { toast.error("Go online to save the watch rota"); return; }
    setBusy(kind);
    try { await fn(); toast.success(msg); onSaved(); onClose(); }
    catch (e) { toast.error(apiError(e, "Couldn't save the watch rota, please try again")); }
    finally { setBusy(""); }
  };
  const save = () => call("save", () => api.put(`/boats/${boat.boat_id}/watch-rota`, { start, hours, per_watch: perWatch, people: chosen, slots }), "Watch rota saved. Crew can see it in the app.");
  const remove = () => call("delete", () => api.delete(`/boats/${boat.boat_id}/watch-rota`), "Watch rota removed");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="watch-rota-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Watch rota</DialogTitle>
          <DialogDescription className="text-left text-sm">Traditional ship's watches. The two short dog watches (16:00–18:00 and 18:00–20:00) make everyone's times rotate each day.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 flex flex-col gap-1.5 field-label">Voyage starts
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="field-input text-base normal-case tracking-normal" data-testid="rota-start-input" />
          </label>
          <label className="flex flex-col gap-1.5 field-label">Voyage length
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="field-input text-base normal-case tracking-normal" data-testid="rota-length-select">
              {LENGTHS.map((h) => <option key={h} value={h}>{lengthLabel(h)}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="field-label">On each watch</span>
            <div className="flex h-11 overflow-hidden rounded-md border-2 border-[var(--navy)]">
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setPerWatch(n)} aria-pressed={perWatch === n} data-testid={`rota-per-watch-${n}`}
                  className={`flex-1 text-sm font-bold [transition:background-color_.15s] ${perWatch === n ? "bg-[var(--navy)] text-white" : "bg-white"}`}>{n === 1 ? "1 person" : "2 people"}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Who stands watch</span>
          <ul className="divide-y divide-[var(--line)] rounded-md border-[1.5px] border-[var(--line)]" data-testid="rota-people">
            {people.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 accent-[var(--navy)]" data-testid={`rota-person-${p.id}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.name}</span>
                    {p.roles.length > 0 && <span className="block truncate text-xs text-[var(--muted)]">{p.roles.join(", ")}</span>}
                  </span>
                  {p.id !== user.user_id && <RsvpBadge status={p.rsvp || null} testId={`rota-person-${p.id}-rsvp`} />}
                </label>
              </li>
            ))}
          </ul>
        </div>
        {slots.length > 0
          ? <RotaList rota={{ people: chosen, slots }} testId="rota-preview" />
          : <p className="rounded-md bg-slate-50 p-3 text-center text-sm text-[var(--muted)]" data-testid="rota-empty">Tick at least one person to build the rota.</p>}
        <div className="flex gap-2">
          {info.watch_rota && (
            <button type="button" className="btn-ghost h-12 justify-center gap-2 px-4" disabled={!!busy} onClick={remove} data-testid="rota-delete-btn">
              {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
            </button>
          )}
          <button type="button" className="btn-solid h-12 flex-1 justify-center gap-2" disabled={!!busy || !slots.length} onClick={save} data-testid="rota-save-btn">
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save rota
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
