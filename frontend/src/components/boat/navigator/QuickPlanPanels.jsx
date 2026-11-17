import { Check, Flag, Plus, Trash2, X, Zap } from "lucide-react";

// Two warnings before a draft can replace an existing route.
export const ReplaceWarning = ({ step, onYes, onNo, testId = "quick-plan-replace" }) => (
  <div role="alert" className="flex flex-col gap-2 rounded-md border-2 border-[var(--red)] bg-red-50 p-3" data-testid={`${testId}-warning`}>
    <p className="text-sm font-bold text-[var(--red)]" data-testid={`${testId}-warning-text`}>
      {step === 1 ? "A Quick Trip Plan Draft will replace the current Route Planning START, DESTINATION, times and legs. Carry on?" : "Are you really sure? The current route can't be brought back."}
    </p>
    <div className="flex gap-2">
      <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onNo} data-testid={`${testId}-cancel-btn`}>Cancel</button>
      <button type="button" className="btn-solid h-11 flex-[2] justify-center gap-1.5 !bg-[var(--red)]" onClick={onYes} data-testid={`${testId}-yes-btn`}>
        <Zap className="h-4 w-4" /> {step === 1 ? "Yes, replace it" : "Yes, I'm really sure"}
      </button>
    </div>
  </div>
);

const Times = ({ n, leg, onChange, testId }) => (
  <div className="grid grid-cols-2 gap-2">
    <label className="text-xs font-bold">Leg {n} departure
      <input type="datetime-local" className="field-input mt-1 w-full" value={leg.depart_at} onChange={(e) => onChange({ depart_at: e.target.value })} data-testid={`${testId}-depart-input`} />
    </label>
    <label className="text-xs font-bold">Estimated finish
      <input type="datetime-local" className="field-input mt-1 w-full" value={leg.finish_at} onChange={(e) => onChange({ finish_at: e.target.value })} data-testid={`${testId}-finish-input`} />
    </label>
  </div>
);

const DeleteBtn = ({ onClick, testId }) => (
  <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-[var(--red)] bg-white px-2.5 text-xs font-bold text-[var(--red)] hover:bg-red-50" data-testid={testId}>
    <Trash2 className="h-3.5 w-3.5" /> Delete this point
  </button>
);

// A newly tapped point, shown right where it was tapped: confirm it, end the trip there, or ignore the tap.
// mid: a stop slotted in between two others. Times take their defaults; tap the pin later to change them.
export const ConfirmPopup = ({ i, mid, name, onConfirm, onIgnore }) => (
  <div className="flex w-[min(250px,calc(100vw-56px))] flex-col gap-1.5 rounded-lg border-2 border-amber-500 bg-white p-2 shadow-lg" data-testid="quick-plan-confirm">
    <p className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{i === 0 ? "Departing point" : `Point ${i + 1}`}</p>
    <p className="break-words text-sm font-bold" data-testid="quick-plan-confirm-name">{name || <span className="font-semibold italic text-[var(--muted)]">Finding the place name...</span>}</p>
    <button type="button" className="btn-solid h-10 min-h-0 justify-center gap-1.5 px-2 text-sm" onClick={() => onConfirm(false)} data-testid="quick-plan-confirm-btn">
      <Check className="h-4 w-4 shrink-0" /> {mid ? "Add this stop" : i === 0 ? "Departing point" : `Arriving (Leg ${i + 1} Departing point)`}
    </button>
    {i > 0 && !mid && (
      <button type="button" className="btn-ghost h-10 min-h-0 justify-center gap-1.5 px-2 text-sm !border-emerald-700 !text-emerald-800" onClick={() => onConfirm(true)} data-testid="quick-plan-end-btn">
        <Flag className="h-4 w-4 shrink-0" /> Arriving (End of Trip point)
      </button>
    )}
    <button type="button" className="btn-ghost h-9 min-h-0 justify-center gap-1.5 px-2 text-xs" onClick={onIgnore} data-testid="quick-plan-ignore-btn">
      <X className="h-3.5 w-3.5" /> Ignore this tap
    </button>
  </div>
);

// A pin tapped on the Edit map: rename it, change its leg's times, delete it or add a stop after it.
export const PointPanel = ({ j, last, name, setName, leg, setTimes, onDelete, onAddAfter, onClose, busy }) => (
  <div className="flex flex-col gap-2 rounded-md border-2 border-[var(--navy)] bg-[var(--panel)] p-3" data-testid="quick-plan-point-panel">
    <div className="flex items-center justify-between gap-2">
      <label className="field-label" htmlFor="quick-plan-point-name" data-testid="quick-plan-point-title">{j === 0 ? "Departing point" : j === last ? `Point ${j + 1} (End of Trip)` : `Point ${j + 1}`}</label>
      <div className="flex items-center gap-1">
        <DeleteBtn onClick={onDelete} testId="quick-plan-point-delete-btn" />
        <button type="button" className="icon-btn h-8 w-8" aria-label="Close" onClick={onClose} data-testid="quick-plan-point-close-btn"><X className="h-4 w-4" /></button>
      </div>
    </div>
    <input id="quick-plan-point-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="quick-plan-point-name-input" />
    {leg && <Times n={j + 1} leg={leg} onChange={setTimes} testId="quick-plan-point" />}
    <button type="button" className="btn-ghost h-11 justify-center gap-1.5" disabled={busy} onClick={onAddAfter} data-testid="quick-plan-point-add-after-btn">
      <Plus className="h-4 w-4" /> Add a stop after this
    </button>
  </div>
);
