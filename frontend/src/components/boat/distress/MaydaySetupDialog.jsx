import { useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EMAIL_RE } from "@/hooks/useEmailSender";

const real = (v) => { const t = String(v ?? "").trim(); return /^todo$/i.test(t) ? "" : t; };
const OK = {
  vessel: (b) => !!real(b.vessel),
  callsign: (b) => !!real(b.callsign),
  mmsi: (b) => /^\d{9}$/.test(b.mmsi || ""),
  pob: (b) => (b.pob || 0) >= 1,
  shore_name: (b) => !!real(b.shore_name),
  shore_email: (b) => EMAIL_RE.test(real(b.shore_email)),
};
// MAYDAY is set up once the script has everything it needs: name, callsign, MMSI (or none), POB and a shore contact (or none).
export const maydayReady = (b = {}) => OK.vessel(b) && OK.callsign(b) && (b.no_mmsi || OK.mmsi(b)) && OK.pob(b) && (b.no_shore || (OK.shore_name(b) && OK.shore_email(b)));

const Tick = ({ testId }) => <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--green)]" data-testid={testId} />;

// Already filled in: the value and a tick (pencil to change it). Otherwise a box to type it, ticked once it's right.
const SetupField = ({ k, label, boat, onChange, clean = (v) => v, save = (v) => onChange(k, v), input = {} }) => {
  const ok = OK[k](boat);
  const [edit, setEdit] = useState(!ok);
  const [text, setText] = useState(real(boat[k]) ? String(boat[k]) : "");
  const testId = `mayday-setup-${k.replace("_", "-")}`;
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={testId}>
      <label htmlFor={testId} className="field-label">{label}</label>
      {edit ? (
        <div className="flex items-center gap-2">
          <input id={testId} value={text} onChange={(e) => { const v = clean(e.target.value); setText(v); save(v); }} className="field-input min-w-0 flex-1" data-testid={`${testId}-input`} {...input} />
          {ok && <Tick testId={`${testId}-tick`} />}
        </div>
      ) : (
        <div className="flex min-h-11 items-center gap-2">
          <Tick testId={`${testId}-tick`} />
          <b className="min-w-0 truncate" data-testid={`${testId}-value`}>{String(boat[k])}</b>
          <button type="button" onClick={() => setEdit(true)} className="ml-auto rounded p-1.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--navy)]" aria-label={`Change ${label}`} data-testid={`${testId}-change`}>
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const NoneTick = ({ checked, onChange, label, testId }) => (
  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold" data-testid={testId}>
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="h-5 w-5" data-testid={`${testId}-checkbox`} /> {label}
  </label>
);

// Welcome's "Help me set that up": the MAYDAY script with GPS, and just what it needs, saved to Boat details and Additional details.
export const MaydaySetupDialog = ({ boat, lines, onChange, onClose }) => {
  const setPob = (v) => {
    const n = Math.floor(Number(v));
    if (!v || n < 1 || n > 999) return;
    onChange("pob", n); onChange("pob_manual", true);
    if ((boat.children || 0) >= n) onChange("children", n - 1);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border-2 border-[var(--red)]" data-testid="mayday-setup-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Help me set MAYDAY up</DialogTitle>
          <DialogDescription className="text-left text-sm">Your MAYDAY script fills itself in from these and your GPS position. They save to your boat details.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5">
          <SetupField k="vessel" label="Vessel name" boat={boat} onChange={onChange} input={{ maxLength: 60, placeholder: "e.g. Bacchus" }} />
          <SetupField k="callsign" label="Callsign" boat={boat} onChange={onChange} input={{ maxLength: 20, placeholder: "e.g. ZMA1234" }} />
          <div className="flex min-w-0 flex-col gap-1">
            {!boat.no_mmsi && <SetupField k="mmsi" label="MMSI" boat={boat} onChange={onChange} clean={(v) => v.replace(/\D/g, "").slice(0, 9)} input={{ inputMode: "numeric", placeholder: "9 digits", className: "field-input min-w-0 flex-1 font-mono" }} />}
            <NoneTick checked={!!boat.no_mmsi} onChange={(v) => onChange("no_mmsi", v)} label="No MMSI" testId="mayday-setup-no-mmsi" />
          </div>
          <SetupField k="pob" label="Persons on board (POB)" boat={boat} onChange={onChange} save={setPob} clean={(v) => v.replace(/\D/g, "").slice(0, 3)} input={{ inputMode: "numeric", placeholder: "e.g. 4" }} />
        </div>
        <ol className="flex list-decimal flex-col gap-1 rounded-md border-2 border-[var(--red)] bg-red-50 py-3 pl-8 pr-3 text-sm" data-testid="mayday-setup-script">
          {lines.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
        <div className="flex flex-col gap-2" data-testid="mayday-setup-shore">
          <span className="field-label">Shore contact</span>
          {!boat.no_shore && (
            <div className="grid grid-cols-2 gap-2.5">
              <SetupField k="shore_name" label="Shore contact name" boat={boat} onChange={onChange} input={{ maxLength: 60, placeholder: "Their name" }} />
              <SetupField k="shore_email" label="Shore contact email" boat={boat} onChange={onChange} clean={(v) => v.slice(0, 254)} input={{ type: "email", placeholder: "shore@email.com" }} />
            </div>
          )}
          <NoneTick checked={!!boat.no_shore} onChange={(v) => onChange("no_shore", v)} label="No shore contact" testId="mayday-setup-no-shore" />
        </div>
        <p className={`flex items-center gap-2 text-sm font-bold ${maydayReady(boat) ? "text-emerald-800" : "text-[var(--muted)]"}`} data-testid="mayday-setup-status">
          {maydayReady(boat) ? <><Tick testId="mayday-setup-ready-tick" /> MAYDAY is set up</> : "Fill in anything without a tick to finish setting MAYDAY up."}
        </p>
        <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="mayday-setup-done-btn">Done</button>
      </DialogContent>
    </Dialog>
  );
};
