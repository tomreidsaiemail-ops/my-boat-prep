import { AlertTriangle, Anchor, CheckCircle2, Info, LifeBuoy, Loader2, Sailboat } from "lucide-react";
import { SetNow, When } from "@/components/boat/navigator/NavigatorExtras";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLANNED } from "@/components/boat/departure/NextStep";

const ICON = { ok: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />, info: <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />, warn: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> };

const CHOICE_ICON = { berth: Sailboat, anchor: Anchor, mooring: LifeBuoy };

// Arriving at Destination: how you arrived decides which If... group is ticked, and logs it. planned: the one the plan says, in yellow.
const Choices = ({ choices, busy, disabled, onPick, planned }) => (
  <div className="flex flex-col gap-2" data-testid="all-done-choices">
    {choices.map((c) => {
      const Icon = CHOICE_ICON[c.key];
      return (
        <button key={c.key} type="button" className={`btn-solid flex h-auto min-h-14 items-center !justify-start gap-3 px-3 py-2 !text-left ${c.key === planned ? PLANNED : ""}`} onClick={() => onPick(c.key)} disabled={busy || disabled} data-testid={`all-done-choice-${c.key}`} data-planned={c.key === planned || undefined}>
          {busy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Icon className="h-5 w-5 shrink-0" />}
          <span className="flex flex-col items-start text-left"><span className="text-sm font-extrabold uppercase tracking-wide">{c.label}</span><span className="text-xs font-semibold normal-case opacity-85" data-testid={`all-done-choice-${c.key}-text`}>{c.text}</span></span>
        </button>
      );
    })}
  </div>
);

const nowLabel = (m) => (m ? `Set to Now - ${-m} minutes` : "Set to Now");

// ARRIVED: the Estimated Finish is confirmed (or changed) as the actual arrival time.
const ActualFinish = ({ plan, onFinish }) => (
  <div className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid="all-done-actual">
    <When id="all-done-actual-finish" label="Actual finish date and time" value={plan.finish} onChange={onFinish} warn={plan.finish?.length !== 16} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-[var(--muted)]" data-testid="all-done-actual-estimate">{plan.estimate && plan.finish === plan.estimate ? "Filled in from the Estimated Finish. Change it if you were early or late." : plan.finish ? "This is logged as when you arrived." : "Enter when you arrived."}</span>
      <SetNow step={-5} onSet={onFinish} label={nowLabel} className="btn-ghost h-9 min-h-0 px-3 text-xs" testId="all-done-actual-now" />
    </div>
  </div>
);

// What DEPART or ARRIVED is about to tick and log, shown before anything changes. help: guide text at the top.
export const AllDoneDialog = ({ plan, busy, onConfirm, onClose, onFinish, onEndTrip, help = null, planned = "" }) => {
  const depart = plan?.kind === "depart";
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="all-done-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        {plan && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-extrabold">{depart ? "About to depart" : "About to log your arrival"}</DialogTitle>
              <DialogDescription>{plan.blocked ? "Finish this first, then try again:" : "This is what will be ticked and logged in the Ship's Log:"}</DialogDescription>
            </DialogHeader>
            {!plan.blocked && help}
            {plan.blocked
              ? <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="all-done-blocked"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{plan.blocked}</p>
              : (
                <ul className="flex flex-col gap-2" data-testid="all-done-steps">
                  {plan.steps.filter((s) => s.id !== "fold" || plan.endTrip).map((s) => <li key={s.id} className="flex items-start gap-2 text-sm" data-testid={`all-done-step-${s.id}`}>{ICON[s.tone || "ok"]}<span className="whitespace-pre-line">{s.text}</span></li>)}
                </ul>
              )}
            {!plan.blocked && plan.canFold && (
              <label className="flex items-start gap-2 rounded-lg border-2 border-[var(--navy)] px-3 py-2 text-sm font-bold" data-testid="all-done-end-trip">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={!!plan.endTrip} onChange={(e) => onEndTrip(e.target.checked)} data-testid="all-done-end-trip-checkbox" />
                <span>End of trip: group the trip&apos;s Ship&apos;s Log entries into a trip folder, with a folder per leg{plan.listId === "returningDock" ? "" : ". Ticked when no planned legs are left in the Route Plan"}</span>
              </label>
            )}
            {!plan.blocked && !depart && <ActualFinish plan={plan} onFinish={onFinish} />}
            {!plan.blocked && !depart && plan.finish?.length !== 16 && <p role="alert" className="text-sm font-bold text-[var(--red)]" data-testid="all-done-actual-error">Enter the actual finish date and time to log your arrival.</p>}
            {!plan.blocked && plan.choices && <Choices choices={plan.choices} busy={busy} disabled={plan.finish?.length !== 16} onPick={onConfirm} />}
            <div className="flex gap-2">
              {!plan.blocked && !plan.choices && (
                <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" onClick={() => onConfirm()} disabled={busy || plan.checking || (!depart && plan.finish?.length !== 16)} data-testid="all-done-confirm-btn">
                  {(busy || plan.checking) && <Loader2 className="h-4 w-4 animate-spin" />}{depart ? "Depart now" : "Log arrival"}
                </button>
              )}
              <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} disabled={busy} data-testid="all-done-cancel-btn">{plan.blocked ? "OK" : "Cancel"}</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
