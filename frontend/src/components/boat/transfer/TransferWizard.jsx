import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PackageOpen } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrScanDialog } from "@/components/boat/inventory/QrScanDialog";
import { ZoneSummary } from "@/components/boat/transfer/ZoneSummary";
import { applyQr } from "@/lib/qrStock";
import { qtyText, wizardStops, zoneTree } from "@/lib/transfer";
import { areaZones } from "@/lib/zoneColours";

// One step per non-empty cupboard (Food & Drink ones are skipped, they're emptied on sale), then the full summary.
export const TransferWizard = ({ open, boat, areas, online, onAreasChange, onFinish, onClose }) => {
  const zones = useMemo(() => areaZones(boat, areas), [boat, areas]);
  const [stops] = useState(() => wizardStops(areas, zones));
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const last = step >= stops.length;
  const area = !last ? areas.find((a) => a.id === stops[step]) : null;
  const items = (area?.items || []).filter((i) => !i.removed);
  const save = (list, mode) => onAreasChange((all) => all.map((a) => (a.id === area.id ? { ...a, items: applyQr(a.items, list, mode) } : a)));
  const z = area ? zones[area.id] || zones[area.parent_id] : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col border-2 border-[var(--navy)]" data-testid="transfer-wizard">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{last ? "Review the full inventory" : `Cupboard ${step + 1} of ${stops.length}`}</DialogTitle>
          <DialogDescription>{last ? "Every zone and cupboard the new owner gets. Scroll to check it, then press Finish." : "Add or remove anything that won't stay with the boat."}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {last ? <ZoneSummary tree={zoneTree(areas, zones)} /> : area && (
            <div className="flex flex-col gap-3" data-testid="transfer-wizard-step">
              <div className="rounded-md border-[1.5px] border-[var(--line)] px-3 py-2" style={{ borderLeft: `6px solid ${z?.hex || "#D9DEE5"}` }}>
                <p className="text-xs font-extrabold uppercase text-[var(--muted)]" data-testid="transfer-wizard-zone">{z?.map || "No zone"}</p>
                <p className="text-lg font-extrabold text-[var(--navy)]" data-testid="transfer-wizard-area-name">{area.name || "Cupboard"}</p>
                <ul className="mt-1 flex flex-col gap-0.5" data-testid="transfer-wizard-items">
                  {items.map((i) => <li key={i.id} className="text-sm">{i.name}{qtyText(i)}</li>)}
                  {!items.length && <li className="text-sm italic text-[var(--muted)]">Now empty</li>}
                </ul>
              </div>
              <button type="button" className="btn-solid h-11 justify-center" onClick={() => setEditing(true)} data-testid="transfer-wizard-edit-btn"><PackageOpen className="h-4 w-4" />Add or remove items</button>
            </div>
          )}
          {!last && !stops.length && <p className="text-sm" data-testid="transfer-wizard-none">No cupboards have anything in them.</p>}
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <button type="button" className="btn-solid h-11 px-4" disabled={!step} onClick={() => setStep((s) => s - 1)} data-testid="transfer-wizard-back-btn"><ChevronLeft className="h-4 w-4" />Back</button>
          {last
            ? <button type="button" className="btn-solid h-11 px-6" onClick={onFinish} data-testid="transfer-wizard-finish-btn">Finish</button>
            : <button type="button" className="btn-solid h-11 px-4" onClick={() => setStep((s) => s + 1)} data-testid="transfer-wizard-next-btn">Next<ChevronRight className="h-4 w-4" /></button>}
        </div>
        {editing && area && <QrScanDialog area={area} zone={z} boat={boat} online={online} onSave={save} onClose={() => setEditing(false)} />}
      </DialogContent>
    </Dialog>
  );
};
