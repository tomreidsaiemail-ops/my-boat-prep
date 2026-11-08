import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { groupTargets } from "@/lib/areaTargets";

// Puts a boat area (e.g. a Red folder scanned on its own) inside a cupboard as a folder or box. Its own zone's cupboards come first.
export const MergeAreaDialog = ({ area, parents, zones = {}, onMerge, onClose }) => {
  const [target, setTarget] = useState("");
  useEffect(() => setTarget(""), [area?.id]);
  const groups = area ? groupTargets(area, parents, zones) : [];
  return (
    <Dialog open={!!area} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="inventory-merge-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Put {area?.name} inside...</DialogTitle>
          <DialogDescription>It becomes a folder or box inside that boat area, keeping its own list. Search still finds everything in it.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5" data-testid="inventory-merge-options">
          {groups.map((g, n) => (
            <Fragment key={g.key}>
              {n > 0 && <li role="separator" className="my-1 border-t-2 border-[var(--line)]" data-testid={`inventory-merge-separator-${n}`} />}
              <li className="flex items-center gap-2 pt-1 text-xs font-extrabold uppercase tracking-wide text-[var(--navy)]" data-testid={`inventory-merge-group-${g.key.toLowerCase()}`}>
                {g.zone && <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-black/20" style={{ backgroundColor: g.zone.hex }} />}{g.label}
              </li>
              {g.items.map((p) => (
                <li key={p.id}>
                  <label className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md border-[1.5px] px-3 text-sm font-bold ${target === p.id ? "border-[var(--navy)] bg-sky-50" : "border-[var(--line)]"}`}>
                    <input type="radio" name="merge-target" checked={target === p.id} onChange={() => setTarget(p.id)} className="h-5 w-5 accent-[var(--navy)]" data-testid={`inventory-merge-option-${p.id}`} />
                    {zones[p.id] && <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ backgroundColor: zones[p.id].hex }} />}
                    <span className="min-w-0 flex-1">{p.name}</span>
                  </label>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
        <div className="flex gap-2">
          <button type="button" className="btn-solid h-12 flex-1 justify-center" disabled={!target} onClick={() => onMerge(target)} data-testid="inventory-merge-confirm-btn">Put inside</button>
          <button type="button" className="btn-ghost h-12 flex-1 justify-center" onClick={onClose} data-testid="inventory-merge-cancel-btn">Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
