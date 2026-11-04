import { useEffect, useState } from "react";

const COLOURS = ["White", "Off-white", "Cream", "Grey", "Silver", "Black", "Navy blue", "Blue", "Light blue", "Green", "Dark green", "Red", "Yellow", "Orange", "Teak"];
const OTHER = "__other";

// Pick a common colour or type your own, e.g. "Navy with gold stripe".
export const ColourField = ({ id, label, value, onChange }) => {
  const [other, setOther] = useState(!!value && !COLOURS.includes(value));
  useEffect(() => { if (value) setOther(!COLOURS.includes(value)); }, [value]);
  const pick = (v) => { setOther(v === OTHER); onChange(v === OTHER ? "" : v); };
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="field-label">{label}</span>
      <select id={id} value={other ? OTHER : value || ""} onChange={(e) => pick(e.target.value)} className="field-input" data-testid={`${id}-select`}>
        <option value="">Choose...</option>
        {COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OTHER}>Other...</option>
      </select>
      {other && <input value={value || ""} maxLength={40} placeholder="e.g. Navy with gold stripe" onChange={(e) => onChange(e.target.value)}
        className="field-input" aria-label={`${label}, your own words`} data-testid={`${id}-other-input`} />}
    </label>
  );
};
