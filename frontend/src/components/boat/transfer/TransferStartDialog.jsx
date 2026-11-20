import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TRANSFER_RULES } from "@/lib/transfer";

// The seller confirms what does and doesn't go with the boat before the cupboard review starts.
export const TransferStartDialog = ({ open, vessel, onStart, onClose }) => {
  const [ok, setOk] = useState({});
  const all = TRANSFER_RULES.every(([k]) => ok[k]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto border-2 border-[var(--navy)]" data-testid="transfer-start-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><ArrowRightLeft className="h-5 w-5" />Transfer ownership of {vessel || "this boat"}</DialogTitle>
          <DialogDescription>Tick each one to confirm you understand what the new owner gets.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {TRANSFER_RULES.map(([k, text]) => (
            <li key={k}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] px-3 py-2 text-sm font-semibold ${k === "shore" ? "border-amber-500 bg-amber-50" : "border-[var(--line)]"}`} data-testid={`transfer-rule-${k}`}>
                <input type="checkbox" checked={!!ok[k]} onChange={(e) => setOk((o) => ({ ...o, [k]: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`transfer-rule-${k}-checkbox`} />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ul>
        <Link to="/transfer-guide" onClick={onClose} className="text-sm font-bold underline" data-testid="transfer-start-guide-link">Read the step-by-step guide first (printable, for your broker)</Link>
        <p className="text-sm text-[var(--muted)]">Next, you go through every cupboard that still has things in it, so the new owner gets an accurate inventory.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost h-11 px-5" onClick={onClose} data-testid="transfer-start-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 px-5" disabled={!all} onClick={() => { setOk({}); onStart(); }} data-testid="transfer-start-btn">Start</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
