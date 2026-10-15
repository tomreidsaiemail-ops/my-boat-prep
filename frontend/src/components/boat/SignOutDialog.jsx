import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const SignOutDialog = ({ open, pending, onConfirm, onClose }) => (
  <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent data-testid="signout-warning-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display">Unsaved changes</AlertDialogTitle>
        <AlertDialogDescription data-testid="signout-warning-text">
          You have {pending} {pending === 1 ? "change" : "changes"} that haven't been saved to the cloud yet. If you sign out now, they'll be lost.
          Set Status to Online when you have signal to sync them first.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="signout-cancel-btn">Stay signed in</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-[var(--red)] hover:bg-red-700" data-testid="signout-confirm-btn">Sign out anyway</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
