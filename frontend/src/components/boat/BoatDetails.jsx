import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ChevronUp, Fish, Home, Martini, Ship, Sparkles } from "lucide-react";
import { ArrangeIcon } from "@/components/boat/ArrangeIcon";
import { SpeakButton } from "@/components/boat/voice/SpeakButton";
import { EMAIL_RE } from "@/hooks/useEmailSender";
import { AdditionalDetailsDialog, pobText } from "@/components/boat/AdditionalDetailsDialog";
import { ZoneSchematicsDialog } from "@/components/boat/zone/ZoneSchematicsDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { RESUME_ZONE, identityFull, onAskDetailsForZone } from "@/components/boat/zone/CreateOverviewButton";

const petCount = (boat) => (boat.pets || []).filter((p) => p.type?.trim() || p.name?.trim()).length;

const MoreButton = ({ boat, onClick, btnRef }) => (
  <button type="button" ref={btnRef} onClick={onClick} data-testid="additional-details-btn"
    className="col-span-2 flex min-h-[44px] w-full items-center gap-2 rounded-md border-[1.5px] border-dashed border-[var(--line)] px-3 text-left [transition:border-color_.15s] hover:border-[var(--navy)]">
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold">Additional boat details...</span>
      <span className="block truncate text-xs text-[var(--muted)]" data-testid="additional-details-summary">{[boat.boat_type, [boat.make, boat.model].filter((x) => x?.trim()).join(" "), pobText(boat), boat.mmsi?.length === 9 && `MMSI ${boat.mmsi}`, petCount(boat) && `${petCount(boat)} ${petCount(boat) === 1 ? "pet" : "pets"}`].filter(Boolean).join(" · ")}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)]" />
  </button>
);

const Field = ({ id, label, value, onChange, onBlur, placeholder, type = "text" }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
    <span className="field-label">{label}</span>
    <input
      id={id}
      type={type}
      data-testid={`${id}-input`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
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

export const BoatDetails = ({ boat, onChange, onBatchScan, onOrganise, onHome, onFish, onBartender, speak, onMakeKit, onDetailsClosed, onMaintSetup, zone }) => {
  const complete = !!(boat.vessel.trim() && boat.callsign.trim() && boat.skipper.trim() && EMAIL_RE.test((boat.log_email || "").trim()));
  const [open, setOpen] = useState(!complete);
  const [more, setMore] = useState(false);
  const [plans, setPlans] = useState(false);
  const [ask, setAsk] = useState(false);
  const creating = useRef(false);
  const moreRef = useRef(null);
  useEffect(() => {
    const show = () => { setOpen(true); setMore(true); };
    window.addEventListener("mbp:open-details", show);
    return () => window.removeEventListener("mbp:open-details", show);
  }, []);
  const ready = !!(boat.make?.trim() && boat.model?.trim() && /^\d{4}$/.test(boat.year_built || ""));
  // A boat that has a name never loses it: leaving the Vessel field blank puts the last name back.
  const lastName = useRef("");
  if (boat.vessel?.trim()) lastName.current = boat.vessel;
  const keepName = () => {
    if (boat.vessel?.trim() || !lastName.current) return;
    onChange("vessel", lastName.current);
    toast.info(`Every boat needs a name, so ${lastName.current} was put back`);
  };
  // Closing without a zone map: remind once per close; "Not now" carries on as before.
  // Opened by "Create Zone Map Overview (Schematic)": go back to it once the boat details are filled in.
  const forZone = useRef(false);
  useEffect(() => onAskDetailsForZone(() => { forZone.current = true; setMore(true); }), []);
  const closeMore = () => {
    setMore(false);
    if (forZone.current) {
      forZone.current = false;
      if (identityFull(boat)) setTimeout(() => window.dispatchEvent(new Event(RESUME_ZONE)), 300);
      else toast.message("Add the boat type, make, model and year of manufacture to create a Zone Map Overview");
      return;
    }
    if (zone && !zone.count && ready) setAsk(true); else onDetailsClosed?.();
  };
  const plansDone = (maps) => { zone.onMaps(maps); setPlans(false); setMore(false); zone.onShow(); };
  const dialog = <>
    <AdditionalDetailsDialog open={more} boat={boat} onChange={onChange} onClose={closeMore} returnFocus={moreRef} onMakeKit={onMakeKit}
      onMaintSetup={onMaintSetup && (() => { setMore(false); onMaintSetup(); })} zoneDone={!!zone?.coloured} onZoneMap={zone && (() => (zone.premium ? setPlans(true) : zone.onUpgrade()))} />
    {zone && <ZoneSchematicsDialog open={plans} boat={boat} boatId={zone.boatId} online={zone.online} onDone={plansDone} onClose={() => setPlans(false)} />}
    <ConfirmDelete item={ask ? [1] : null} danger={false} title="Create a zone map?" confirmLabel="Create zone map" cancelLabel="Not now" testId="zone-map-ask"
      note={`Your boat doesn't have a zone map yet. The Magic Mariner can draw layout plans of a ${[boat.make, boat.model].filter(Boolean).join(" ")} for you to start from.`}
      onConfirm={() => { creating.current = true; setAsk(false); setMore(true); setPlans(true); }}
      onClose={() => { setAsk(false); if (!creating.current) onDetailsClosed?.(); creating.current = false; }} />
  </>;
  const focused = useRef(false);
  useEffect(() => { if (complete && !focused.current) setOpen(false); }, [complete]);
  const onBlur = (e) => {
    if (more || e.currentTarget.contains(e.relatedTarget)) return;
    focused.current = false;
    if (complete) setOpen(false);
  };
  const pill = "btn-ghost h-auto min-h-11 min-w-0 gap-2 px-3 py-2 !text-left text-[13px] font-bold leading-tight";
  const magicIcon = "btn-ghost h-11 min-h-11 w-11 shrink-0 justify-center p-0";
  const batchBtn = (onBatchScan || onOrganise) && (
    <div className="flex flex-nowrap items-center gap-1" data-testid="boat-details-magic-row">
      {onBatchScan && <button type="button" onClick={onBatchScan} className={pill} title="Take the photos and Magic Scan tells you what is in them" data-testid="boat-details-batch-scan-btn">
        <Sparkles className="h-4 w-4 shrink-0" /> <span>Batch<br /><span className="whitespace-nowrap">Magic Scan...</span></span>
      </button>}
      {onBatchScan && speak && <SpeakButton plan={speak.plan} onConfirm={speak.onConfirm} className={`${pill} mr-1`} testId="home-speak" />}
      {onOrganise && <button type="button" onClick={onOrganise} className={pill} data-testid="boat-details-organise-btn">
        <ArrangeIcon /> <span>Lists</span>
      </button>}
      {onHome && <button type="button" onClick={onHome} className={magicIcon} title="Home (Boat Inventory)" aria-label="Home (Boat Inventory)" data-testid="boat-details-home-btn"><Home className="h-5 w-5" /></button>}
      {onFish && <button type="button" onClick={onFish} className={magicIcon} title="Magic Fish Whisperer" aria-label="Magic Fish Whisperer" data-testid="boat-details-fish-btn"><Fish className="h-5 w-5" /></button>}
      {onBartender && <button type="button" onClick={onBartender} className={magicIcon} title="Magic Bartender" aria-label="Magic Bartender" data-testid="boat-details-bartender-btn"><Martini className="h-5 w-5" /></button>}
    </div>
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
        <Field id="vessel" label="Vessel" value={boat.vessel} placeholder="Name..." onChange={(v) => onChange("vessel", v)} onBlur={keepName} />
        <Field id="callsign" label="Callsign" value={boat.callsign} placeholder="Call..." onChange={(v) => onChange("callsign", v)} />
        <Field id="skipper" label="Skipper" value={boat.skipper} placeholder="Name..." onChange={(v) => onChange("skipper", v)} />
        <Field id="email" type="email" label="Email" value={boat.log_email || ""} placeholder="you@email.com" onChange={(v) => onChange("log_email", v)} />
        <Field id="shore-contact-email" type="email" label="Shore contact email" value={boat.shore_email || ""} placeholder="shore@email.com" onChange={(v) => onChange("shore_email", v.slice(0, 254))} />
        <Field id="skipper-phone" type="tel" label="Skipper's phone" value={boat.skipper_phone || ""} placeholder="+64 21 555 1234" onChange={(v) => onChange("skipper_phone", v.slice(0, 30))} />
        <MoreButton boat={boat} btnRef={moreRef} onClick={() => setMore(true)} />
      </div>
      {batchBtn}
    </section>
    {dialog}
    </>
  );
};
