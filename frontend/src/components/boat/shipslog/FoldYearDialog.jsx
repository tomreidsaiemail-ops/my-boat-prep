import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logYears, yearMembers } from "@/lib/logFolders";

// One tap puts every passage folder and log from a year into "<year> Ship's Logs".
export const FoldYearDialog = ({ items, onFold, onClose }) => {
  const years = logYears(items);
  const [year, setYear] = useState(years[0] || "");
  const n = year ? yearMembers(items, year).length : 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="log-year-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Fold a year</DialogTitle>
          <DialogDescription className="text-left text-sm">Every passage folder and log dated in the year goes into one folder, e.g. 2024 Ship&apos;s Logs.</DialogDescription>
        </DialogHeader>
        {years.length ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Year">
              {years.map((y) => (
                <button key={y} type="button" role="radio" aria-checked={year === y} onClick={() => setYear(y)} data-testid={`log-year-${y}`}
                  className={`h-10 rounded-md border-2 px-4 font-extrabold [transition:background-color_.15s] ${year === y ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white"}`}>{y}</button>
              ))}
            </div>
            <p className="text-sm" data-testid="log-year-count">{n} {n === 1 ? "item" : "items"} will go into <b>{year} Ship&apos;s Logs</b>.</p>
          </div>
        ) : <p className="text-sm" data-testid="log-year-empty">There are no dated logs outside a year folder.</p>}
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose} data-testid="log-year-cancel-btn">Cancel</button>
          {years.length > 0 && <button type="button" className="btn-solid px-4" disabled={!n} onClick={() => onFold(year)} data-testid="log-year-fold-btn">Fold {year}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
