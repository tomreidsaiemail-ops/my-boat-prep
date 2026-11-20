import { useState } from "react";
import { Anchor, Check, HelpCircle, Home, LifeBuoy, Navigation2, Sailboat } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// How a planned leg ends; each opens its own arrival checklist from the trip plan.
export const ARRIVE_TYPES = [
  { key: "anchor", label: "Anchoring", prep: "Prepare to anchor", leave: "Weigh Anchor", list: "arrivingDest", Icon: Anchor },
  { key: "berth", label: "Berthing", prep: "Prepare to berth", leave: "Leave Berth", list: "arrivingDest", Icon: Sailboat },
  { key: "mooring", label: "Mooring", prep: "Prepare to pick up buoy", leave: "Leave Mooring", list: "arrivingDest", Icon: LifeBuoy },
  // Sailing past a point without stopping (Day Trips, channels): a "Passed" tap logs the time, no arrival checklist.
  { key: "transit", label: "Transiting", prep: "Transit point", leave: "Carry on", list: null, Icon: Navigation2 },
  { key: "dock", label: "Returning to Dock", prep: "Prepare to return to Dock", leave: "Leave Dock", list: "returningDock", Icon: Home },
];
export const arriveType = (key) => ARRIVE_TYPES.find((t) => t.key === key);

export const ArriveType = ({ id, value, onChange, warn }) => (
  <div className="flex flex-col gap-1.5" role="radiogroup" aria-labelledby={`${id}-label`} data-testid={`${id}-field`}>
    <span id={`${id}-label`} className={`field-label ${warn ? "!text-[var(--red)]" : ""}`}>Arriving at Destination Type</span>
    <div className="grid grid-cols-2 gap-2">
      {ARRIVE_TYPES.map(({ key, label, Icon }) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} data-state={on ? "checked" : "unchecked"} onClick={() => onChange(on ? "" : key)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold [transition:background-color_.15s,color_.15s] ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : `${warn ? "border-[var(--red)]" : "border-[var(--navy)]"} bg-white text-[var(--navy)]`}`}
            data-testid={`${id}-${key}`}>
            <Icon className="h-4 w-4 shrink-0" /> {label}
          </button>
        );
      })}
    </div>
  </div>
);

// A leg row's arriving-type icon; tapping it picks the type straight from the list ("?" when not picked yet).
export const ArriveQuickPick = ({ value, onChange, testId, legLabel }) => {
  const [open, setOpen] = useState(false);
  const t = arriveType(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`icon-btn ${t ? "text-[var(--navy)]" : "text-[var(--muted)]"}`} aria-label={`${legLabel} arriving type: ${t ? t.label : "not picked"}. Change it`} data-testid={testId}>
          {t ? <t.Icon className="h-[18px] w-[18px]" /> : <HelpCircle className="h-[18px] w-[18px]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5" data-testid={`${testId}-menu`}>
        <p className="px-2 pb-1 pt-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Arriving at Destination Type</p>
        {ARRIVE_TYPES.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => { setOpen(false); if (key !== value) onChange(key); }}
            className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-bold [transition:background-color_.15s] ${key === value ? "bg-[var(--navy)] text-white" : "text-[var(--navy)] hover:bg-slate-100"}`}
            aria-pressed={key === value} data-testid={`${testId}-${key}`}>
            <Icon className="h-4 w-4 shrink-0" /> <span className="flex-1">{label}</span> {key === value && <Check className="h-4 w-4" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
