const FULL = new Set(["name", "email", "allergies", "food", "comments", "nok_name", "nok_email"]);

export const RegFields = ({ fields, values, onChange, required = [], errors = [], testPrefix }) => (
  <div className="grid grid-cols-2 gap-x-2 gap-y-3" data-testid={`${testPrefix}-fields`}>
    {fields.map(({ k, label, type = "text", max, area, placeholder }) => {
      const bad = errors.includes(k);
      const cls = `field-input w-full text-base normal-case tracking-normal ${bad ? "!border-[var(--red)]" : ""}`;
      const props = { id: `${testPrefix}-${k}`, value: values[k] ?? "", maxLength: max, placeholder, onChange: (e) => onChange(k, e.target.value), "data-testid": `${testPrefix}-${k}-input`, "aria-invalid": bad };
      return (
        <label key={k} className={`flex min-w-0 flex-col gap-1.5 ${FULL.has(k) ? "col-span-2" : ""}`} htmlFor={props.id}>
          <span className="field-label">{label}{required.includes(k) && <span className="text-[var(--red)]"> *</span>}</span>
          {area ? <textarea {...props} rows={2} className={`${cls} h-auto resize-y py-2 leading-snug`} />
            : <input {...props} type={type} autoComplete="off" inputMode={type === "number" ? "decimal" : type === "tel" ? "tel" : type === "email" ? "email" : undefined}
                min={type === "number" ? 1 : undefined} max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined} className={cls} />}
        </label>
      );
    })}
  </div>
);
