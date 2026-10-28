import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BOAT_TYPES = ["Yacht - Sloop", "Yacht - Cutter Rigged", "Yacht - Ketch", "Yacht - Yawl", "Yacht - Schooner", "Catamaran", "Trimaran", "Trawler", "Motor Cruiser", "Launch", "Runabout", "RIB"];
const OTHER = "__other";
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const crewSplit = (boat) => {
  const pob = boat.pob || 1;
  const children = Math.min(boat.children || 0, pob);
  return { pob, children, adults: pob - children };
};
export const pobText = (boat) => {
  const { pob, children, adults } = crewSplit(boat);
  return children ? `${pob} POB (${plural(adults, "adult", "adults")}, ${plural(children, "child", "children")})` : `${pob} POB`;
};

const BoatTypeField = ({ value, onChange }) => {
  const [other, setOther] = useState(!!value && !BOAT_TYPES.includes(value));
  useEffect(() => { if (value) setOther(!BOAT_TYPES.includes(value)); }, [value]);
  const pick = (v) => { setOther(v === OTHER); onChange(v === OTHER ? "" : v); };
  return (
    <label htmlFor="boat-type" className="flex min-w-0 flex-col gap-1">
      <span className="field-label">Boat type</span>
      <select id="boat-type" value={other ? OTHER : value || ""} onChange={(e) => pick(e.target.value)} className="field-input" data-testid="boat-type-select">
        <option value="">Choose...</option>
        {BOAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        <option value={OTHER}>Other...</option>
      </select>
      {other && <input value={value} maxLength={60} placeholder="e.g. Gaff Cutter" onChange={(e) => onChange(e.target.value)} className="field-input" aria-label="Your boat type" data-testid="boat-type-other-input" />}
    </label>
  );
};

// Whole-number box that only saves valid values and snaps back on blur.
const IntField = ({ id, label, value, min, max, onChange, placeholder }) => {
  const [text, setText] = useState(value === "" || value == null ? "" : String(value));
  useEffect(() => setText(value === "" || value == null ? "" : String(value)), [value]);
  const set = (raw) => {
    setText(raw);
    if (raw === "" && min === 0) { onChange(0); return; }
    const n = Math.floor(Number(raw));
    if (raw !== "" && n >= min && n <= max) onChange(n);
  };
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="field-label">{label}</span>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} step="1" value={text} placeholder={placeholder} data-testid={`${id}-input`} className="field-input"
        onChange={(e) => set(e.target.value)} onBlur={() => setText(value === "" || value == null || (min === 0 && !value) ? "" : String(value))} />
    </label>
  );
};

const DIM_RE = /^\d{0,4}([.,]\d{0,2})?$/;
const DimField = ({ id, label, value, unit, onChange }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
    <span className="field-label">{label}</span>
    <span className="relative">
      <input id={id} type="text" inputMode="decimal" value={value || ""} placeholder="Optional" data-testid={`${id}-input`} className="field-input w-full pr-9"
        onChange={(e) => DIM_RE.test(e.target.value) && onChange(e.target.value.replace(",", "."))} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">{unit}</span>
    </span>
  </label>
);

const UnitToggle = ({ value, onChange }) => (
  <div className="flex items-center justify-between gap-2" role="radiogroup" aria-label="Measurement units">
    <span className="field-label">Measurements in</span>
    <div className="flex overflow-hidden rounded-md border-[1.5px] border-[var(--line)]">
      {[["m", "Metres"], ["ft", "Feet"]].map(([u, text]) => (
        <button key={u} type="button" role="radio" aria-checked={value === u} onClick={() => onChange(u)} data-testid={`boat-units-${u}`}
          className={`h-9 px-3 text-sm font-bold [transition:background-color_.15s] ${value === u ? "bg-[var(--navy)] text-white" : "bg-white"}`}>{text}</button>
      ))}
    </div>
  </div>
);

export const AdditionalDetailsDialog = ({ open, boat, onChange, onClose }) => {
  const { pob, children, adults } = crewSplit(boat);
  const unit = boat.units === "ft" ? "ft" : "m";
  const setPob = (n) => { onChange("pob", n); if ((boat.children || 0) >= n) onChange("children", n - 1); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" data-testid="additional-details-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Boat details - Additional details</DialogTitle>
          <DialogDescription className="text-left text-sm">All optional. Boat type and people on board fill in your Mayday and Pan-Pan calls.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5">
          <BoatTypeField value={boat.boat_type || ""} onChange={(v) => onChange("boat_type", v)} />
          <IntField id="pob" label="Persons on board" value={pob} min={1} max={999} onChange={setPob} />
          <IntField id="children" label="Children" value={children || ""} min={0} max={Math.max(0, pob - 1)} placeholder="None" onChange={(n) => onChange("children", n)} />
          <div className="flex min-w-0 flex-col justify-end gap-1 pb-2" data-testid="pob-split">
            <span className="text-sm"><b data-testid="pob-adults">{adults}</b> {adults === 1 ? "adult" : "adults"}</span>
            <span className="text-sm text-[var(--muted)]"><b data-testid="pob-children">{children}</b> {children === 1 ? "child" : "children"}</span>
          </div>
          <label htmlFor="mmsi" className="col-span-2 flex min-w-0 flex-col gap-1">
            <span className="field-label">MMSI number</span>
            <input id="mmsi" type="text" inputMode="numeric" maxLength={9} value={boat.mmsi || ""} placeholder="9 digits, optional" data-testid="mmsi-input" className="field-input font-mono"
              onChange={(e) => onChange("mmsi", e.target.value.replace(/\D/g, "").slice(0, 9))} />
            {boat.mmsi && boat.mmsi.length !== 9 && <span className="text-xs font-bold text-[var(--red)]" data-testid="mmsi-warning">An MMSI number has 9 digits</span>}
          </label>
          <div className="col-span-2"><UnitToggle value={unit} onChange={(u) => onChange("units", u)} /></div>
          <DimField id="loa" label="LOA (length)" value={boat.loa} unit={unit} onChange={(v) => onChange("loa", v)} />
          <DimField id="beam" label="Beam" value={boat.beam} unit={unit} onChange={(v) => onChange("beam", v)} />
          <DimField id="draft" label="Draft" value={boat.draft} unit={unit} onChange={(v) => onChange("draft", v)} />
          <DimField id="mast-height" label="Mast height" value={boat.mast_height} unit={unit} onChange={(v) => onChange("mast_height", v)} />
          <IntField id="trip-days" label="Trip duration (days)" value={boat.trip_days || ""} min={0} max={365} placeholder="Optional" onChange={(n) => onChange("trip_days", n)} />
        </div>
        <button type="button" className="btn-solid h-11 justify-center" onClick={onClose} data-testid="additional-details-done-btn">Done</button>
      </DialogContent>
    </Dialog>
  );
};
