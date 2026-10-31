import { ArrowLeft, X } from "lucide-react";

// Shown on the Crew Roles list after "Change available": tick the roles to offer, then go straight back to the invite.
export const BackToInviteBar = ({ onBack, onDismiss }) => (
  <div className="sticky bottom-3 z-30 flex items-center gap-2 rounded-lg border-2 border-[var(--navy)] bg-sky-50 p-2 shadow-lg" role="region" aria-label="Back to Invite crew" data-testid="back-to-invite-bar">
    <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">Tick the roles crew can be offered.</p>
    <button type="button" className="btn-solid h-11 shrink-0 gap-1.5 px-3 text-sm" onClick={onBack} data-testid="back-to-invite-btn">
      <ArrowLeft className="h-4 w-4" /> Back to Invite crew
    </button>
    <button type="button" className="btn-ghost h-11 w-11 shrink-0 justify-center p-0" onClick={onDismiss} aria-label="Close" data-testid="back-to-invite-dismiss-btn"><X className="h-4 w-4" /></button>
  </div>
);
