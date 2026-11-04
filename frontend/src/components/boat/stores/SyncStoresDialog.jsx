import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MicButton } from "@/components/boat/stores/MicButton";
import { api, apiError } from "@/lib/api";
import { fmtWeight, stockOf } from "@/lib/stores";

const UsedRows = ({ rows, setRows, units }) => {
  const set = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  return (
    <ul className="flex flex-col gap-2" data-testid="stores-review-rows">
      {rows.map((r) => (
        <li key={r.key} className={`flex items-center gap-2 rounded-md border border-[var(--line)] p-2 ${r.keep ? "" : "opacity-50"}`} data-testid={`stores-row-${r.key}`}>
          <input type="checkbox" checked={r.keep} onChange={(e) => set(r.key, { keep: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--navy)]" aria-label={`Remove ${r.name}`} data-testid={`stores-row-keep-${r.key}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{r.name}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{r.area} · {r.stock} on board · ~{fmtWeight(r.unitW * (+r.qty || 0), units)}</span>
          </span>
          <input value={r.qty} inputMode="numeric" onChange={(e) => set(r.key, { qty: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            className="field-input h-10 !w-14 shrink-0 !text-sm" aria-label="Quantity used" data-testid={`stores-row-qty-${r.key}`} />
        </li>
      ))}
    </ul>
  );
};

// Say or type what was eaten or drunk; the MPA matches it to the Food/Drink areas and, after a check, takes it out.
export const SyncStoresDialog = ({ areas, units, onDone, onClose }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null);
  const [unknown, setUnknown] = useState([]);
  const stock = stockOf(areas);
  const work = async () => {
    if (text.trim().length < 2) { toast.error("Say or type what was used first"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/ai/mpa/consumed", { text: text.trim(), stock: stock.slice(0, 600).map((s) => ({ name: s.name.slice(0, 80), qty: Math.min(9999, s.qty), area: s.area.slice(0, 120) })) }, { timeout: 90000 });
      setRows(data.items.map((u) => { const s = stock[u.n - 1]; return { key: `${s.areaId}-${s.itemId}`, ...s, stock: s.qty, qty: String(u.qty), unitW: u.weight_g / u.qty, keep: true }; }));
      setUnknown(data.unknown || []);
    } catch (err) { if (err?.response?.data?.code !== "daily_limit") toast.error(apiError(err, "The MPA couldn't work that out, please try again")); }
    setBusy(false);
  };
  const kept = (rows || []).filter((r) => r.keep && +r.qty >= 1);
  const confirm = () => {
    if (kept.some((r) => +r.qty > r.stock)) { toast.error("You can't use more than is on board"); return; }
    onDone(kept.map((r) => ({ areaId: r.areaId, itemId: r.itemId, name: r.name, qty: +r.qty, weight: r.unitW * +r.qty })));
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="stores-sync-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><RefreshCw className="h-5 w-5" /> Sync Food &amp; Drink Boat Areas</DialogTitle>
          <DialogDescription className="text-left text-sm">{rows ? "Check what the MPA will take out of your stores, then confirm." : "Tell the Magic Provisioning Assistant what was eaten or drunk, and it takes those items out of their food and drink areas."}</DialogDescription>
        </DialogHeader>
        {!stock.length ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="stores-empty">Nothing is listed in your Food (F) or Drink (D) boat areas yet. Try Batch Magic Scan My Shopping first.</p>
          : !rows ? (
            <div className="flex flex-col gap-2">
              <textarea value={text} maxLength={2000} rows={4} onChange={(e) => setText(e.target.value)} className="field-input h-auto py-2 !text-sm" data-testid="stores-text-input"
                placeholder="e.g. We had 4 beers from the bilge, 2 steaks from the freezer and finished the milk" aria-label="What was used" />
              <div className="flex items-center gap-2">
                <MicButton disabled={busy} onText={(t) => setText((v) => (v.trim() ? `${v.trim()} ${t}` : t))} />
                <span className="text-xs text-[var(--muted)]">Tap Speak, say what was used, then Stop.</span>
              </div>
            </div>
          ) : (
            <>
              {rows.length ? <UsedRows rows={rows} setRows={setRows} units={units} /> : <p className="text-sm text-[var(--muted)]" data-testid="stores-none-matched">The MPA couldn't match anything to your stores.</p>}
              {unknown.length > 0 && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" data-testid="stores-unknown">Not found in your food or drink areas: {unknown.join(", ")}</p>}
              {kept.length > 0 && <p className="text-xs font-semibold" data-testid="stores-total">{kept.reduce((n, r) => n + +r.qty, 0)} items · MPA estimated weight ~{fmtWeight(kept.reduce((n, r) => n + r.unitW * +r.qty, 0), units)}</p>}
            </>
          )}
        <DialogFooter className="flex-row justify-end gap-2">
          {rows ? <>
            <button type="button" className="btn-ghost px-4" onClick={() => setRows(null)} data-testid="stores-back-btn">Back</button>
            <button type="button" className="btn-solid px-5" disabled={!kept.length} onClick={confirm} data-testid="stores-confirm-btn">Confirm and remove</button>
          </> : <button type="button" className="btn-solid px-5" disabled={busy || !stock.length} onClick={work} data-testid="stores-work-btn">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Working it out...</> : "Work it out"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
