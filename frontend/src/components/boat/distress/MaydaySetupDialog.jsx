import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EMAIL_RE } from "@/hooks/useEmailSender";
import { BoatTypeField } from "@/components/boat/AdditionalDetailsDialog";
import { COLOURS } from "@/components/boat/telemetry/ColourField";

const real = (v) => { const t = String(v ?? "").trim(); return /^todo$/i.test(t) ? "" : t; };
const has = (k) => (b) => !!real(b[k]);
const OK = {
  vessel: has("vessel"), callsign: has("callsign"), boat_type: has("boat_type"), hull_colour: has("hull_colour"), deck_colour: has("deck_colour"), shore_name: has("shore_name"),
  mmsi: (b) => /^\d{9}$/.test(b.mmsi || ""),
  pob: (b) => (b.pob || 0) >= 1,
  shore_email: (b) => EMAIL_RE.test(real(b.shore_email)),
};
// MAYDAY is set up once the script has everything it needs: name, callsign, MMSI (or none), POB, boat type, both colours and a shore contact (or none).
export const maydayReady = (b = {}) => ["vessel", "callsign", "pob", "boat_type", "hull_colour", "deck_colour"].every((k) => OK[k](b))
  && (b.no_mmsi || OK.mmsi(b)) && (b.no_shore || (OK.shore_name(b) && OK.shore_email(b)));

// The MAYDAY lines each detail fills in, lit yellow for 5 seconds when it's entered or ticked.
const LINES = {
  vessel: ["maydayVessel", "maydayVesselCallsign"], callsign: ["maydayCallsign", "maydayVesselCallsign"], mmsi: ["maydayCallsign", "mmsi"],
  pob: ["pobDescription"], boat_type: ["pobDescription"], hull_colour: ["pobDescription"], deck_colour: ["pobDescription"],
};
const lineKey = (l) => l.dynamic || (/mmsi/i.test(l.label || "") ? "mmsi" : "");

const Tick = ({ testId }) => <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--green)]" data-testid={testId} />;
const tid = (k) => `mayday-setup-${k.replace(/_/g, "-")}`;

// Filled in: the value and a tick, with a pencil to change it.
const Shown = ({ k, label, value, onEdit }) => (
  <div className="flex min-w-0 flex-col gap-1" data-testid={tid(k)}>
    <span className="field-label">{label}</span>
    <div className="flex min-h-11 items-center gap-2">
      <Tick testId={`${tid(k)}-tick`} />
      <b className="min-w-0 truncate" data-testid={`${tid(k)}-value`}>{value}</b>
      <button type="button" onClick={onEdit} className="ml-auto rounded p-1.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--navy)]" aria-label={`Change ${label}`} data-testid={`${tid(k)}-change`}>
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// Already filled in: shown with a tick. Otherwise a box to type it, ticked once it's right.
const SetupField = ({ k, label, boat, onChange, clean = (v) => v, save = (v) => onChange(k, v), input = {} }) => {
  const ok = OK[k](boat);
  const [edit, setEdit] = useState(!ok);
  const [text, setText] = useState(real(boat[k]) ? String(boat[k]) : "");
  if (!edit) return <Shown k={k} label={label} value={String(boat[k])} onEdit={() => setEdit(true)} />;
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={tid(k)}>
      <label htmlFor={tid(k)} className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <input id={tid(k)} value={text} onChange={(e) => { const v = clean(e.target.value); setText(v); save(v); }} className="field-input min-w-0 flex-1" data-testid={`${tid(k)}-input`} {...input} />
        {ok && <Tick testId={`${tid(k)}-tick`} />}
      </div>
    </div>
  );
};

const BoatTypeSetup = ({ boat, onChange }) => {
  const [edit, setEdit] = useState(!OK.boat_type(boat));
  if (!edit) return <Shown k="boat_type" label="Boat type" value={boat.boat_type} onEdit={() => setEdit(true)} />;
  return (
    <div className="flex min-w-0 items-end gap-2" data-testid={tid("boat_type")}>
      <div className="min-w-0 flex-1"><BoatTypeField value={boat.boat_type || ""} onChange={(v) => onChange("boat_type", v)} /></div>
      {OK.boat_type(boat) && <Tick testId={`${tid("boat_type")}-tick`} />}
    </div>
  );
};

// White to start with: Confirm it, or pick the boat's colour.
const ColourSetup = ({ k, label, boat, onChange }) => {
  const [edit, setEdit] = useState(!OK[k](boat));
  const [pick, setPick] = useState(real(boat[k]) || "White");
  if (!edit) return <Shown k={k} label={label} value={boat[k]} onEdit={() => setEdit(true)} />;
  const ok = OK[k](boat);
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={tid(k)}>
      <label htmlFor={tid(k)} className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <select id={tid(k)} value={pick} onChange={(e) => { setPick(e.target.value); onChange(k, e.target.value); }} className="field-input min-w-0 flex-1" data-testid={`${tid(k)}-select`}>
          {[...(COLOURS.includes(pick) ? [] : [pick]), ...COLOURS].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {ok ? <Tick testId={`${tid(k)}-tick`} />
          : <button type="button" onClick={() => onChange(k, pick)} className="btn-solid h-11 shrink-0 px-3 !border-2 !border-yellow-500 !bg-yellow-300 !text-[var(--navy)] hover:!bg-yellow-400" data-testid={`${tid(k)}-confirm`}>Confirm</button>}
      </div>
    </div>
  );
};

const NoneTick = ({ checked, onChange, label, testId }) => (
  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold" data-testid={testId}>
    <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="h-5 w-5" data-testid={`${testId}-checkbox`} /> {label}
  </label>
);

// Lines lit for 5 seconds; entering the same detail again restarts its 5 seconds.
const useLit = () => {
  const [lit, setLit] = useState({});
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const flash = (k) => {
    setLit((s) => ({ ...s, [k]: true }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(() => setLit((s) => ({ ...s, [k]: false })), 5000);
  };
  return [lit, flash];
};

// Welcome's "Help me set that up": the MAYDAY script with GPS, and just what it needs, saved to Boat details and Additional details.
// lines: the MAYDAY list as { text, dynamic, label }.
export const MaydaySetupDialog = ({ boat, lines, onChange, onClose }) => {
  const [lit, flash] = useLit();
  const change = (k, v) => {
    onChange(k, v);
    const key = k === "no_mmsi" ? "mmsi" : k;
    if (LINES[key] && (k === "no_mmsi" ? v : OK[k]({ ...boat, [k]: v }))) flash(key);
  };
  const glowing = (l) => Object.keys(lit).some((k) => lit[k] && LINES[k].includes(lineKey(l)));
  const setPob = (v) => {
    const n = Math.floor(Number(v));
    if (!v || n < 1 || n > 999) return;
    change("pob", n); onChange("pob_manual", true);
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
          <SetupField k="vessel" label="Vessel name" boat={boat} onChange={change} input={{ maxLength: 60, placeholder: "e.g. Bacchus" }} />
          <SetupField k="callsign" label="Callsign" boat={boat} onChange={change} input={{ maxLength: 20, placeholder: "e.g. ZMA1234" }} />
          <div className="flex min-w-0 flex-col gap-1">
            {!boat.no_mmsi && <SetupField k="mmsi" label="MMSI" boat={boat} onChange={change} clean={(v) => v.replace(/\D/g, "").slice(0, 9)} input={{ inputMode: "numeric", placeholder: "9 digits", className: "field-input min-w-0 flex-1 font-mono" }} />}
            <NoneTick checked={!!boat.no_mmsi} onChange={(v) => change("no_mmsi", v)} label="No MMSI" testId="mayday-setup-no-mmsi" />
          </div>
          <SetupField k="pob" label="Persons on board (POB)" boat={boat} onChange={change} save={setPob} clean={(v) => v.replace(/\D/g, "").slice(0, 3)} input={{ inputMode: "numeric", placeholder: "e.g. 4" }} />
          <div className="col-span-2"><BoatTypeSetup boat={boat} onChange={change} /></div>
          <ColourSetup k="hull_colour" label="Hull colour" boat={boat} onChange={change} />
          <ColourSetup k="deck_colour" label="Deck colour" boat={boat} onChange={change} />
        </div>
        <ol className="flex list-decimal flex-col gap-1 rounded-md border-2 border-[var(--red)] bg-red-50 py-3 pl-8 pr-3 text-sm" data-testid="mayday-setup-script">
          {lines.map((l, i) => (
            <li key={i} className={`rounded px-1 transition-colors ${glowing(l) ? "mbp-glow" : ""}`} data-testid={`mayday-setup-line-${i + 1}`} data-lit={glowing(l)}>{l.text}</li>
          ))}
        </ol>
        <div className="flex flex-col gap-2" data-testid="mayday-setup-shore">
          <span className="field-label">Shore contact</span>
          {!boat.no_shore && (
            <div className="grid grid-cols-2 gap-2.5">
              <SetupField k="shore_name" label="Shore contact name" boat={boat} onChange={change} input={{ maxLength: 60, placeholder: "Their name" }} />
              <SetupField k="shore_email" label="Shore contact email" boat={boat} onChange={change} clean={(v) => v.slice(0, 254)} input={{ type: "email", placeholder: "shore@email.com" }} />
            </div>
          )}
          <NoneTick checked={!!boat.no_shore} onChange={(v) => change("no_shore", v)} label="No shore contact" testId="mayday-setup-no-shore" />
        </div>
        <p className={`flex items-center gap-2 text-sm font-bold ${maydayReady(boat) ? "text-emerald-800" : "text-[var(--muted)]"}`} data-testid="mayday-setup-status">
          {maydayReady(boat) ? <><Tick testId="mayday-setup-ready-tick" /> MAYDAY is set up</> : "Fill in or confirm anything without a tick to finish setting MAYDAY up."}
        </p>
        <button type="button" className="btn-solid h-12 justify-center" onClick={onClose} data-testid="mayday-setup-done-btn">Done</button>
      </DialogContent>
    </Dialog>
  );
};
