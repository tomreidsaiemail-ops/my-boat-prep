import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { ShopAreasStep } from "@/components/boat/stores/ShopAreasStep";
import { ShopSetStep } from "@/components/boat/stores/ShopSetStep";
import { ShopReview } from "@/components/boat/stores/ShopReview";
import useBatchScan from "@/hooks/useBatchScan";
import { fmtWeight, learnedArea, shopTargets } from "@/lib/stores";

const PARAMS = { shopping: true };

// Builds review rows from finished scans; learned destinations win over the set's area.
const useRows = (entries, areas) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const keys = new Set(entries.map((e) => e.key));
    setRows((rs) => {
      const have = new Set(rs.map((r) => r.entry));
      const add = entries.filter((e) => e.status === "done" && !have.has(e.key)).flatMap((e) => (e.items || []).map((i, n) => {
        const learned = learnedArea(areas, i.name);
        const dest = learned && areas.some((a) => a.id === learned && (a.food || a.drinks)) ? learned : e.name;
        return { key: `${e.key}-${n}`, entry: e.key, name: i.name, qty: String(i.qty), unitW: (i.weight_g || 0) / (i.qty || 1), setArea: e.name, dest, learned: dest !== e.name, keep: true };
      }));
      const kept = rs.filter((r) => keys.has(r.entry));
      return add.length || kept.length !== rs.length ? [...kept, ...add] : rs;
    });
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  return [rows, setRows];
};

export const ShopScanDialog = ({ boatId, areas, units, onApplyTargets, onDone, onClose }) => {
  const [targets, setTargets] = useState(() => shopTargets(areas));
  const [sets, setSets] = useState([]);
  const [step, setStep] = useState(-1);
  const [discard, setDiscard] = useState(false);
  const batch = useBatchScan(boatId, PARAMS);
  const [rows, setRows] = useRows(batch.entries, areas);
  const dests = useMemo(() => {
    const out = [...sets];
    areas.filter((a) => (a.food || a.drinks) && !out.some((s) => s.id === a.id)).forEach((a) => out.push({ id: a.id, name: a.name }));
    return out;
  }, [sets, areas]);
  const scanning = batch.entries.some((e) => e.status === "queued" || e.status === "scanning");
  const others = areas.filter((a) => !a.parent_id && !targets.some((t) => t.id === a.id));
  const tagOther = (a, p) => setTargets((ts) => [...ts, { id: a.id, name: a.name, food: !!p.food, drinks: !!p.drinks, use: true, isNew: false }]);
  const review = step === sets.length && step >= 0;

  const start = () => {
    const chosen = targets.filter((t) => t.use && (t.food || t.drinks));
    if (!chosen.length) { toast.error("Pick at least one Food or Drink area"); return; }
    onApplyTargets(targets);
    setSets(chosen.map(({ id, name }) => ({ id, name })));
    setStep(0);
  };
  const kept = rows.filter((r) => r.keep && r.name.trim());
  const totalW = kept.reduce((n, r) => n + r.unitW * (+r.qty || 0), 0);
  const finish = () => {
    if (kept.some((r) => !(+r.qty >= 1))) { toast.error("Quantities must be whole numbers from 1"); return; }
    onDone(kept.map((r) => ({ name: r.name.trim().slice(0, 80), qty: +r.qty, dest: r.dest, setArea: r.setArea, weight: r.unitW * +r.qty })));
  };
  const close = () => (batch.entries.length ? setDiscard(true) : onClose());
  const status = scanning ? `Scanning photo ${batch.position || 1} of ${batch.entries.length}...` : batch.entries.length ? `${batch.entries.length} ${batch.entries.length === 1 ? "photo" : "photos"} scanned` : "";

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="shop-scan-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><ShoppingBasket className="h-5 w-5" /> Batch Magic Scan My Shopping</DialogTitle>
          <DialogDescription className="text-left text-sm">{review ? "Check what the MPA found. Move anything to a different area and it will remember next time." : "Photograph your shopping set by set and the MPA files it into your boat areas."}</DialogDescription>
        </DialogHeader>
        {step >= 0 && sets.length > 0 && (
          <div className="flex flex-wrap gap-1" data-testid="shop-steps">
            {[...sets.map((s) => s.name), "Review"].map((n, i) => (
              <button key={n + i} type="button" onClick={() => setStep(i)} data-testid={`shop-step-chip-${i}`}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${i === step ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--navy)]"}`}>
                {i < sets.length ? `${i + 1}. ${n} (${batch.entries.filter((e) => e.name === sets[i].id).length})` : n}
              </button>
            ))}
          </div>
        )}
        {step < 0 && <ShopAreasStep targets={targets} setTargets={setTargets} others={others} onTagOther={tagOther} />}
        {step >= 0 && !review && <ShopSetStep set={sets[step]} n={step} count={sets.length} batch={batch} />}
        {review && <ShopReview rows={rows} setRows={setRows} dests={dests} units={units} scanning={scanning} />}
        {status && <p className="text-xs font-semibold text-[var(--muted)]" data-testid="shop-scan-status">{status}</p>}
        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          {step >= 0 && <button type="button" className="btn-ghost px-4" onClick={() => setStep(step - 1)} data-testid="shop-back-btn">Back</button>}
          {step < 0 && <button type="button" className="btn-solid px-5" onClick={start} data-testid="shop-start-btn">Continue</button>}
          {step >= 0 && !review && <button type="button" className="btn-solid px-5" onClick={() => setStep(step + 1)} data-testid="shop-next-btn">
            {step + 1 < sets.length ? `Next: ${sets[step + 1].name}` : "Review shopping"}</button>}
          {review && <button type="button" className="btn-solid px-5" disabled={scanning || !kept.length} onClick={finish} data-testid="shop-done-btn">
            Done / Continue{kept.length ? ` (~${fmtWeight(totalW, units)})` : ""}</button>}
        </DialogFooter>
        <ConfirmDelete item={discard ? {} : null} testId="shop-discard" title="Discard this shopping scan?" note="Your photos and scanned items are thrown away. Nothing is added to the boat."
          confirmLabel="Discard" cancelLabel="Keep going" onConfirm={() => { batch.clear(); onClose(); }} onClose={() => setDiscard(false)} />
      </DialogContent>
    </Dialog>
  );
};
