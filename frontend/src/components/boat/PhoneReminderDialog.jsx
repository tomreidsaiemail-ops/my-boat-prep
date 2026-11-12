import { useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Asked at sign out when the Skipper's Phone is blank, so a shore contact can call in an emergency.
export const PhoneReminderDialog = ({ save, unsynced, onLeave, onClose }) => {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = phone.replace(/[^\d]/g, "").length >= 6;
  const saveAndLeave = async () => {
    setBusy(true);
    save(phone.trim());
    for (let i = 0; i < 30 && unsynced() > 0; i += 1) await wait(300);  // let the number reach the cloud first
    setBusy(false);
    onLeave();
  };
  return (
    <Dialog open={!!save} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)] bg-white" data-testid="phone-reminder-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-black text-[var(--navy)]"><Phone className="h-5 w-5" /> Add your phone number</DialogTitle>
          <DialogDescription className="text-sm text-slate-700">Your Skipper&apos;s Phone is blank. Add it so your shore contact and crew can call you in an emergency.</DialogDescription>
        </DialogHeader>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 30))} placeholder="+64 21 555 1234" autoFocus className="field-input" data-testid="phone-reminder-input" />
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" className="btn-solid min-h-11 flex-1 justify-center gap-2" disabled={!ok || busy} onClick={saveAndLeave} data-testid="phone-reminder-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save and sign out
          </button>
          <button type="button" className="btn-ghost min-h-11 flex-1 justify-center" disabled={busy} onClick={onLeave} data-testid="phone-reminder-skip-btn">Sign out anyway</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
