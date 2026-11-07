import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { shrink } from "@/components/boat/PhotoPicker";

const keyOf = (name) => name.trim().toLowerCase();
const merge = (list, found) => {
  const next = [...list];
  found.forEach((f) => {
    const at = next.findIndex((x) => keyOf(x.name) === keyOf(f.name));
    if (at >= 0) next[at] = { ...next[at], qty: next[at].qty + (f.qty || 1) };
    else next.push({ key: `${Date.now()}-${next.length}`, name: f.name, qty: f.qty || 1 });
  });
  return next;
};

// Opened by scanning a cupboard's QR card: photo each thing going in (milk, eggs, butter...), check the list, then add or replace.
export const QrScanDialog = ({ area, zone, boat, crew, online, onSave, onClose }) => {
  const input = useRef(null);
  const [mode, setMode] = useState("add");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(0);
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
      setItems((l) => merge(l, data.items));
    } catch (err) { toast.error(apiError(err, "The Magic Scan didn't work, please try again")); }
    finally { setBusy(false); }
  };
  const edit = (k, patch) => setItems((l) => l.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const ready = items.filter((i) => i.name.trim());
  const existing = (area.items || []).length;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-md flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--navy)] p-4" data-testid="qr-scan-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left font-display text-xl font-extrabold">
            {zone && <span className="h-5 w-5 shrink-0 rounded-[5px] border border-black/20" style={{ backgroundColor: zone.hex }} />} Magic Scan into {area.name}
          </DialogTitle>
          <DialogDescription className="text-left text-sm" data-testid="qr-scan-intro">
            {zone ? `${zone.map} · ` : ""}Take a photo of each thing going in, e.g. milk, eggs, butter and bacon. Check the list, then save.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" data-testid="qr-scan-mode">
          {[["add", "Add to contents"], ["replace", "Replace contents"]].map(([v, label]) => (
            <label key={v} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-[1.5px] px-3 text-sm font-bold ${mode === v ? "border-[var(--navy)] bg-sky-50" : "border-[var(--line)] bg-white"}`} data-testid={`qr-scan-mode-${v}`}>
              <input type="radio" name="qr-mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="h-4 w-4 accent-[var(--navy)]" /> {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]" data-testid="qr-scan-mode-note">
          {mode === "add" ? `Keeps the ${existing} ${existing === 1 ? "item" : "items"} already listed and adds these.` : `The ${existing} ${existing === 1 ? "item" : "items"} listed now will be replaced by this list.`}
        </p>
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={scan} data-testid="qr-scan-input" />
        <button type="button" className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--navy)]/40 bg-slate-50 text-sm font-bold [transition:background-color_.15s] hover:bg-sky-50"
          onClick={() => input.current?.click()} disabled={busy} data-testid="qr-scan-photo-btn">
          {busy ? <><Loader2 className="h-7 w-7 animate-spin" /> Magic Scanning...</> : <><Camera className="h-7 w-7" /> {photos ? "Take another photo" : "Take a photo"}</>}
        </button>
        {items.length > 0 && (
          <ul className="flex flex-col gap-1.5" data-testid="qr-scan-items">
            {items.map((i, n) => (
              <li key={i.key} className="flex items-center gap-1.5" data-testid={`qr-scan-item-${n}`}>
                <input value={i.name} maxLength={120} onChange={(e) => edit(i.key, { name: e.target.value })} aria-label="Item name" className="field-input h-10 min-w-0 flex-1 text-sm" data-testid={`qr-scan-item-${n}-name`} />
                <input type="number" min={1} max={9999} value={i.qty} onChange={(e) => edit(i.key, { qty: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) })} aria-label="Quantity" className="field-input h-10 w-16 text-sm" data-testid={`qr-scan-item-${n}-qty`} />
                <button type="button" className="icon-btn" aria-label={`Remove ${i.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} data-testid={`qr-scan-item-${n}-remove`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-ghost h-10 justify-center gap-1.5 text-sm" onClick={() => setItems((l) => [...l, { key: `${Date.now()}`, name: "", qty: 1 }])} data-testid="qr-scan-add-row-btn"><Plus className="h-4 w-4" /> Add an item by hand</button>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} disabled={busy} data-testid="qr-scan-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-12 flex-[2] justify-center gap-2" disabled={busy || (!ready.length && mode === "add")} onClick={() => onSave(ready, mode)} data-testid="qr-scan-save-btn">
            <Sparkles className="h-4 w-4" /> {mode === "add" ? `Add ${ready.length} to ${area.name}` : `Replace with ${ready.length}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
