import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRIEFING_MAX } from "@/components/boat/agreement/RoleBriefingField";

export const BRIEFING_PROMPT_KEY = "mbp_role_briefing_prompt";
export const briefingPromptOn = () => localStorage.getItem(BRIEFING_PROMPT_KEY) !== "0";

// Opens as each role is added to an invite: edit or blank its Role Briefing, saved straight to the boat's Crew Roles list.
export const RoleBriefingPrompt = ({ role, current = "", isNew, onSave, onSkip }) => {
  const [text, setText] = useState(current);
  useEffect(() => { setText(current); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = text.trim() !== current.trim();
  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onSkip()}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)]" data-testid="role-briefing-prompt">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold" data-testid="role-briefing-prompt-title">Role Briefing - {role}</DialogTitle>
          <DialogDescription className="text-left text-sm">Sent in the crew invite email, and shown in the Boat Terms and Conditions Agreement crew accept when they join.</DialogDescription>
        </DialogHeader>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, BRIEFING_MAX))} rows={5} maxLength={BRIEFING_MAX} autoFocus
          placeholder="e.g. Local race channel is RPNYC VHF channel 77. Monitor 16 at all times."
          className="field-input !h-auto min-h-[7rem] resize-y py-2 text-base leading-snug" aria-label={`Role Briefing for ${role}`} data-testid="role-briefing-prompt-input" />
        <p className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="note" data-testid="role-briefing-prompt-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Saved to this boat's Crew Roles{isNew ? `, where ${role} is added as a new role` : ""}. Any future crew member given {role} gets this briefing too.</span>
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <button type="button" className="btn-solid h-12 justify-center" disabled={!changed && !isNew} onClick={() => onSave(text)} data-testid="role-briefing-prompt-save-btn">
            {text.trim() ? "Save to Crew Roles" : current.trim() ? "Delete briefing from Crew Roles" : "Save role without a briefing"}
          </button>
          {text.trim() && <button type="button" className="btn-ghost h-11 justify-center" onClick={() => setText("")} data-testid="role-briefing-prompt-blank-btn">Blank the briefing</button>}
          <button type="button" className="btn-ghost h-11 justify-center border-transparent" onClick={onSkip} data-testid="role-briefing-prompt-skip-btn">{isNew ? "Skip, don't add to Crew Roles" : "Keep as it is"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
