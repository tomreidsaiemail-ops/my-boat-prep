import { useState } from "react";
import { ArrowRight, Ship } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { phoneError } from "@/lib/phone";

const isTodo = (v) => /^todo$/i.test((v || "").trim());
const BOX = "rounded-sm outline outline-[3px] outline-offset-4 outline-[var(--ink,#0f172a)]";

const Box = ({ id, label, value, placeholder, type = "text", onChange, error }) => (
  <label htmlFor={id} className={`flex flex-col gap-1 ${BOX}`}>
    <span className="field-label">{label}</span>
    <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field-input" data-testid={`${id}-input`} />
    {error && <span className="text-xs font-bold text-[var(--red)]" data-testid={`${id}-error`}>{error}</span>}
  </label>
);

// A brand new skipper's first sign-in: Vessel, Callsign and phone (TODO is fine for now), then into Welcome.
export const FirstDetailsDialog = ({ boat, onContinue }) => {
  const [v, setV] = useState({ vessel: boat.vessel || "", callsign: boat.callsign || "", skipper_phone: boat.skipper_phone || "" });
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: k === "skipper_phone" ? x.slice(0, 30) : x }));
  const phoneErr = v.skipper_phone.trim() && !isTodo(v.skipper_phone) ? phoneError(v.skipper_phone) : "";
  const ready = v.vessel.trim() && v.callsign.trim() && v.skipper_phone.trim() && !phoneErr;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent guard={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-h-[92vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)] bg-white [&>button.right-4]:hidden" data-testid="first-details-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-black text-[var(--navy)]"><Ship className="h-5 w-5" /> Welcome aboard My Boat Prep</DialogTitle>
          <DialogDescription className="text-sm text-slate-700">First, a few details about your boat.</DialogDescription>
        </DialogHeader>
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-sm font-bold text-amber-900" data-testid="first-details-note">You can enter TODO here and come back to these fields later</p>
        <div className="flex flex-col gap-5 px-1 py-2">
          <Box id="first-vessel" label="Vessel" value={v.vessel} placeholder="Name..." onChange={set("vessel")} />
          <Box id="first-callsign" label="Callsign" value={v.callsign} placeholder="Call..." onChange={set("callsign")} />
          <Box id="first-phone" type="tel" label="Skipper's phone" value={v.skipper_phone} placeholder="+64 21 555 1234" onChange={set("skipper_phone")} error={phoneErr} />
        </div>
        <button type="button" className="btn-solid h-12 justify-center gap-2" disabled={!ready} onClick={() => onContinue({ vessel: v.vessel.trim(), callsign: v.callsign.trim(), skipper_phone: v.skipper_phone.trim() })} data-testid="first-details-continue-btn">
          Continue to Welcome Screen <ArrowRight className="h-4 w-4" />
        </button>
        {!ready && <p className="text-center text-xs text-[var(--muted)]" data-testid="first-details-hint">Fill in all three to continue (TODO is fine).</p>}
      </DialogContent>
    </Dialog>
  );
};
