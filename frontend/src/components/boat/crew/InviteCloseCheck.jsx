import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Before Invite Crew closes: an invite typed but never saved, or WhatsApp messages copied but not yet sent.
export const InviteCloseCheck = ({ check, onKeep, onClose }) => {
  const unsaved = check?.unsaved;
  const pending = check?.pending || [];
  return (
    <AlertDialog open={!!check} onOpenChange={(o) => !o && onKeep()}>
      <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="invite-close-check">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl font-extrabold">{unsaved ? `${unsaved} isn't invited yet` : "Now send the WhatsApp message"}</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm text-[var(--navy)]" data-testid="invite-close-check-note">
            {unsaved
              ? `No invite was saved for ${unsaved}. Tap Send email invite or Copy WhatsApp message first, or they won't be asked to join when they log in.`
              : `No email was sent to ${pending.join(", ")}. The invite is saved, so they join when they log in with that email, but they only hear about it once you paste and send the WhatsApp message you copied.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel className="btn-ghost mt-0 px-4" data-testid="invite-close-check-back-btn">{unsaved ? "Go back" : "Back"}</AlertDialogCancel>
          <AlertDialogAction className={`btn-solid px-4 ${unsaved ? "!bg-[var(--red)]" : ""}`} onClick={() => setTimeout(onClose, 0)} data-testid="invite-close-check-close-btn">{unsaved ? "Close without inviting" : "OK, I'll send it"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
