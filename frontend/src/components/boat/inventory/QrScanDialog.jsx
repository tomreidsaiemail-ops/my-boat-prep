import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Minus, PackageMinus, Plus, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";
import { applyQr, matchItem } from "@/lib/qrStock";
import { QrQuickCount } from "@/components/boat/inventory/QrQuickCount";
import { SpeakButton } from "@/components/boat/voice/SpeakButton";
import { parseItem } from "@/lib/voiceCommand";

const keyOf = (name) => name.trim().toLowerCase();
const merge = (list, found) => {
  const next = list.filter((x) => x.name.trim());
  found.forEach((f) => {
    const at = next.findIndex((x) => keyOf(x.name) === keyOf(f.name));
    if (at >= 0) next[at] = { ...next[at], qty: next[at].qty + (f.qty || 1) };
    else next.push({ key: `${Date.now()}-${next.length}`, name: f.name, qty: f.qty || 1 });
  });
  return next;
};
const qtyOf = (i) => (i.qty === undefined || i.qty === null || i.qty === "" ? 1 : Number(i.qty) || 0);
const MODES = [["add", "Add (put)"], ["out", "Remove"]];

// Taking things out: tick off what's leaving the cupboard, or photo it and Magic Scan finds it in the list.
const OutList = ({ stock, out, setOut }) => (
  <ul className="flex flex-col gap-1.5" data-testid="qr-out-list">
    {!stock.length && <li className="text-sm text-[var(--muted)]" data-testid="qr-out-empty">Nothing is listed in here yet.</li>}
    {stock.map((i, n) => {
      const take = out[i.id] || 0;
      const set = (v) => setOut((o) => ({ ...o, [i.id]: Math.max(0, Math.min(qtyOf(i), v)) }));
      return (
        <li key={i.id} className={`flex items-center gap-1.5 rounded-md border-[1.5px] px-2 py-1 ${take ? "border-[var(--red)] bg-red-50" : "border-[var(--line)]"}`} data-testid={`qr-out-item-${n}`}>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{i.name} <span className="font-semibold text-[var(--muted)]">×{qtyOf(i)}</span></span>
          <button type="button" className="icon-btn !h-9 !w-9" aria-label={`One less ${i.name}`} disabled={!take} onClick={() => set(take - 1)} data-testid={`qr-out-item-${n}-minus`}><Minus className="h-4 w-4" /></button>
          <span className="w-12 text-center text-sm font-extrabold" data-testid={`qr-out-item-${n}-take`}>{take ? `-${take}` : "0"}</span>
          <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Take out one ${i.name}`} disabled={take >= qtyOf(i)} onClick={() => set(take + 1)} data-testid={`qr-out-item-${n}-plus`}><Plus className="h-4 w-4" /></button>
        </li>
      );
    })}
  </ul>
);

// Opened by scanning a cupboard's QR card: add, replace or take out contents, then a quick count of what's left.
export const QrScanDialog = ({ area, zone, boat, crew, online, onSave, onClose, onSyncStores }) => {
  const input = useRef(null);
  const [mode, setMode] = useState("add");
  const [items, setItems] = useState([{ key: "first", name: "", qty: 1 }]);
  const [out, setOut] = useState({});
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(0);
  const [after, setAfter] = useState(null);
  const stock = (area.items || []).filter((i) => !i.removed && qtyOf(i) > 0);
  const scan = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!online) { toast.error("Magic Scan needs a signal"); return; }
    let blob;
    try { blob = await shrink(file, 1600); } catch { toast.error("That file doesn't look like a photo"); return; }
    const form = new FormData();
    form.append("file", blob, "qr-scan.jpg");
    setBusy(true);
    try {
      const { data } = await api.post(`/boats/${boat.boat_id}/scan`, form, { params: crew ? { shopping: true, owner: boat.owner_id } : {}, timeout: 90000 });
      setPhotos((n) => n + 1);
      if (!data.items.length) toast.message("Magic Scan couldn't spot anything in that photo. Try closer, one or two things at a time.");
      if (mode !== "out") setItems((l) => merge(l, data.items));
      else {
        const missing = [];
        setOut((o) => {
          const next = { ...o };
          data.items.forEach((f) => {
            const hit = matchItem(stock, f.name);
            if (hit) next[hit.id] = Math.min(qtyOf(hit), (next[hit.id] || 0) + (f.qty || 1));
            else missing.push(f.name);
          });
          return next;
        });
        if (missing.length) toast.message(`Not listed in ${area.name}: ${missing.join(", ")}`);
      }
    } catch (err) { toast.error(apiError(err, "The Magic Scan didn't work, please try again")); }
    finally { setBusy(false); }
  };
  const edit = (k, patch) => setItems((l) => l.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const speakPlan = (text) => {
    const c = parseItem(text, mode === "out" ? "remove" : "put");
    if (!c.item) return { error: "I didn't catch the item." };
    if (c.kind === "put") { const name = c.item.replace(/\b\w/g, (x) => x.toUpperCase()); return { message: `Add ${c.qty} ${name} to ${area.name}?`, put: { name, qty: c.qty } }; }
    const hit = matchItem(stock, c.item);
    return hit ? { message: `Remove ${c.qty} ${hit.name} from ${area.name}?`, take: { id: hit.id, qty: c.qty } } : { error: `There is no ${c.item} in ${area.name}.` };
  };
  const speakDo = (p) => {
    if (p.put) { setMode("add"); setItems((l) => merge(l, [p.put])); return; }
    const hit = stock.find((i) => i.id === p.take.id);
    if (!hit) return;
    setMode("out"); setOut((o) => ({ ...o, [hit.id]: Math.min(qtyOf(hit), (o[hit.id] || 0) + p.take.qty) }));
  };
  const ready = items.filter((i) => i.name.trim());
  const taking = Object.entries(out).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ itemId, qty }));
  const taken = taking.reduce((n, t) => n + t.qty, 0);
  const existing = (area.items || []).length;
  const save = () => {
    const list = mode === "out" ? taking : ready;
    onSave(list, mode);
    setAfter(applyQr(area.items || [], list, mode));
  };
  const note = { add: `Keeps the ${existing} ${existing === 1 ? "item" : "items"} already listed and adds these.`, replace: `The ${existing} ${existing === 1 ? "item" : "items"} listed now will be replaced by this list.`,
    out: "Tap + for each thing taken out or used, or photo it. Anything that reaches 0 stays listed as removed for now, ready for restocking." }[mode];
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid="qr-scan-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left font-display text-xl font-extrabold">
            {zone && <span className="h-5 w-5 shrink-0 rounded-[5px] border border-black/20" style={{ backgroundColor: zone.hex }} />} {mode === "out" && !after ? `Take out of ${area.name}` : `Magic Scan into ${area.name}`}
          </DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="qr-scan-intro">
            {zone ? `${zone.map} · ` : ""}{after ? "Saved. Here's what's in there now." : mode === "out" ? "Take out milk, eggs or anything else used, so the list stays true." : "Take a photo of each thing going in, e.g. milk, eggs, butter and bacon. Check the list, then save."}
          </DialogDescription>
        </DialogHeader>
        {after ? <QrQuickCount area={area} items={after} onDone={onClose} /> : (
          <>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" data-testid="qr-scan-mode">
              {MODES.map(([v, label]) => (
                <label key={v} className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] px-2 py-1 text-xs font-bold leading-tight ${mode === v ? "border-[var(--navy)] bg-sky-50" : "border-[var(--line)] bg-white"}`} data-testid={`qr-scan-mode-${v}`}>
                  <input type="radio" name="qr-mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="h-4 w-4 shrink-0 accent-[var(--navy)]" /> {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]" data-testid="qr-scan-mode-note">{note}</p>
            {mode === "out" && onSyncStores && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-sky-50 px-3 py-2 text-xs font-semibold text-[var(--navy)]" data-testid="qr-scan-sync-tip">
                Tip: "Sync Food &amp; Drink Cupboards magically" may be a better option, as you can direct the Magic Provisioner to several cupboards at once.
                <button type="button" className="font-extrabold underline" onClick={() => { onClose(); onSyncStores(); }} data-testid="qr-scan-sync-btn">Open Sync Food &amp; Drink...</button>
              </p>
            )}
            <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={scan} data-testid="qr-scan-input" />
            <button type="button" className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-slate-50 text-sm font-bold [transition:background-color_.15s] hover:bg-sky-50"
              onClick={() => input.current?.click()} disabled={busy} data-testid="qr-scan-photo-btn">
              {busy ? <><Loader2 className="h-7 w-7 animate-spin" /> Magic Scanning...</> : <><Camera className="h-7 w-7" /> {mode === "out" ? "Photo what you're taking out" : photos ? "Take another photo" : "Take a photo"}</>}
            </button>
            <SpeakButton plan={speakPlan} onConfirm={speakDo} label={mode === "out" ? `Speak, e.g. "Remove milk"` : `Speak, e.g. "Add cheese"`}
              examples={mode === "out" ? ["Remove milk", "Take out 2 eggs"] : ["Add cheese", "Put 2 milk"]} className="btn-ghost h-12 justify-center gap-2" testId="qr-speak" />
            {mode === "out" ? <OutList stock={stock} out={out} setOut={setOut} /> : (
              <>
                {items.length > 0 && (
                  <ul className="flex flex-col gap-1.5" data-testid="qr-scan-items">
                    {items.map((i, n) => (
                      <li key={i.key} className="flex items-center gap-1.5" data-testid={`qr-scan-item-${n}`}>
                        <input value={i.name} maxLength={120} onChange={(e) => edit(i.key, { name: e.target.value })} aria-label="Item name" className="field-input h-10 min-w-0 flex-1 text-sm" data-testid={`qr-scan-item-${n}-name`} />
                        <input type="number" min={1} max={9999} value={i.qty} onChange={(e) => edit(i.key, { qty: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) })} aria-label="Quantity" className="field-input h-10 !w-16 shrink-0 text-sm" data-testid={`qr-scan-item-${n}-qty`} />
                        <button type="button" className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} data-testid={`qr-scan-item-${n}-remove`}><Trash2 className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm" onClick={() => setItems((l) => [...l, { key: `${Date.now()}`, name: "", qty: 1 }])} data-testid="qr-scan-add-row-btn"><Plus className="h-4 w-4" /> Add an item by hand</button>
              </>
            )}
            <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-[var(--line)] bg-white p-3">
              <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} disabled={busy} data-testid="qr-scan-cancel-btn">Cancel</button>
              <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={busy || (mode === "out" ? !taken : !ready.length)} onClick={save} data-testid="qr-scan-save-btn">
                {mode === "out" ? <><PackageMinus className="h-4 w-4" /> Take out {taken}</> : <><Sparkles className="h-4 w-4" /> {mode === "add" ? `Add ${ready.length} to ${area.name}` : `Replace with ${ready.length}`}</>}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
