import { Check, Flag, Plus, RotateCcw, Trash2, X, Zap } from "lucide-react";
import { ARRIVE_TYPES } from "@/components/boat/navigator/ArriveType";

// Two warnings before a draft can replace an existing route.
export const ReplaceWarning = ({ step, onYes, onNo, testId = "quick-plan-replace" }) => (
  <div role="alert" className="flex flex-col gap-2 rounded-md border-2 border-[var(--red)] bg-red-50 p-3" data-testid={`${testId}-warning`}>
    <p className="text-sm font-bold text-[var(--red)]" data-testid={`${testId}-warning-text`}>
      {step === 1 ? "A Quick Draft Plan will replace the current Trip Planning START, DESTINATION, times and legs. Carry on?" : "Are you really sure? The current route can't be brought back."}
    </p>
    <div className="flex gap-2">
      <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onNo} data-testid={`${testId}-cancel-btn`}>Cancel</button>
      <button type="button" className="btn-solid h-11 flex-[2] justify-center gap-1.5 !bg-[var(--red)]" onClick={onYes} data-testid={`${testId}-yes-btn`}>
        <Zap className="h-4 w-4" /> {step === 1 ? "Yes, replace it" : "Yes, I'm really sure"}
      </button>
    </div>
  </div>
);

const DeleteBtn = ({ onClick, testId }) => (
  <button type="button" onClick={onClick} className="inline-flex h-9 items-center justify-center gap-1 rounded-full border-[1.5px] border-[var(--red)] bg-white px-2.5 text-xs font-bold text-[var(--red)] hover:bg-red-50" data-testid={testId}>
    <Trash2 className="h-3.5 w-3.5" /> Delete this point
  </button>
);

// A newly tapped point, shown right where it was tapped: confirm it, end the trip there, or ignore the tap.
// mid: a stop slotted in between two others. Times take their defaults; tap the pin later to change them.
// home: a return trip's DESTINATION, which also makes Leg 2 back to the start. Any new end point can also come back to the start.
export const ConfirmPopup = ({ i, mid, home, name, onConfirm, onIgnore }) => (
  <div className="flex w-[min(250px,calc(100vw-56px))] flex-col gap-1.5 rounded-lg border-2 border-amber-500 bg-white p-2 shadow-lg" data-testid="quick-plan-confirm">
    <p className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{i === 0 ? "Departing point" : `Point ${i + 1}`}</p>
    <p className="break-words text-sm font-bold" data-testid="quick-plan-confirm-name">{name || <span className="font-semibold italic text-[var(--muted)]">Finding the place name...</span>}</p>
    <button type="button" className="btn-solid h-10 min-h-0 justify-center gap-1.5 px-2 text-sm" onClick={() => onConfirm(false)} data-testid="quick-plan-confirm-btn">
      <Check className="h-4 w-4 shrink-0" /> {home ? "DESTINATION, then return to start" : mid ? "Add this stop" : i === 0 ? "Departing point" : `Arriving (Leg ${i + 1} Departing point)`}
    </button>
    {i > 0 && !mid && !home && (
      <button type="button" className="btn-ghost h-10 min-h-0 justify-center gap-1.5 px-2 text-sm !border-emerald-700 !text-emerald-800" onClick={() => onConfirm(true)} data-testid="quick-plan-end-btn">
        <Flag className="h-4 w-4 shrink-0" /> Arriving (End of Trip point)
      </button>
    )}
    {i > 0 && !mid && !home && (
      <button type="button" className="btn-ghost h-auto min-h-10 justify-center gap-1.5 px-2 py-1.5 text-sm !border-[var(--red)] !text-[var(--red)]" onClick={() => onConfirm(false, true)} data-testid="quick-plan-return-btn">
        <RotateCcw className="h-4 w-4 shrink-0" /> {i === 1 ? "DESTINATION" : "Arriving"}, then return to start
      </button>
    )}
    <button type="button" className="btn-ghost h-9 min-h-0 justify-center gap-1.5 px-2 text-xs" onClick={onIgnore} data-testid="quick-plan-ignore-btn">
      <X className="h-3.5 w-3.5" /> Ignore this tap
    </button>
  </div>
);

// A pin tapped on the draft map, shown at the pin: rename it, pick how its leg arrives, delete it or add a stop after it.
// type / setType: the arriving type of the leg ending at this pin (none for the departing point).
export const PointPopup = ({ j, last, name, setName, type, setType, onDelete, onAddAfter, onClose, busy }) => (
  <div className="flex w-[min(260px,calc(100vw-56px))] flex-col gap-1.5 rounded-lg border-2 border-[var(--navy)] bg-white p-2 shadow-lg" data-testid="quick-plan-point-panel">
    <div className="flex items-center justify-between gap-1">
      <label className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]" htmlFor="quick-plan-point-name" data-testid="quick-plan-point-title">
        {j === 0 ? "Departing point" : j === last ? `Point ${j + 1} (End of Trip)` : `Point ${j + 1}`}
      </label>
      <button type="button" className="icon-btn h-8 w-8 min-h-0" aria-label="Close" onClick={onClose} data-testid="quick-plan-point-close-btn"><X className="h-4 w-4" /></button>
    </div>
    <input id="quick-plan-point-name" className="field-input h-10 min-h-0 text-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="quick-plan-point-name-input" />
    {j > 0 && (
      <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Arriving at Destination Type" data-testid="quick-plan-point-type">
        {ARRIVE_TYPES.map(({ key, label, Icon }) => (
          <button key={key} type="button" role="radio" aria-checked={type === key} aria-label={label} title={label} onClick={() => setType(key)}
            className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-[var(--navy)] text-[10px] font-bold leading-none [transition:background-color_.15s,color_.15s] ${type === key ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)]"}`}
            data-testid={`quick-plan-point-type-${key}`}>
            <Icon className="h-4 w-4" /> {SHORT[key]}
          </button>
        ))}
      </div>
    )}
    <button type="button" className="btn-ghost h-10 min-h-0 justify-center gap-1.5 px-2 text-sm" disabled={busy} onClick={onAddAfter} data-testid="quick-plan-point-add-after-btn">
      <Plus className="h-4 w-4" /> Add a stop after this
    </button>
    <DeleteBtn onClick={onDelete} testId="quick-plan-point-delete-btn" />
  </div>
);
const SHORT = { anchor: "Anchor", berth: "Berth", mooring: "Mooring", transit: "Transit", dock: "Dock" };
