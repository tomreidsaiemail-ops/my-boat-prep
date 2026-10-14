const Field = ({ id, label, value, onChange, placeholder, className }) => (
  <label htmlFor={id} className={`flex flex-col gap-1 ${className}`}>
    <span className="field-label">{label}</span>
    <input
      id={id}
      data-testid={`${id}-input`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="field-input"
      autoComplete="off"
    />
  </label>
);

export const BoatDetails = ({ boat, onChange, shortDate }) => (
  <section className="grid grid-cols-6 gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="boat-details-bar">
    <Field id="vessel" label="Vessel" value={boat.vessel} placeholder="Name..." onChange={(v) => onChange("vessel", v)} className="col-span-6 sm:col-span-3" />
    <Field id="skipper" label="Skipper" value={boat.skipper} placeholder="Name..." onChange={(v) => onChange("skipper", v)} className="col-span-3 sm:col-span-3" />
    <Field id="callsign" label="Callsign" value={boat.callsign} placeholder="Call..." onChange={(v) => onChange("callsign", v)} className="col-span-3 sm:col-span-3" />
    <div className="col-span-6 flex flex-col gap-1 sm:col-span-3">
      <span className="field-label">Date</span>
      <div className="flex h-12 items-center rounded-md bg-[var(--navy)] px-3 font-mono text-base font-bold text-white" data-testid="date-display">{shortDate}</div>
    </div>
  </section>
);
