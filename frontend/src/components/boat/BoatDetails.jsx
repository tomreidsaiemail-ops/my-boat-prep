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

export const BoatDetails = ({ boat, onChange }) => (
  <section className="grid grid-cols-2 gap-2.5 rounded-lg border-[1.5px] border-[var(--line)] bg-white p-3" data-testid="boat-details-bar">
    <Field id="vessel" label="Vessel" value={boat.vessel} placeholder="Name..." onChange={(v) => onChange("vessel", v)} />
    <Field id="callsign" label="Callsign" value={boat.callsign} placeholder="Call..." onChange={(v) => onChange("callsign", v)} />
    <Field id="skipper" label="Skipper" value={boat.skipper} placeholder="Name..." onChange={(v) => onChange("skipper", v)} />
    <Field id="email" type="email" label="Email" value={boat.log_email || ""} placeholder="you@email.com" onChange={(v) => onChange("log_email", v)} />
  </section>
);
