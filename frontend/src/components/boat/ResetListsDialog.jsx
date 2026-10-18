import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Box = ({ checked, onChange, testId, children, bold }) => (
  <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-3 text-base ${bold ? "font-bold" : "font-medium"}`} data-testid={`${testId}-label`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--navy)]" data-testid={testId} />
    <span>{children}</span>
  </label>
);

export const ResetListsDialog = ({ open, options, onConfirm, onClose }) => {
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setPicked([]); setError(""); } }, [open]);

  const all = options.length > 0 && picked.length === options.length;
  const toggle = (id, on) => { setError(""); setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id))); };
  const toggleAll = (on) => { setError(""); setPicked(on ? options.map((o) => o.id) : []); };
  const submit = () => {
    if (!picked.length) { setError("Nothing is selected. Tick the lists you want to reset, or Select All."); return; }
    onConfirm(options.filter((o) => picked.includes(o.id)).map((o) => o.id));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-sm flex-col rounded-lg border-2 border-[var(--navy)]" data-testid="reset-all-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><RotateCcw className="h-5 w-5" /> Reset lists</DialogTitle>
          <DialogDescription className="text-left text-sm text-[var(--navy)]" data-testid="reset-all-explainer">
            Ticked lists go back to the latest master items. Your edits, added items and ticks on them are removed. Lists you created or cloned, Ship&apos;s Log and My To Do List are never reset.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-md border-[1.5px] border-[var(--line)]">
          <div className="border-b-[1.5px] border-[var(--line)] bg-slate-50"><Box bold checked={all} onChange={toggleAll} testId="reset-select-all">Select All</Box></div>
          {options.map((o) => (
            <Box key={o.id} checked={picked.includes(o.id)} onChange={(on) => toggle(o.id, on)} testId={`reset-option-${o.id}`}>
              {o.name}{o.deleted && <span className="ml-1 text-sm font-normal text-[var(--muted)]">(deleted, will be restored)</span>}
            </Box>
          ))}
        </div>
        {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-center text-sm font-bold text-[var(--red)]" data-testid="reset-nothing-selected">{error}</div>}
        <DialogFooter className="flex-row justify-end gap-2">
          <button type="button" className="btn-ghost px-5" onClick={onClose} data-testid="reset-all-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid px-8" onClick={submit} data-testid="reset-all-confirm-btn">OK</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
