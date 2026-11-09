import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CloudOff, Loader2, MapPin, Sparkles, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { dropCatch, queuedCatches, updateCatch } from "@/lib/fishQueue";
import { localWhen } from "@/lib/timeAgo";

export const catchForm = (c) => {
  const form = new FormData();
  form.append("file", c.blob, "catch.jpg");
  if (c.lat != null && c.lon != null) { form.append("lat", c.lat); form.append("lon", c.lon); form.append("position", (c.position || "").slice(0, 80)); }
  form.append("when", c.when);
  if (c.taken_at) form.append("caught_at", c.taken_at);
  if (c.boat_id) { form.append("boat_id", c.boat_id); if (c.owner_id) form.append("owner_id", c.owner_id); }
  if (c.note?.trim()) form.append("note", c.note.trim().slice(0, 300));
  if (c.weight_kg > 0) form.append("weight_kg", c.weight_kg);
  return form;
};

const LB = 0.45359237;

// The skipper's own note and weight for a queued photo; their weight replaces the AI's estimate.
const NoteEditor = ({ c, imperial, disabled, onSave }) => {
  const [note, setNote] = useState(c.note || "");
  const [weight, setWeight] = useState(c.weight_kg ? String(+(imperial ? c.weight_kg / LB : c.weight_kg).toFixed(2)) : "");
  const save = () => {
    const w = parseFloat(weight);
    let kg = w > 0 ? +(imperial ? w * LB : w).toFixed(3) : null;
    if (kg > 1500) { toast.error(`That's over ${imperial ? "3,300 lb" : "1,500 kg"}. Check the weight.`); kg = c.weight_kg || null; setWeight(kg ? String(+(imperial ? kg / LB : kg).toFixed(2)) : ""); }
    if ((note.trim() || "") !== (c.note || "") || kg !== (c.weight_kg || null)) onSave({ note: note.trim().slice(0, 300), weight_kg: kg });
  };
  return (
    <div className="flex gap-1.5">
      <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} maxLength={300} disabled={disabled} placeholder="Note, e.g. caught trolling off the point"
        className="field-input h-9 min-w-0 flex-1 text-xs" data-testid={`fish-queue-note-${c.id}`} />
      <input value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))} onBlur={save} inputMode="decimal" disabled={disabled} placeholder={imperial ? "lb" : "kg"}
        aria-label={`Weight in ${imperial ? "pounds" : "kilograms"}`} className="field-input h-9 !w-20 shrink-0 text-xs" data-testid={`fish-queue-weight-${c.id}`} />
    </div>
  );
};

const Thumb = ({ blob }) => {
  const [src, setSrc] = useState("");
  useEffect(() => { const u = URL.createObjectURL(blob); setSrc(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return src ? <img src={src} alt="Queued catch" className="h-14 w-14 shrink-0 rounded-md border border-[var(--line)] object-cover" /> : null;
};

// Catches photographed offline, identified one by one when the skipper taps (each uses 1 Magic, just like online).
export const FishQueue = ({ userId, online, imperial, refreshKey, onIdentified, onLogged }) => {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState("");
  const load = () => queuedCatches(userId).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [userId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const identifyAll = async () => {
    let done = 0;
    await new Promise((r) => setTimeout(r, 150)); // let a note or weight being typed save first
    for (const c of await queuedCatches(userId)) {
      setBusy(c.id);
      try {
        const { data } = await api.post("/ai/fish", catchForm(c), { timeout: 150000 });
        await dropCatch(c.id);
        if (data.not_fish) toast.error(`Photo from ${localWhen(c.taken_at)}: ${data.message}`, { duration: 8000 });
        else { done += 1; if (data.log_item) onLogged(data.log_item); }
      } catch (err) {
        if (err.response?.status === 400) {
          await dropCatch(c.id);
          toast.error(`Photo from ${localWhen(c.taken_at)}: ${apiError(err)} It was taken off the queue.`, { duration: 8000 });
          continue;
        }
        if (err.response?.status === 422) {
          toast.error(`Photo from ${localWhen(c.taken_at)}: check its note and weight, then try again. It's still waiting.`, { duration: 8000 });
          continue;
        }
        toast.error(err.response ? `${apiError(err)} Your photos are still waiting.` : "Lost the signal. Your photos are still waiting.", { duration: 8000 });
        break;
      }
    }
    setBusy("");
    if (done) { toast.success(`${done} queued ${done === 1 ? "catch" : "catches"} identified and saved to your catch log`); onIdentified(); }
    load();
  };
  const remove = async (id) => { await dropCatch(id); load(); };
  return (
    <section className="flex flex-col gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 p-3" data-testid="fish-queue">
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-amber-950" data-testid="fish-queue-count"><CloudOff className="h-4 w-4" /> Waiting to identify ({items.length})</p>
      <ul className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={c.id} className="flex flex-col gap-1.5" data-testid={`fish-queue-item-${c.id}`}>
            <div className="flex items-center gap-2">
            <Thumb blob={c.blob} />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-bold">{localWhen(c.taken_at)}</p>
              <p className="flex items-center gap-1 truncate text-[var(--muted)]"><MapPin className="h-3.5 w-3.5 shrink-0" /> {c.position || "No GPS position"}</p>
            </div>
            {busy === c.id ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <button type="button" className="icon-btn hover:text-[var(--red)]" disabled={!!busy} onClick={() => remove(c.id)} aria-label="Remove queued photo" data-testid={`fish-queue-remove-${c.id}`}><Trash2 className="h-[18px] w-[18px]" /></button>
            )}
            </div>
            <NoteEditor c={c} imperial={imperial} disabled={!!busy} onSave={(patch) => updateCatch(c.id, patch).then(load)} />
          </li>
        ))}
      </ul>
      <button type="button" className="btn-solid h-11 justify-center gap-2 disabled:opacity-40" disabled={!online || !!busy} onClick={identifyAll} data-testid="fish-queue-identify-btn">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Identifying...</> : <><Sparkles className="h-4 w-4" /> {online ? "Identify queued catches" : "Identify when you have a signal"}</>}
      </button>
    </section>
  );
};
