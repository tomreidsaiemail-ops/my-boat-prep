import { AlertTriangle } from "lucide-react";
import { LEVELS, isLow } from "@/lib/telemetry";

// Five coloured buttons, Full to Empty; 1/4 and Empty raise a red warning.
export const LevelPicker = ({ id, label, value, onChange, hint, detail, lowText = "Top up or charge before you leave." }) => (
  <div className="flex flex-col gap-1" data-testid={`level-${id}`}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-extrabold">{label}</span>
      {detail && <span className="text-xs text-[var(--muted)]" data-testid={`level-${id}-detail`}>{detail}</span>}
    </div>
    {hint && <p className="text-xs leading-relaxed text-[var(--muted)]" data-testid={`level-${id}-hint`}>{hint}</p>}
    <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={`${label} level`}>
      {LEVELS.map((l) => (
        <button key={l.key} type="button" role="radio" aria-checked={value === l.key} onClick={() => onChange(l.key)} data-testid={`level-${id}-${l.key}`}
          className={`h-10 rounded-md border-2 text-sm font-extrabold [transition:background-color_.15s,color_.15s] ${value === l.key ? l.on : `bg-white ${l.off}`}`}>{l.label}</button>
      ))}
    </div>
    {isLow(value) && (
      <p className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-sm font-bold text-[var(--red)]" role="alert" data-testid={`level-${id}-warning`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {label} is {value === "empty" ? "empty" : "down to 1/4"}. {lowText}
      </p>
    )}
  </div>
);
