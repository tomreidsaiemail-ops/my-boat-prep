const NUM_RE = /^\d{0,5}([.,]\d{0,2})?$/;

// Small number box with a unit, used across the tank set-up.
export const NumField = ({ id, label, value, unit, placeholder = "0", onChange }) => (
  <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
    <span className="field-label">{label}</span>
    <span className="relative">
      <input id={id} type="text" inputMode="decimal" value={value || ""} placeholder={placeholder} data-testid={`${id}-input`} className={`field-input w-full ${unit ? "pr-10" : ""}`}
        onChange={(e) => NUM_RE.test(e.target.value) && onChange(e.target.value.replace(",", "."))} />
      {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">{unit}</span>}
    </span>
  </label>
);
