import { Anchor, Home, LifeBuoy, Sailboat } from "lucide-react";

// How a planned leg ends; each opens its own arrival checklist from the trip plan.
export const ARRIVE_TYPES = [
  { key: "anchor", label: "Anchoring", prep: "Prepare to anchor", leave: "Weigh Anchor", list: "arrivingDest", Icon: Anchor },
  { key: "berth", label: "Berthing", prep: "Prepare to berth", leave: "Leave Berth", list: "arrivingDest", Icon: Sailboat },
  { key: "mooring", label: "Mooring", prep: "Prepare to pick up buoy", leave: "Leave Mooring", list: "arrivingDest", Icon: LifeBuoy },
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
