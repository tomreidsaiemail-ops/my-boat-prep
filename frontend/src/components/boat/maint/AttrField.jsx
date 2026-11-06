import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AttrFile } from "@/components/boat/maint/AttrFile";
import { PURCHASE_KEY, UNITS, defaultUnit } from "@/lib/maint";

const NUM = { integer: /^-?\d{0,8}$/, "integer age": /^\d{0,3}$/ };
const DEC = /^\d{0,6}([.,]\d{0,2})?$/;
const SIGNED = { decimal: /^-?\d{0,6}([.,]\d{0,2})?$/, "decimal cost": /^-?\d{0,6}([.,]\d{0,2})?$/ };
const URL_RE = /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]+$/i;

const BlurInput = ({ value, onSave, filter, ...rest }) => {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  return (
    <input value={v} onChange={(e) => (!filter || filter.test(e.target.value)) && setV(e.target.value)} className="field-input h-10 w-0 min-w-0 flex-1 !text-sm"
      onBlur={() => { const next = v.trim().replace(/^(\d+),(\d*)$/, "$1.$2"); if (next !== (value || "")) onSave(next); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} {...rest} />
  );
};

const Control = ({ def, attrs, onChange, ctx, testId }) => {
  const value = attrs[def.key] || "";
  const set = (v) => onChange({ [def.key]: v });
  const dis = ctx.readOnly;
  if (def.type === "date" && def.key === PURCHASE_KEY && attrs[`${PURCHASE_KEY}__default`]) return (
    <span className="flex flex-col gap-0.5">
      <input type="date" value={value} disabled={dis} onChange={(e) => set(e.target.value)} className="field-input h-10 !text-sm italic text-slate-500" data-testid={testId} />
      <span className="text-[10px] font-bold text-[var(--muted)]" data-testid={`${testId}-default`}>From Year of manufacture</span>
    </span>
  );
  if (def.type === "date") return <input type="date" value={value} disabled={dis} onChange={(e) => set(e.target.value)} className="field-input h-10 !text-sm" data-testid={testId} />;
  if (def.type === "integer age") return (
    <output className="field-input flex h-10 items-center bg-slate-50 !text-sm" aria-readonly="true" title="Worked out from Purchase Date" data-testid={testId}>
      {value !== "" ? `${value} years old` : <span className="text-slate-400">Set Purchase Date</span>}
    </output>
  );
  if (def.type === "picklist") {
    const options = value && !def.options.includes(value) ? [value, ...def.options] : def.options;
    return (
      <select value={value} disabled={dis} onChange={(e) => set(e.target.value)} className="field-input h-10 !text-sm" data-testid={testId}>
        <option value="">Choose...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (def.type.startsWith("integer") || def.type.startsWith("decimal")) {
    const units = UNITS[def.type];
    const unitKey = `${def.key}__unit`;
    const unit = attrs[unitKey] || defaultUnit(def.type, def.key, ctx.units);
    const suffix = def.type === "integer age" ? "years old" : def.type === "decimal cost" ? attrs[unitKey] || ctx.currency : "";
    return (
      <span className="flex items-center gap-1">
        <BlurInput value={value} onSave={(v) => onChange({ [def.key]: v, [`${def.key}__est`]: undefined, ...(def.type === "decimal cost" && ctx.currency ? { [unitKey]: ctx.currency } : units && !attrs[unitKey] ? { [unitKey]: unit } : {}) })} filter={NUM[def.type] || SIGNED[def.type] || DEC} inputMode={NUM[def.type] ? "numeric" : "decimal"} placeholder="0" disabled={dis} aria-label={def.name} data-testid={testId} />
        {units && <select value={unit} disabled={dis} onChange={(e) => onChange({ [unitKey]: e.target.value })} aria-label={`${def.name} unit`} className="field-input h-10 !w-[70px] shrink-0 !px-1 !text-sm" data-testid={`${testId}-unit`}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>}
        {suffix && <span className="shrink-0 text-xs font-bold text-[var(--muted)]">{suffix}</span>}
        {value && attrs[`${def.key}__est`] && <span title="Estimated by the Magic Mariner. Change it to your own figure." className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-extrabold uppercase text-amber-900" data-testid={`${testId}-est`}>est.</span>}
      </span>
    );
  }
  const link = def.max > 1000 && URL_RE.test(value);
  return (
    <span className="flex items-center gap-1">
      <BlurInput value={value} onSave={set} maxLength={def.max || 1000} disabled={dis} aria-label={def.name} data-testid={testId} placeholder={def.max > 1000 ? "www.example.com" : ""} />
      {link && <a href={/^https?:\/\//i.test(value) ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${def.name}`}
        className="icon-btn !h-10 !w-10 shrink-0" data-testid={`${testId}-open`}><ExternalLink className="h-4 w-4" /></a>}
    </span>
  );
};

export const AttrField = ({ def, attrs, onChange, ctx, itemId }) => {
  const testId = `maint-attr-${def.key}-${itemId}`;
  const wide = def.type === "image" || def.type === "pdf" || def.max > 1000;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <span className="field-label !text-[11px]">{def.name}</span>
      {def.type === "image" || def.type === "pdf"
        ? <AttrFile def={def} attrs={attrs} onChange={onChange} ctx={ctx} testId={testId} />
        : <Control def={def} attrs={attrs} onChange={onChange} ctx={ctx} testId={testId} />}
    </div>
  );
};
