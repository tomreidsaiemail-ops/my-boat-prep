import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Ship, Sparkles } from "lucide-react";
import { EMAIL_RE } from "@/hooks/useEmailSender";
import { AdditionalDetailsDialog, pobText } from "@/components/boat/AdditionalDetailsDialog";

const MoreButton = ({ boat, onClick, btnRef }) => (
  <button type="button" ref={btnRef} onClick={onClick} data-testid="additional-details-btn"
    className="col-span-2 flex min-h-[44px] w-full items-center gap-2 rounded-md border-[1.5px] border-dashed border-[var(--line)] px-3 text-left [transition:border-color_.15s] hover:border-[var(--navy)]">
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold">Additional boat details...</span>
      <span className="block truncate text-xs text-[var(--muted)]" data-testid="additional-details-summary">{[boat.boat_type, pobText(boat), boat.mmsi?.length === 9 && `MMSI ${boat.mmsi}`].filter(Boolean).join(" · ")}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)]" />
  </button>
);

const Field = ({ id, label, value, onChange, placeholder, type = "text" }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
    <span className="field-label">{label}</span>
    <input
      id={id}
      type={type}
      data-testid={`${id}-input`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="field-input"
      autoComplete="off"
    />
  </label>
);

const Summary = ({ boat, onExpand }) => (
  <button type="button" onClick={onExpand} data-testid="boat-details-summary" aria-expanded="false" aria-label="Show boat details"
    className="flex min-h-[48px] w-full items-center gap-3 rounded-lg border-[1.5px] border-[var(--line)] bg-white px-3 text-left [transition:border-color_.15s] hover:border-[var(--navy)]">
    <Ship className="h-5 w-5 shrink-0 text-[var(--navy)]" />
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="field-label shrink-0">Vessel</span><b className="min-w-0 truncate" data-testid="summary-vessel">{boat.vessel}</b>
      <span className="field-label ml-2 shrink-0">Callsign</span><b className="shrink-0 font-mono" data-testid="summary-callsign">{boat.callsign}</b>
    </span>
    <ChevronDown className="h-5 w-5 shrink-0 text-[var(--muted)]" data-testid="boat-details-expand-btn" />
  </button>
);

export const BoatDetails = ({ boat, onChange, onBatchScan }) => {
  const complete = !!(boat.vessel.trim() && boat.callsign.trim() && boat.skipper.trim() && EMAIL_RE.test((boat.log_email || "").trim()));
  const [open, setOpen] = useState(!complete);
  const [more, setMore] = useState(false);
  const moreRef = useRef(null);
  const dialog = <AdditionalDetailsDialog open={more} boat={boat} onChange={onChange} onClose={() => setMore(false)} returnFocus={moreRef} />;
  const focused = useRef(false);
  useEffect(() => { if (complete && !focused.current) setOpen(false); }, [complete]);
  const onBlur = (e) => {
    if (more || e.currentTarget.contains(e.relatedTarget)) return;
    focused.current = false;
    if (complete) setOpen(false);
  };
  const batchBtn = onBatchScan && (
    <button type="button" onClick={onBatchScan} className="btn-ghost h-auto min-h-11 w-full !justify-start gap-3 px-4 py-2.5 !text-left text-sm font-semibold leading-snug" data-testid="boat-details-batch-scan-btn">
      <Sparkles className="h-4 w-4 shrink-0" /> <span>On the boat? Want you and your crew to find absolutely anything on it instantly? Take a Boat Inventory using Batch Magic Scan... you take the photos, and Magic Scan tells you what is in them. "Easy as" Just click here!</span>
    </button>
  );

  if (complete && !open) return <><div className="flex flex-col gap-2"><Summary boat={boat} onExpand={() => setOpen(true)} />{batchBtn}</div>{dialog}</>;
  return (
    <>
    <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="boat-details-bar"
      onFocus={() => { focused.current = true; }} onBlur={onBlur}>
      {complete && (
        <button type="button" onClick={() => setOpen(false)} data-testid="boat-details-collapse-btn" aria-expanded="true"
          className="-mt-1 flex min-h-[36px] items-center justify-between text-[var(--muted)] hover:text-[var(--navy)]">
          <span className="field-label">Boat details</span><ChevronUp className="h-5 w-5" />
        </button>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Field id="vessel" label="Vessel" value={boat.vessel} placeholder="Name..." onChange={(v) => onChange("vessel", v)} />
        <Field id="callsign" label="Callsign" value={boat.callsign} placeholder="Call..." onChange={(v) => onChange("callsign", v)} />
        <Field id="skipper" label="Skipper" value={boat.skipper} placeholder="Name..." onChange={(v) => onChange("skipper", v)} />
        <Field id="email" type="email" label="Email" value={boat.log_email || ""} placeholder="you@email.com" onChange={(v) => onChange("log_email", v)} />
        <MoreButton boat={boat} btnRef={moreRef} onClick={() => setMore(true)} />
      </div>
      {batchBtn}
    </section>
    {dialog}
    </>
  );
};
