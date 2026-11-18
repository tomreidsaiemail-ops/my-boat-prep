import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LevelPicker } from "@/components/boat/departure/LevelPicker";
import { missingLevels } from "@/lib/allDone";
import { batteriesOf, batteryName } from "@/lib/telemetry";

const TANKS = [["fuel", "Fuel"], ["gas", "LPG"], ["water", "Water"]];

// Departures and arrivals: the latest levels filled in for the skipper to confirm or change.
export const LevelsConfirmDialog = ({ ask, boat, onConfirm, onClose }) => {
  const [levels, setLevels] = useState({});
  useEffect(() => { if (ask) setLevels(ask.levels || {}); }, [ask]);
  const missing = missingLevels(boat, levels);
  const rows = [...TANKS, ...batteriesOf(boat).map((b) => [`bat_${b.id}`, batteryName(b)])];
  const lowText = ask?.arrival ? "Top up or charge before the next passage." : undefined;
  return (
    <Dialog open={!!ask} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="levels-confirm-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        {ask && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-extrabold" data-testid="levels-confirm-title">{ask.title}</DialogTitle>
              <DialogDescription data-testid="levels-confirm-description">
                {Object.keys(ask.levels || {}).length ? "Filled in from the latest levels recorded. Change any that are different, then confirm." : "No levels recorded yet, so pick a level for every tank and battery, then confirm."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2.5">
              {rows.map(([k, n]) => <LevelPicker key={k} id={`confirm-${k}`} label={n} value={levels[k]} lowText={lowText} onChange={(v) => setLevels((l) => ({ ...l, [k]: v }))} />)}
            </div>
            <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 bg-white px-1 pb-1 pt-2">
              {missing.length > 0 && <p role="alert" className="w-full text-sm font-bold text-[var(--red)]" data-testid="levels-confirm-missing">Pick a level for {missing.join(", ")}.</p>}
              <button type="button" className="btn-solid h-11 flex-1 justify-center" disabled={missing.length > 0} onClick={() => onConfirm(levels)} data-testid="levels-confirm-btn">Confirm levels</button>
              <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="levels-confirm-cancel-btn">Cancel</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
