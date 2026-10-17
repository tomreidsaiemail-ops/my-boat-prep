import { RotateCcw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ResetAllDialog = ({ open, onConfirm, onClose }) => (
  <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="max-w-sm rounded-lg border-2 border-[var(--navy)]" data-testid="reset-all-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold"><RotateCcw className="h-5 w-5" /> Reset All lists?</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <ul className="list-disc space-y-1.5 pl-5 text-left text-sm text-[var(--navy)]" data-testid="reset-all-explainer">
            <li><b>Supplied lists</b> go back to their original items. Your edits, added items and ticks are removed, and deleted items and lists come back.</li>
            <li><b>Lists you created</b> are kept as they are.</li>
            <li><b>Ship&apos;s Log</b> and <b>My To Do List</b> are kept as they are.</li>
          </ul>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row justify-end gap-2">
        <AlertDialogCancel className="btn-ghost mt-0 px-5" data-testid="reset-all-cancel-btn">Cancel</AlertDialogCancel>
        <AlertDialogAction className="btn-solid px-5" onClick={onConfirm} data-testid="reset-all-confirm-btn">Reset All</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
